import json
import os
from typing import Dict, Any
import urllib.request
import urllib.parse

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Business: Генерирует HTML-письмо и тему через OpenAI на основе программы мероприятия и болей ЦА
    Args: event - dict с httpMethod, body (program_text, pain_points_text, tone)
    Returns: HTTP response с темой письма и HTML-контентом
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
        
        program_text = body_data.get('program_text', '')
        pain_points_text = body_data.get('pain_points_text', '')
        tone = body_data.get('tone', 'professional')
        
        if not program_text or not pain_points_text:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'program_text and pain_points_text required'})
            }
        
        api_key = os.environ.get('OPENAI_API_KEY', '')
        
        if not api_key:
            return {
                'statusCode': 500,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'OPENAI_API_KEY not configured'})
            }
        
        prompt = f"""Ты — эксперт по HR-коммуникациям. На основе программы мероприятия и болей целевой аудитории создай:
1. Цепляющую тему письма (до 50 символов)
2. HTML-письмо в профессиональном стиле

Программа мероприятия:
{program_text}

Боли целевой аудитории:
{pain_points_text}

Тон: {tone}

Требования к письму:
- Персонализированное обращение
- Акцент на решение конкретных болей через темы мероприятия
- Призыв к действию (CTA)
- Мобильная адаптивность HTML
- Профессиональный дизайн

Верни JSON в формате:
{{"subject": "тема письма", "html": "HTML код письма"}}
"""
        
        openai_data = {
            'model': 'gpt-4o-mini',
            'messages': [
                {'role': 'system', 'content': 'Ты эксперт по email-маркетингу и HR-коммуникациям. Отвечаешь только валидным JSON.'},
                {'role': 'user', 'content': prompt}
            ],
            'temperature': 0.7,
            'max_tokens': 2000,
            'response_format': {'type': 'json_object'}
        }
        
        req = urllib.request.Request(
            'https://api.openai.com/v1/chat/completions',
            data=json.dumps(openai_data).encode('utf-8'),
            headers={
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {api_key}'
            }
        )
        
        with urllib.request.urlopen(req) as response:
            result = json.loads(response.read().decode('utf-8'))
            content = result['choices'][0]['message']['content']
            generated = json.loads(content)
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({
                    'subject': generated.get('subject', 'Письмо от HR'),
                    'html': generated.get('html', '<p>Контент письма</p>'),
                    'request_id': context.request_id
                })
            }
    
    return {
        'statusCode': 405,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'body': json.dumps({'error': 'Method not allowed'})
    }