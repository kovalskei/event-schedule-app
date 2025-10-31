import json
import os
from typing import Dict, Any
import urllib.request
import psycopg2

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Business: Преобразует HTML в шаблон со слотами И создаёт новый шаблон в БД + сохраняет оригинал как пример
    Args: event - dict с httpMethod, body {html_content: str, event_id: int, content_type_id: int, name: str}
    Returns: HTTP response с созданным template_id
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
        template_name = body_data.get('name', 'Сгенерированный шаблон')
        
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
        
        prompt = f"""Преобразуй HTML в Mustache шаблон. Верни ТОЛЬКО валидный JSON без текста.

HTML:
{html_content[:2000]}

Замени динамический контент на {{{{слоты}}}}: headline, intro_text, #speakers (name, title, pitch), cta_text, cta_url

Формат ответа (ТОЛЬКО JSON):
{{{{
  "html_layout": "HTML с {{{{слотами}}}}",
  "slots_schema": {{"headline": "string", "intro_text": "string", "speakers": [{{"name": "string", "title": "string", "pitch": "string", "photo_url": "string"}}], "cta_text": "string", "cta_url": "string", "subject": "string"}},
  "notes": "Кратко"
}}}}"""
        
        try:
            generated = call_openrouter(prompt, openrouter_key)
            
            json_str = generated.strip()
            
            if '```json' in json_str:
                start = json_str.find('```json') + 7
                end = json_str.find('```', start)
                json_str = json_str[start:end].strip()
            elif '```' in json_str:
                start = json_str.find('```') + 3
                end = json_str.find('```', start)
                json_str = json_str[start:end].strip()
            
            json_start = json_str.find('{')
            json_end = json_str.rfind('}') + 1
            if json_start != -1 and json_end > json_start:
                json_str = json_str[json_start:json_end]
            
            result = json.loads(json_str)
            
            html_layout = result.get('html_layout', '')
            slots_schema = result.get('slots_schema', {})
            
            conn = psycopg2.connect(db_url)
            cur = conn.cursor()
            
            cur.execute(
                "SELECT email_template_examples FROM t_p22819116_event_schedule_app.events WHERE id = %s",
                (event_id,)
            )
            examples_row = cur.fetchone()
            
            existing_examples = examples_row[0] if examples_row and examples_row[0] else ''
            updated_examples = existing_examples + '\n\n--- НОВЫЙ ПРИМЕР ---\n' + html_content if existing_examples else html_content
            
            cur.execute(
                "UPDATE t_p22819116_event_schedule_app.events SET email_template_examples = %s WHERE id = %s",
                (updated_examples, event_id)
            )
            
            cur.execute(
                "INSERT INTO t_p22819116_event_schedule_app.email_templates " +
                "(event_id, content_type_id, name, html_template, html_layout, slots_schema, instructions) VALUES " +
                "(%s, %s, %s, %s, %s, %s, %s) RETURNING id",
                (event_id, content_type_id, template_name, '', html_layout, json.dumps(slots_schema), 'Автоматически сгенерирован из HTML примера')
            )
            
            new_template_id = cur.fetchone()[0]
            
            conn.commit()
            cur.close()
            conn.close()
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({
                    'success': True,
                    'template_id': new_template_id,
                    'html_layout': html_layout[:500] + '...' if len(html_layout) > 500 else html_layout,
                    'slots_schema': slots_schema,
                    'notes': result.get('notes', 'Шаблон преобразован'),
                    'original_saved': True
                })
            }
        except Exception as e:
            return {
                'statusCode': 500,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({
                    'error': f'Failed to generate template: {str(e)}',
                    'raw_response': generated if 'generated' in locals() else None
                })
            }
    
    return {
        'statusCode': 405,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'body': json.dumps({'error': 'Method not allowed'})
    }

def call_openrouter(prompt: str, api_key: str) -> str:
    """Вызывает OpenRouter Chat API"""
    data = {
        'model': 'openai/gpt-4o-mini',
        'messages': [{'role': 'user', 'content': prompt}],
        'temperature': 0.3
    }
    
    req = urllib.request.Request(
        'https://openrouter.ai/api/v1/chat/completions',
        data=json.dumps(data).encode('utf-8'),
        headers={
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {api_key}',
            'HTTP-Referer': 'https://poehali.dev',
            'X-Title': 'Event Schedule App'
        }
    )
    
    with urllib.request.urlopen(req, timeout=25) as response:
        result = json.loads(response.read().decode('utf-8'))
        return result['choices'][0]['message']['content']