import json
import os
from typing import Dict, Any
import urllib.request

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Business: Преобразует обычный HTML в шаблон со слотами для V2 pipeline
    Args: event - dict с httpMethod, body {html_content: str}
    Returns: HTTP response с html_layout (Mustache шаблон) и slots_schema (JSON схема)
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
        
        if not html_content:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'html_content required'})
            }
        
        openrouter_key = os.environ.get('OPENROUTER_API_KEY', '')
        if not openrouter_key:
            return {
                'statusCode': 500,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'OPENROUTER_API_KEY not configured'})
            }
        
        prompt = f"""Ты — эксперт по преобразованию HTML email-шаблонов в структурированные шаблоны со слотами.

ЗАДАЧА:
Преобразуй этот HTML шаблон в формат Mustache (слоты) для автоматической генерации писем.

ИСХОДНЫЙ HTML:
{html_content}

ПРАВИЛА ПРЕОБРАЗОВАНИЯ:
1. Определи динамические части контента (заголовки, текст, списки)
2. Замени их на слоты Mustache: {{{{slot_name}}}}
3. Для повторяющихся блоков используй: {{{{#items}}}}...{{{{/items}}}}
4. Сохрани всю CSS стилизацию БЕЗ изменений
5. Сохрани структуру таблиц для email-вёрстки

СТАНДАРТНЫЕ СЛОТЫ:
- {{{{headline}}}} — главный заголовок
- {{{{intro_text}}}} — вступительный текст (2-3 предложения)
- {{{{#speakers}}}} — блок спикеров (повторяющийся)
  - {{{{name}}}} — имя спикера
  - {{{{title}}}} — должность
  - {{{{pitch}}}} — описание доклада (1 предложение)
  - {{{{photo_url}}}} — фото спикера
- {{{{cta_text}}}} — текст кнопки призыва к действию
- {{{{cta_url}}}} — ссылка кнопки

ДОПОЛНИТЕЛЬНЫЕ СЛОТЫ (если нужны):
- {{{{event_name}}}} — название мероприятия
- {{{{event_date}}}} — дата
- {{{{logo_url}}}} — логотип
- {{{{unsubscribe_url}}}} — ссылка отписки

Верни JSON в формате:
{{{{
  "html_layout": "HTML с Mustache слотами",
  "slots_schema": {{{{
    "headline": "string",
    "intro_text": "string",
    "speakers": [{{{{
      "name": "string",
      "title": "string", 
      "pitch": "string",
      "photo_url": "string"
    }}}}],
    "cta_text": "string",
    "cta_url": "string",
    "subject": "string"
  }}}},
  "recommended_slots": ["список слотов которые ты определил"],
  "notes": "Краткие пояснения об изменениях"
}}}}

ВАЖНО: 
- НЕ меняй CSS стили
- НЕ меняй структуру таблиц
- Сохрани все атрибуты HTML (style, width, cellpadding и тд)
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
            
            result = json.loads(json_str)
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({
                    'success': True,
                    'html_layout': result.get('html_layout', ''),
                    'slots_schema': result.get('slots_schema', {}),
                    'recommended_slots': result.get('recommended_slots', []),
                    'notes': result.get('notes', '')
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
    
    with urllib.request.urlopen(req) as response:
        result = json.loads(response.read().decode('utf-8'))
        return result['choices'][0]['message']['content']