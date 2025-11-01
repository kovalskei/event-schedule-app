import json
import os
import re
from typing import Dict, Any, List
import psycopg2
import requests

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Business: Генерирует email из шаблона + базы знаний на основе темы из контент-плана
    Args: event - dict с httpMethod, body {theme: str, event_id: int, template_id: int}
    Returns: HTTP response с готовым HTML письма
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
        
        theme = body_data.get('theme', '')
        event_id = body_data.get('event_id')
        template_id = body_data.get('template_id')
        test_mode = body_data.get('test_mode', False)
        
        if not event_id:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'event_id required'})
            }
        
        if not template_id:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'template_id required'})
            }
        
        try:
            db_url = os.environ.get('DATABASE_URL', '')
            if not db_url:
                return {
                    'statusCode': 500,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'DATABASE_URL not configured'})
                }
            
            openai_key = os.environ.get('OPENAI_API_KEY', '')
            if not openai_key:
                return {
                    'statusCode': 500,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'OPENAI_API_KEY not configured'})
                }
            
            conn = psycopg2.connect(db_url)
            cur = conn.cursor()
            
            # 1. Получаем шаблон
            cur.execute(
                "SELECT html_template, slots_schema FROM t_p22819116_event_schedule_app.email_templates WHERE id = %s",
                (template_id,)
            )
            template_row = cur.fetchone()
            if not template_row:
                return {
                    'statusCode': 404,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': f'Template {template_id} not found'})
                }
            
            template_html = template_row[0]
            slots_schema = template_row[1] or {}
            
            # 2. Получаем знания из базы
            cur.execute(
                "SELECT item_type, content, metadata FROM t_p22819116_event_schedule_app.knowledge_store WHERE event_id = %s",
                (event_id,)
            )
            knowledge_rows = cur.fetchall()
            
            cur.close()
            conn.close()
            
            # 3. Группируем знания по типам
            knowledge = {
                'speakers': [],
                'pain_points': [],
                'styles': []
            }
            
            for item_type, content, metadata in knowledge_rows:
                if item_type == 'program_item':
                    # Парсим спикеров из строк вида "Светлана Бойко, HRD IT, Кворум {ОЦЕНКА ПЕРСОНАЛА}"
                    speaker = parse_speaker_from_content(content)
                    if speaker:
                        knowledge['speakers'].append(speaker)
                elif item_type == 'pain_point':
                    knowledge['pain_points'].append(content)
                elif item_type == 'style_snippet':
                    knowledge['styles'].append(content)
            
            # 4. AI: Находим подходящих спикеров + формируем подводку
            ai_result = generate_email_content_with_ai(
                theme=theme,
                knowledge=knowledge,
                template_html=template_html,
                openai_key=openai_key
            )
            
            # 5. Рендерим шаблон через /template-generator
            template_gen_url = 'https://functions.poehali.dev/616d6890-24c3-49c8-8b29-692dd342933b'
            render_response = requests.post(template_gen_url, json={
                'template_html': template_html,
                'data': ai_result['data'],
                'test_mode': True
            })
            
            if render_response.status_code != 200:
                return {
                    'statusCode': 500,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Template rendering failed', 'details': render_response.text})
                }
            
            rendered = render_response.json()
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({
                    'success': True,
                    'rendered_html': rendered['rendered_html'],
                    'ai_reasoning': ai_result['reasoning'],
                    'selected_speakers': ai_result['selected_speakers'],
                    'data': ai_result['data']
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


def parse_speaker_from_content(content: str) -> Dict[str, str] | None:
    """
    Парсит спикера из строк вида:
    "Светлана Бойко, HRD IT, Кворум {ОЦЕНКА ПЕРСОНАЛА}"
    "- TRIAD-алгоритм: 5 шагов...\t12:15\t12:50\tСветлана Бойко, HRD IT, Кворум {ОЦЕНКА ПЕРСОНАЛА}"
    """
    # Ищем паттерн: Имя Фамилия, Должность, Компания {ТЕМА}
    pattern = r'([А-ЯЁ][а-яё]+(?:\s+[А-ЯЁ][а-яё]+)?),\s*([^,]+),\s*([^{]+)(?:\{([^}]+)\})?'
    match = re.search(pattern, content)
    
    if match:
        name = match.group(1).strip()
        job = match.group(2).strip()
        company = match.group(3).strip()
        topic = match.group(4).strip() if match.group(4) else ''
        
        # Извлекаем заголовок выступления (до времени)
        title_match = re.match(r'^-?\s*([^\t]+)', content)
        title = title_match.group(1).strip() if title_match else topic
        
        return {
            'name': name,
            'job': job,
            'company': company,
            'topic': topic,
            'title': title
        }
    
    return None


def generate_email_content_with_ai(
    theme: str, 
    knowledge: Dict[str, List], 
    template_html: str,
    openai_key: str
) -> Dict[str, Any]:
    """
    AI генерирует контент для email на основе темы и базы знаний
    
    Задачи AI:
    1. Найти 2-3 подходящих спикеров по теме
    2. Сформировать подводку (intro) с учётом болей аудитории
    3. Подготовить данные для всех переменных шаблона
    """
    # Извлекаем переменные из шаблона
    variables = extract_template_variables(template_html)
    
    # Формируем промпт для AI
    prompt = f"""Ты - маркетолог конференции по HR и обучению.

ЗАДАЧА: Сгенерировать email-рассылку на тему "{theme}"

БАЗА ЗНАНИЙ:

Спикеры ({len(knowledge['speakers'])} шт):
{json.dumps(knowledge['speakers'][:20], ensure_ascii=False, indent=2)}

Боли аудитории (примеры):
{json.dumps(knowledge['pain_points'][:5], ensure_ascii=False, indent=2)}

ШАБЛОН ПИСЬМА требует заполнить:
{json.dumps(variables, ensure_ascii=False, indent=2)}

ТРЕБОВАНИЯ:
1. Выбери 2-3 НАИБОЛЕЕ релевантных спикера по теме "{theme}"
2. Напиши цепляющую подводку (intro_text), которая:
   - Отражает боль аудитории
   - Плавно подводит к спикерам
   - Максимум 2-3 предложения
3. Заполни ВСЕ переменные шаблона

ОТВЕТ В JSON:
{{
  "reasoning": "Почему выбраны эти спикеры и эта подводка",
  "selected_speakers": ["Имя 1", "Имя 2"],
  "data": {{
    "greeting": "Здравствуйте",
    "intro_text": "...",
    "speakers": [
      {{"name": "...", "job": "...", "company": "...", "title": "...", "topic": "..."}}
    ],
    ...все остальные переменные...
  }}
}}"""

    # Вызываем OpenAI
    response = requests.post(
        'https://api.openai.com/v1/chat/completions',
        headers={
            'Authorization': f'Bearer {openai_key}',
            'Content-Type': 'application/json'
        },
        json={
            'model': 'gpt-4o-mini',
            'messages': [
                {'role': 'system', 'content': 'Ты - эксперт по email-маркетингу для HR-конференций. Отвечай только валидным JSON.'},
                {'role': 'user', 'content': prompt}
            ],
            'temperature': 0.7,
            'response_format': {'type': 'json_object'}
        }
    )
    
    if response.status_code != 200:
        raise Exception(f'OpenAI API error: {response.text}')
    
    result = response.json()
    content = result['choices'][0]['message']['content']
    
    return json.loads(content)


def extract_template_variables(template_html: str) -> List[str]:
    """
    Извлекает все переменные из шаблона {{var_name|default}} или {{var_name}}
    """
    # Ищем переменные с дефолтами: {{var|default}}
    pattern_with_default = r'\{\{([a-zA-Z_0-9]+)\|[^}]*\}\}'
    vars_with_default = re.findall(pattern_with_default, template_html)
    
    # Ищем переменные без дефолтов: {{var}}
    pattern_no_default = r'\{\{([a-zA-Z_0-9]+)\}\}'
    vars_no_default = re.findall(pattern_no_default, template_html)
    
    return list(set(vars_with_default + vars_no_default))