import json
import os
import re
from typing import Dict, Any
import psycopg2

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Business: Преобразует HTML в Mustache шаблон по жёстким правилам (БЕЗ ИИ)
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
        
        try:
            html_with_slots = convert_to_template(html_content)
            
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

def convert_to_template(html: str) -> str:
    """
    Преобразует HTML в Mustache шаблон по жёстким правилам (regex)
    
    Правила:
    1. Заголовки <h1>, <h2> → {{intro_heading}}
    2. Первый <p> после заголовка → {{intro_text}}
    3. href="#" в кнопке → {{cta_url}}
    4. Текст кнопки → {{cta_text}}
    5. Подзаголовки → {{subheading}}
    6. Блоки спикеров → {{#speakers}}...{{/speakers}}
    """
    result = html
    
    result = re.sub(
        r'<h1[^>]*>.*?</h1>',
        '<h1>{{intro_heading}}</h1>',
        result,
        count=1,
        flags=re.DOTALL | re.IGNORECASE
    )
    
    result = re.sub(
        r'(<h[12][^>]*>.*?</h[12]>)\s*<p[^>]*>(.*?)</p>',
        r'\1<p>{{intro_text}}</p>',
        result,
        count=1,
        flags=re.DOTALL | re.IGNORECASE
    )
    
    result = re.sub(
        r'<a\s+([^>]*href=)["\']#["\']([^>]*)>(.*?)</a>',
        r'<a \1"{{cta_url}}"\2>{{cta_text}}</a>',
        result,
        count=1,
        flags=re.DOTALL | re.IGNORECASE
    )
    
    result = re.sub(
        r'<h2[^>]*>.*?</h2>',
        '<h2>{{subheading}}</h2>',
        result,
        count=1,
        flags=re.DOTALL | re.IGNORECASE
    )
    
    if 'спикер' in result.lower() or 'speaker' in result.lower():
        speaker_pattern = r'(<!--\s*Спикер.*?-->.*?</tr>)'
        matches = list(re.finditer(speaker_pattern, result, re.DOTALL | re.IGNORECASE))
        
        if len(matches) >= 2:
            first_start = matches[0].start()
            last_end = matches[-1].end()
            
            speaker_block = result[first_start:last_end]
            speaker_block = re.sub(r'<img\s+src="[^"]*"', '<img src="{{photo_url}}"', speaker_block, count=1)
            speaker_block = re.sub(r'alt="[^"]*"', 'alt="{{name}}"', speaker_block, count=1)
            
            result = result[:first_start] + '{{#speakers}}' + speaker_block + '{{/speakers}}' + result[last_end:]
    
    print(f"[INFO] Template conversion complete. Original: {len(html)} chars, Result: {len(result)} chars")
    
    return result