"""
Business: Заполняет шаблон с переменными через ИИ на основе базы знаний
Args: event (httpMethod, body с template_id, event_id, theme)
Returns: HTML письма с заполненными переменными + JSON данными
"""

import json
import os
import re
from typing import Dict, Any, List
import psycopg2
import requests


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Главный обработчик функции"""
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
            'body': '',
            'isBase64Encoded': False
        }
    
    if method != 'POST':
        return {
            'statusCode': 405,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'error': 'Only POST method allowed'}),
            'isBase64Encoded': False
        }
    
    try:
        body_str = event.get('body', '{}')
        if not body_str or body_str == '':
            body_str = '{}'
        
        body_data = json.loads(body_str)
        
        template_id = body_data.get('template_id')
        event_id = body_data.get('event_id')
        theme = body_data.get('theme', '')
        
        if not template_id or not event_id:
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'error': 'template_id and event_id are required'}),
                'isBase64Encoded': False
            }
        
        # Получаем конфигурацию
        db_url = os.environ.get('DATABASE_URL', '')
        openai_key = os.environ.get('OPENAI_API_KEY', '')
        
        if not db_url:
            return {
                'statusCode': 500,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'error': 'DATABASE_URL not configured'}),
                'isBase64Encoded': False
            }
        
        if not openai_key:
            return {
                'statusCode': 500,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'error': 'OPENAI_API_KEY not configured'}),
                'isBase64Encoded': False
            }
        
        # Подключаемся к БД
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()
        
        # 1. Загружаем шаблон
        cur.execute("""
            SELECT html_template, subject_template, instructions, original_html, manual_variables 
            FROM t_p22819116_event_schedule_app.email_templates 
            WHERE id = %s
        """, (template_id,))
        
        template_row = cur.fetchone()
        if not template_row:
            cur.close()
            conn.close()
            return {
                'statusCode': 404,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'error': f'Template {template_id} not found'}),
                'isBase64Encoded': False
            }
        
        html_template, subject_template, instructions, original_html, manual_variables_json = template_row
        
        # 2. Загружаем переменные шаблона
        # Сначала пробуем из таблицы template_variables
        cur.execute("""
            SELECT variable_name, variable_description, default_value, is_required, variable_type
            FROM t_p22819116_event_schedule_app.template_variables
            WHERE template_id = %s
            ORDER BY id
        """, (template_id,))
        
        template_variables = []
        for var_name, var_desc, default_val, is_req, var_type in cur.fetchall():
            template_variables.append({
                'name': var_name,
                'description': var_desc or f'Переменная {var_name}',
                'default_value': default_val or '',
                'is_required': is_req,
                'type': var_type or 'text'
            })
        
        # Если нет переменных в таблице, используем manual_variables из JSON
        if not template_variables and manual_variables_json:
            try:
                manual_vars = json.loads(manual_variables_json) if isinstance(manual_variables_json, str) else manual_variables_json
                for var in manual_vars:
                    template_variables.append({
                        'name': var.get('name', ''),
                        'description': var.get('description', ''),
                        'default_value': var.get('content', '')[:100],  # Используем первые 100 символов контента как дефолт
                        'is_required': False,
                        'type': 'text'
                    })
                print(f'[INFO] Loaded {len(template_variables)} variables from manual_variables JSON')
            except Exception as e:
                print(f'[WARN] Failed to parse manual_variables: {e}')
        
        # 3. Загружаем базу знаний
        cur.execute("""
            SELECT item_type, content, metadata
            FROM t_p22819116_event_schedule_app.knowledge_store
            WHERE event_id = %s
        """, (event_id,))
        
        knowledge_rows = cur.fetchall()
        
        cur.close()
        conn.close()
        
        # 4. Форматируем базу знаний
        knowledge_text = format_knowledge_base(knowledge_rows)
        
        # 5. Генерируем значения переменных через ИИ
        variables_data = generate_variables_with_ai(
            template_variables=template_variables,
            knowledge_text=knowledge_text,
            theme=theme,
            instructions=instructions,
            openai_key=openai_key
        )
        
        print(f'[DEBUG] Template {template_id} has {len(template_variables)} variables defined')
        print(f'[DEBUG] AI generated {len(variables_data)} variables: {list(variables_data.keys())}')
        print(f'[DEBUG] Template HTML length: {len(html_template)} chars')
        print(f'[DEBUG] Template contains {{{{ placeholders: {html_template.count("{{")}')
        
        # 6. Заполняем шаблон
        filled_html = fill_template(html_template, variables_data)
        filled_subject = fill_template(subject_template, variables_data) if subject_template else ''
        
        print(f'[DEBUG] Filled HTML length: {len(filled_html)} chars')
        print(f'[DEBUG] HTML changed: {filled_html != html_template}')
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'success': True,
                'filled_html': filled_html,
                'filled_subject': filled_subject,
                'variables_data': variables_data,
                'theme': theme
            }, ensure_ascii=False),
            'isBase64Encoded': False
        }
    
    except Exception as e:
        import traceback
        traceback.print_exc()
        
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'error': 'Internal server error',
                'details': str(e)
            }),
            'isBase64Encoded': False
        }


def format_knowledge_base(knowledge_rows: List[tuple]) -> str:
    """Форматирует базу знаний в текст для ИИ"""
    sections = {
        'program_item': [],
        'pain_point': [],
        'style_snippet': []
    }
    
    for item_type, content, metadata in knowledge_rows:
        if item_type in sections:
            sections[item_type].append(content)
    
    result = "# База знаний о мероприятии\n\n"
    
    if sections['program_item']:
        result += "## Программа мероприятия:\n"
        for item in sections['program_item']:
            result += f"- {item}\n"
        result += "\n"
    
    if sections['pain_point']:
        result += "## Боли целевой аудитории:\n"
        for item in sections['pain_point']:
            result += f"- {item}\n"
        result += "\n"
    
    if sections['style_snippet']:
        result += "## Примеры стиля коммуникации:\n"
        for item in sections['style_snippet']:
            result += f"- {item}\n"
        result += "\n"
    
    return result


def generate_variables_with_ai(
    template_variables: List[Dict[str, Any]],
    knowledge_text: str,
    theme: str,
    instructions: str,
    openai_key: str
) -> Dict[str, str]:
    """Генерирует значения переменных через OpenAI"""
    
    # Формируем описание переменных для ИИ
    variables_list = []
    for var in template_variables:
        var_info = f"- {var['name']}: {var['description']}"
        if var['default_value']:
            var_info += f" (по умолчанию: {var['default_value']})"
        if var['is_required']:
            var_info += " [обязательно]"
        variables_list.append(var_info)
    
    variables_prompt = "\n".join(variables_list)
    
    system_prompt = f"""Ты — копирайтер email-рассылок для HR-мероприятий.

Твоя задача: заполнить переменные шаблона письма на основе базы знаний.

{instructions or 'Используй профессиональный, но дружелюбный тон. Будь конкретен и полезен.'}

База знаний:
{knowledge_text}

Тема письма: {theme or 'Не указана'}

Переменные для заполнения:
{variables_prompt}

Верни ТОЛЬКО валидный JSON объект где ключи — имена переменных, значения — их заполненные значения.
Пример: {{"speaker_name": "Иван Петров", "event_date": "15 мая в 19:00"}}
"""
    
    try:
        response = requests.post(
            'https://api.openai.com/v1/chat/completions',
            headers={
                'Authorization': f'Bearer {openai_key}',
                'Content-Type': 'application/json'
            },
            json={
                'model': 'gpt-4o-mini',
                'messages': [
                    {'role': 'system', 'content': system_prompt},
                    {'role': 'user', 'content': 'Заполни переменные на основе базы знаний.'}
                ],
                'temperature': 0.7,
                'max_tokens': 2000
            },
            timeout=30
        )
        
        if response.status_code != 200:
            raise Exception(f"OpenAI API error: {response.text}")
        
        ai_response = response.json()
        content = ai_response['choices'][0]['message']['content']
        
        # Извлекаем JSON из ответа (может быть обернут в markdown)
        json_match = re.search(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', content, re.DOTALL)
        if json_match:
            variables_data = json.loads(json_match.group(0))
        else:
            variables_data = json.loads(content)
        
        # Добавляем default значения для отсутствующих переменных
        for var in template_variables:
            if var['name'] not in variables_data:
                variables_data[var['name']] = var['default_value'] or ''
        
        return variables_data
    
    except Exception as e:
        print(f"[ERROR] AI generation failed: {str(e)}")
        
        # Fallback: используем default значения
        fallback_data = {}
        for var in template_variables:
            fallback_data[var['name']] = var['default_value'] or f'[{var["name"]}]'
        
        return fallback_data


def fill_template(template: str, variables_data: Dict[str, str]) -> str:
    """Заполняет шаблон переменными"""
    result = template
    
    for key, value in variables_data.items():
        pattern = r'\{\{' + re.escape(key) + r'\}\}'
        result = re.sub(pattern, str(value), result)
    
    return result