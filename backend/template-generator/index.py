import json
import os
import re
from typing import Dict, Any, List

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Business: Рендерит HTML из готового шаблона с переменными {{field|default}}
    Args: event - dict с httpMethod, body {template_html: str, data: dict, event_id: int, content_type_id: int, name: str}
    Returns: HTTP response с отрендеренным HTML и template_id
    '''
    method: str = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Max-Age': '86400'
            },
            'body': ''
        }
    
    if method == 'POST':
        body_str = event.get('body', '{}')
        if not body_str or body_str == '':
            body_str = '{}'
        body_data = json.loads(body_str)
        
        template_html = body_data.get('template_html')
        data = body_data.get('data', {})
        event_id = body_data.get('event_id')
        content_type_id = body_data.get('content_type_id')
        template_name = body_data.get('name', 'Шаблон')
        test_mode = body_data.get('test_mode', False)
        
        if not template_html:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'template_html required'})
            }
        
        if not test_mode and (not event_id or not content_type_id):
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'event_id and content_type_id required'})
            }
        
        try:
            # Рендерим шаблон
            rendered_html = render_template(template_html, data)
            
            # Извлекаем схему переменных из шаблона
            variables_schema = extract_variables_schema(template_html)
            
            if test_mode:
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({
                        'rendered_html': rendered_html,
                        'template_html': template_html,
                        'variables_schema': variables_schema,
                        'data': data
                    })
                }
            
            # Сохраняем в БД
            db_url = os.environ.get('DATABASE_URL', '')
            if not db_url:
                return {
                    'statusCode': 500,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'DATABASE_URL not configured'})
                }
            
            import psycopg2
            conn = psycopg2.connect(db_url)
            cur = conn.cursor()
            
            # Сохраняем оригинал (пример)
            cur.execute(
                "INSERT INTO t_p22819116_event_schedule_app.email_templates " +
                "(event_id, content_type_id, name, html_template, is_example) VALUES " +
                "(%s, %s, %s, %s, %s) RETURNING id",
                (event_id, content_type_id, f"{template_name} (Оригинал)", rendered_html, True)
            )
            example_id = cur.fetchone()[0]
            
            # Сохраняем шаблон с переменными
            cur.execute(
                "INSERT INTO t_p22819116_event_schedule_app.email_templates " +
                "(event_id, content_type_id, name, html_template, html_layout, slots_schema, is_example) VALUES " +
                "(%s, %s, %s, %s, %s, %s, %s) RETURNING id",
                (event_id, content_type_id, template_name, template_html, template_html, json.dumps(variables_schema), False)
            )
            template_id = cur.fetchone()[0]
            
            conn.commit()
            cur.close()
            conn.close()
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({
                    'success': True,
                    'example_id': example_id,
                    'template_id': template_id,
                    'rendered_html': rendered_html,
                    'variables_schema': variables_schema
                })
            }
            
        except Exception as e:
            print(f'[ERROR] {str(e)}')
            import traceback
            traceback.print_exc()
            return {
                'statusCode': 500,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': str(e)})
            }
    
    return {
        'statusCode': 405,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'body': json.dumps({'error': 'Method not allowed'})
    }


def render_template(template: str, data: Dict[str, Any]) -> str:
    """
    Рендерит шаблон с переменными {{field_name|default_value}}
    
    Поддерживает:
    - Простые переменные: {{greeting|Привет}} → data['greeting'] или 'Привет'
    - Массивы: {{speakers|[]}} → data['speakers'] или []
    - Вложенные поля: {{speaker_1_title|...}} → data['speakers'][0]['title']
    - Автоматическое создание циклов для массивов
    """
    result = template
    
    # 1. Обрабатываем массивы (speakers, sessions и т.д.)
    array_pattern = r'\{\{([a-zA-Z_]+)\|(\[\])\}\}'
    for match in re.finditer(array_pattern, template):
        array_name = match.group(1)  # speakers
        array_data = data.get(array_name, [])
        
        if not isinstance(array_data, list):
            array_data = []
        
        # Ищем блок с элементами массива (speaker_1_*, speaker_2_*, ...)
        # Пробуем единственное число (speakers → speaker)
        singular = array_name.rstrip('s') if array_name.endswith('s') else array_name
        
        # Найдём все переменные вида {singular}_N_*
        item_pattern = r'\{\{' + singular + r'_(\d+)_([a-zA-Z_]+)\|([^}}]*)\}\}'
        items_found = re.findall(item_pattern, template)
        
        if not items_found:
            # Если нет элементов, удаляем метку массива
            result = result.replace(match.group(0), '')
            continue
        
        # Группируем по индексу (1, 2, 3...)
        items_by_index: Dict[str, List[tuple]] = {}
        for index, field, default in items_found:
            if index not in items_by_index:
                items_by_index[index] = []
            items_by_index[index].append((field, default))
        
        # Если в data меньше элементов, используем defaults
        max_index = max([int(idx) for idx in items_by_index.keys()])
        
        # Заменяем каждую переменную speaker_N_field
        for i in range(1, max_index + 1):
            item_data = array_data[i - 1] if i <= len(array_data) else {}
            
            for field, default in items_by_index.get(str(i), []):
                var_name = f'{singular}_{i}_{field}'
                placeholder = f'{{{{{var_name}|{default}}}}}'
                
                # Получаем значение: data['speakers'][0]['title'] или default
                value = item_data.get(field, default) if isinstance(item_data, dict) else default
                result = result.replace(placeholder, str(value))
        
        # Удаляем метку массива
        result = result.replace(match.group(0), '')
    
    # 2. Обрабатываем простые переменные {{field|default}}
    simple_pattern = r'\{\{([a-zA-Z_]+)\|([^}}]*)\}\}'
    for match in re.finditer(simple_pattern, result):
        field_name = match.group(1)
        default_value = match.group(2)
        
        # Пропускаем, если это уже обработанный массив
        if field_name in data and isinstance(data[field_name], list):
            continue
        
        value = data.get(field_name, default_value)
        result = result.replace(match.group(0), str(value))
    
    # 3. Обрабатываем переменные без дефолта {{field}}
    no_default_pattern = r'\{\{([a-zA-Z_0-9]+)\}\}'
    for match in re.finditer(no_default_pattern, result):
        field_name = match.group(1)
        
        # Пропускаем, если это уже обработанный массив
        if field_name in data and isinstance(data[field_name], list):
            continue
        
        value = data.get(field_name, f'[missing: {field_name}]')
        result = result.replace(match.group(0), str(value))
    
    return result


def extract_variables_schema(template: str) -> Dict[str, Any]:
    """
    Извлекает схему переменных из шаблона {{field|default}}
    
    Возвращает:
    {
      "greeting": {"type": "string", "default": "Здравствуйте"},
      "speakers": {"type": "array", "fields": ["job", "title", "desc"]}
    }
    """
    schema = {}
    
    # 1. Простые переменные
    simple_pattern = r'\{\{([a-zA-Z_]+)\|([^}}]*)\}\}'
    for match in re.finditer(simple_pattern, template):
        field_name = match.group(1)
        default_value = match.group(2)
        
        # Проверяем, не массив ли это
        if default_value == '[]':
            # Это метка массива, обработаем позже
            continue
        
        # Проверяем, не элемент ли массива (speaker_1_title)
        if re.match(r'^[a-zA-Z_]+_\d+_[a-zA-Z_]+$', field_name):
            continue
        
        schema[field_name] = {
            "type": "string",
            "default": default_value
        }
    
    # 2. Массивы (speakers|[], sessions|[])
    array_pattern = r'\{\{([a-zA-Z_]+)\|\[\]\}\}'
    for match in re.finditer(array_pattern, template):
        array_name = match.group(1)
        
        # Ищем поля массива (speaker_1_title, speaker_1_job, ...)
        # Пробуем единственное число (speakers → speaker)
        singular = array_name.rstrip('s') if array_name.endswith('s') else array_name
        item_pattern = r'\{\{' + singular + r'_\d+_([a-zA-Z_]+)\|[^}}]*\}\}'
        fields = list(set(re.findall(item_pattern, template)))
        
        schema[array_name] = {
            "type": "array",
            "fields": fields
        }
    
    return schema