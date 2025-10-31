import json
import os
from typing import Dict, Any, List
import psycopg2
import urllib.request

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Business: Проверяет сгенерированное письмо на соответствие стилям загруженных примеров
    Args: event - dict с httpMethod, body {event_id: int, generated_html: str}
    Returns: HTTP response с результатами валидации (score, suggestions, issues)
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
        
        draft_id = body_data.get('draft_id')
        event_id = body_data.get('event_id')
        content_type_id = body_data.get('content_type_id')
        generated_html = body_data.get('generated_html')
        
        if not draft_id and not (event_id and content_type_id and generated_html):
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'Either draft_id or (event_id + content_type_id + generated_html) required'})
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
        
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()
        
        if draft_id:
            cur.execute(
                "SELECT html_body, event_id, content_type_id FROM t_p22819116_event_schedule_app.generated_emails WHERE id = %s",
                (draft_id,)
            )
            draft_row = cur.fetchone()
            if not draft_row:
                cur.close()
                conn.close()
                return {
                    'statusCode': 404,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Draft not found'})
                }
            
            generated_html = draft_row[0]
            event_id = draft_row[1]
            content_type_id = draft_row[2]
        
        cur.execute(
            "SELECT html_template FROM t_p22819116_event_schedule_app.email_templates " +
            "WHERE event_id = %s AND content_type_id = %s AND is_example = true LIMIT 1",
            (event_id, content_type_id)
        )
        
        example_row = cur.fetchone()
        
        if not example_row:
            cur.close()
            conn.close()
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({
                    'error': 'No example template found (is_example=true)',
                    'suggestion': 'Create example template via template-generator first'
                })
            }
        
        template_examples = example_row[0]
        
        prompt = f"""Ты — эксперт по email-дизайну и HTML вёрстке.

ЗАДАЧА:
Проверь сгенерированное письмо на соответствие стилю эталонных примеров.

ЭТАЛОННЫЕ ПРИМЕРЫ:
{template_examples}

СГЕНЕРИРОВАННОЕ ПИСЬМО:
{generated_html}

КРИТЕРИИ ПРОВЕРКИ:
1. **Цветовая палитра** — используются ли те же цвета что и в примерах?
2. **Типографика** — соответствуют ли шрифты, размеры, начертания?
3. **Структура** — соблюдена ли общая композиция (header, hero, content, footer)?
4. **Отступы и интервалы** — похожи ли paddings и margins?
5. **Кнопки CTA** — стиль, размер, цвет кнопок соответствует примерам?
6. **Адаптивность** — используются ли таблицы и media queries как в примерах?
7. **Брендинг** — логотип, подпись, контакты оформлены как в примерах?

ОЦЕНКА:
- Для каждого критерия: оценка от 0 до 10
- Общий score: среднее арифметическое

Верни JSON в формате:
{{{{
  "overall_score": 8.5,
  "criteria": {{{{
    "colors": {{{{"score": 9, "note": "Цвета соответствуют, кроме оттенка кнопки"}}}},
    "typography": {{{{"score": 8, "note": "Размер шрифта немного отличается"}}}},
    "structure": {{{{"score": 10, "note": "Структура полностью соответствует"}}}},
    "spacing": {{{{"score": 7, "note": "Отступы между блоками меньше чем в примерах"}}}},
    "cta_buttons": {{{{"score": 9, "note": "Кнопки оформлены корректно"}}}},
    "responsive": {{{{"score": 8, "note": "Таблицы используются правильно"}}}},
    "branding": {{{{"score": 10, "note": "Логотип и подпись на месте"}}}}
  }}}},
  "issues": [
    "Цвет кнопки #7B2CBF вместо #AE32E3",
    "Отступы между карточками спикеров: 10px вместо 20px"
  ],
  "suggestions": [
    "Увеличить padding блока hero до 40px",
    "Использовать font-size: 16px для основного текста"
  ],
  "passed": true
}}}}

ВАЖНО:
- overall_score >= 7.0 считается passed = true
- Укажи конкретные значения (пиксели, цвета, размеры)
- Будь объективным но не придирчивым
"""
        
        try:
            generated = call_openrouter(prompt, openrouter_key)
            
            json_str = generated.strip()
            if json_str.startswith('```json'):
                json_str = json_str[7:]
            if json_str.startswith('```'):
                json_str = json_str[3:]
            if json_str.endswith('```'):
                json_str = json_str[:-3]
            json_str = json_str.strip()
            
            validation_result = json.loads(json_str)
            
            if draft_id:
                conn = psycopg2.connect(db_url)
                cur = conn.cursor()
                
                validation_status = 'passed' if validation_result.get('passed') else 'failed'
                validation_notes = json.dumps(validation_result, ensure_ascii=False)
                
                cur.execute(
                    "UPDATE t_p22819116_event_schedule_app.generated_emails " +
                    "SET validation_status = %s, validation_notes = %s WHERE id = %s",
                    (validation_status, validation_notes, draft_id)
                )
                
                conn.commit()
                cur.close()
                conn.close()
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({
                    'success': True,
                    'validation': validation_result
                })
            }
        except Exception as e:
            return {
                'statusCode': 500,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({
                    'error': f'Failed to validate style: {str(e)}',
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
    
    with urllib.request.urlopen(req) as response:
        result = json.loads(response.read().decode('utf-8'))
        return result['choices'][0]['message']['content']