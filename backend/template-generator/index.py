import json
import os
import re
from typing import Dict, Any
import psycopg2
import requests

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Business: Преобразует HTML в Mustache шаблон через Claude 3.5 Sonnet
    Args: event - dict с httpMethod, body {html_content: str, event_id: int, content_type_id: int, name: str}
    Returns: HTTP response с созданными template_id (оригинал + шаблон)
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
        
        html_content = body_data.get('html_content')
        event_id = body_data.get('event_id')
        content_type_id = body_data.get('content_type_id')
        template_name = body_data.get('name', 'Шаблон')
        
        print(f"[INFO] Processing HTML: {len(html_content) if html_content else 0} chars")
        
        if not html_content:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'html_content required'})
            }
        
        if not event_id or not content_type_id:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'event_id and content_type_id required'})
            }
        
        db_url = os.environ.get('DATABASE_URL', '')
        if not db_url:
            return {
                'statusCode': 500,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'DATABASE_URL not configured'})
            }
        
        openrouter_key = os.environ.get('OPENROUTER_API_KEY', '')
        if not openrouter_key:
            return {
                'statusCode': 500,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'OPENROUTER_API_KEY not configured'})
            }
        
        try:
            html_with_slots = convert_to_template_ai(html_content, openrouter_key)
            
            conn = psycopg2.connect(db_url)
            cur = conn.cursor()
            
            cur.execute(
                "INSERT INTO t_p22819116_event_schedule_app.email_templates " +
                "(event_id, content_type_id, name, html_template, is_example) VALUES " +
                "(%s, %s, %s, %s, %s) RETURNING id",
                (event_id, content_type_id, f"{template_name} (Оригинал)", html_content, True)
            )
            example_id = cur.fetchone()[0]
            
            slots_schema = {
                "intro_heading": "string",
                "intro_text": "string",
                "subheading": "string",
                "cta_text": "string",
                "cta_url": "string",
                "speakers": "array"
            }
            
            cur.execute(
                "INSERT INTO t_p22819116_event_schedule_app.email_templates " +
                "(event_id, content_type_id, name, html_template, html_layout, slots_schema, is_example) VALUES " +
                "(%s, %s, %s, %s, %s, %s, %s) RETURNING id",
                (event_id, content_type_id, template_name, html_with_slots, html_with_slots, json.dumps(slots_schema), False)
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
                    'notes': 'Создан эталон (is_example=true) и рабочий шаблон со слотами'
                })
            }
            
        except Exception as e:
            print(f'[ERROR] {str(e)}')
            return {
                'statusCode': 500,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': f'Failed to generate template: {str(e)}'})
            }
    
    return {
        'statusCode': 405,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'body': json.dumps({'error': 'Method not allowed'})
    }

def convert_to_template_ai(html: str, api_key: str) -> str:
    """
    Преобразует HTML в Mustache шаблон через Claude 3.5 Sonnet
    
    Инструкции для ИИ:
    1. Найди ВСЕ динамические элементы (заголовки, тексты, ссылки, изображения)
    2. Замени их на {{mustache_переменные}} с понятными именами
    3. Повторяющиеся блоки оберни в {{#массив}}...{{/массив}}
    4. Верни ТОЛЬКО HTML, без объяснений
    """
    
    prompt = f"""Convert HTML email to Mustache template. CRITICAL: Keep ALL styles (gradients, colors, fonts). Replace ONLY text/URLs with {{{{variables}}}}. Return ONLY HTML.

HTML:
{html}"""

    try:
        response = requests.post(
            'https://openrouter.ai/api/v1/chat/completions',
            headers={
                'Authorization': f'Bearer {api_key}',
                'Content-Type': 'application/json'
            },
            json={
                'model': 'openai/gpt-4o-mini',
                'messages': [{'role': 'user', 'content': prompt}],
                'max_tokens': 16000,
                'temperature': 0.3
            },
            timeout=60
        )
        
        if response.status_code != 200:
            print(f"[ERROR] OpenRouter failed: {response.status_code} {response.text}")
            raise Exception(f"OpenRouter error: {response.status_code}")
        
        result = response.json()
        html_result = result['choices'][0]['message']['content'].strip()
        
        # Убираем markdown обёртки если ИИ добавил
        html_result = re.sub(r'^```html\s*', '', html_result)
        html_result = re.sub(r'\s*```$', '', html_result)
        
        print(f"[INFO] AI conversion: {len(html)} → {len(html_result)} chars")
        return html_result
        
    except Exception as e:
        print(f"[ERROR] AI conversion failed: {str(e)}")
        raise Exception(f"Template conversion failed: {str(e)}")