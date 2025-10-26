import json
import os
from typing import Dict, Any
import urllib.request
import urllib.parse

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Business: Генерирует HTML-письмо через OpenAI Assistants, GPT-4o, o1 или Claude
    Args: event - dict с httpMethod, body (program_text, pain_points_text, tone, ai_provider, model, assistant_id)
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
        ai_provider = body_data.get('ai_provider', 'openai')
        model = body_data.get('model', 'gpt-4o-mini')
        assistant_id = body_data.get('assistant_id', '')
        demo_mode = body_data.get('demo_mode', False)
        
        if not program_text or not pain_points_text:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'program_text and pain_points_text required'})
            }
        
        if demo_mode:
            return generate_demo_email(program_text, pain_points_text, tone, context)
        
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
        
        if ai_provider == 'openai':
            return handle_openai(prompt, model, assistant_id, context)
        elif ai_provider == 'claude':
            return handle_claude(prompt, model, context)
        else:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': f'Unsupported AI provider: {ai_provider}'})
            }
    
    return {
        'statusCode': 405,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'body': json.dumps({'error': 'Method not allowed'})
    }

def handle_openai(prompt: str, model: str, assistant_id: str, context: Any) -> Dict[str, Any]:
    api_key = os.environ.get('OPENAI_API_KEY', '')
    
    if not api_key:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'OPENAI_API_KEY not configured'})
        }
    
    if assistant_id:
        thread_data = {'messages': [{'role': 'user', 'content': prompt}]}
        
        thread_req = urllib.request.Request(
            'https://api.openai.com/v1/threads/runs',
            data=json.dumps({
                'assistant_id': assistant_id,
                'thread': thread_data
            }).encode('utf-8'),
            headers={
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {api_key}',
                'OpenAI-Beta': 'assistants=v2'
            }
        )
        
        with urllib.request.urlopen(thread_req) as response:
            run_result = json.loads(response.read().decode('utf-8'))
            run_id = run_result['id']
            thread_id = run_result['thread_id']
            
            import time
            for _ in range(30):
                time.sleep(2)
                
                status_req = urllib.request.Request(
                    f'https://api.openai.com/v1/threads/{thread_id}/runs/{run_id}',
                    headers={
                        'Authorization': f'Bearer {api_key}',
                        'OpenAI-Beta': 'assistants=v2'
                    }
                )
                
                with urllib.request.urlopen(status_req) as status_response:
                    status_data = json.loads(status_response.read().decode('utf-8'))
                    
                    if status_data['status'] == 'completed':
                        messages_req = urllib.request.Request(
                            f'https://api.openai.com/v1/threads/{thread_id}/messages',
                            headers={
                                'Authorization': f'Bearer {api_key}',
                                'OpenAI-Beta': 'assistants=v2'
                            }
                        )
                        
                        with urllib.request.urlopen(messages_req) as messages_response:
                            messages_data = json.loads(messages_response.read().decode('utf-8'))
                            content = messages_data['data'][0]['content'][0]['text']['value']
                            
                            try:
                                generated = json.loads(content)
                            except:
                                start = content.find('{')
                                end = content.rfind('}') + 1
                                if start >= 0 and end > start:
                                    generated = json.loads(content[start:end])
                                else:
                                    generated = {'subject': 'Письмо от HR', 'html': content}
                            
                            return {
                                'statusCode': 200,
                                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                                'body': json.dumps({
                                    'subject': generated.get('subject', 'Письмо от HR'),
                                    'html': generated.get('html', '<p>Контент письма</p>'),
                                    'request_id': context.request_id,
                                    'ai_provider': 'openai_assistant',
                                    'assistant_id': assistant_id
                                })
                            }
                    
                    elif status_data['status'] in ['failed', 'cancelled', 'expired']:
                        return {
                            'statusCode': 500,
                            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                            'body': json.dumps({'error': f"Assistant run {status_data['status']}"})
                        }
            
            return {
                'statusCode': 500,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'Assistant timeout'})
            }
    
    else:
        openai_data = {
            'model': model,
            'messages': [
                {'role': 'system', 'content': 'Ты эксперт по email-маркетингу и HR-коммуникациям. Отвечаешь только валидным JSON.'},
                {'role': 'user', 'content': prompt}
            ],
            'temperature': 0.7,
            'max_tokens': 2000
        }
        
        if model not in ['o1-preview', 'o1-mini']:
            openai_data['response_format'] = {'type': 'json_object'}
        
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
            
            try:
                generated = json.loads(content)
            except:
                start = content.find('{')
                end = content.rfind('}') + 1
                if start >= 0 and end > start:
                    generated = json.loads(content[start:end])
                else:
                    generated = {'subject': 'Письмо от HR', 'html': content}
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({
                    'subject': generated.get('subject', 'Письмо от HR'),
                    'html': generated.get('html', '<p>Контент письма</p>'),
                    'request_id': context.request_id,
                    'ai_provider': 'openai',
                    'model': model
                })
            }

def handle_claude(prompt: str, model: str, context: Any) -> Dict[str, Any]:
    api_key = os.environ.get('ANTHROPIC_API_KEY', '')
    
    if not api_key:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'ANTHROPIC_API_KEY not configured'})
        }
    
    claude_data = {
        'model': model if model.startswith('claude-') else 'claude-3-5-sonnet-20241022',
        'max_tokens': 2000,
        'system': 'Ты эксперт по email-маркетингу и HR-коммуникациям. Отвечаешь только валидным JSON без markdown форматирования.',
        'messages': [
            {'role': 'user', 'content': prompt}
        ]
    }
    
    req = urllib.request.Request(
        'https://api.anthropic.com/v1/messages',
        data=json.dumps(claude_data).encode('utf-8'),
        headers={
            'Content-Type': 'application/json',
            'x-api-key': api_key,
            'anthropic-version': '2023-06-01'
        }
    )
    
    with urllib.request.urlopen(req) as response:
        result = json.loads(response.read().decode('utf-8'))
        content = result['content'][0]['text']
        
        try:
            generated = json.loads(content)
        except:
            start = content.find('{')
            end = content.rfind('}') + 1
            if start >= 0 and end > start:
                generated = json.loads(content[start:end])
            else:
                generated = {'subject': 'Письмо от HR', 'html': content}
        
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({
                'subject': generated.get('subject', 'Письмо от HR'),
                'html': generated.get('html', '<p>Контент письма</p>'),
                'request_id': context.request_id,
                'ai_provider': 'claude',
                'model': claude_data['model']
            })
        }

def generate_demo_email(program_text: str, pain_points_text: str, tone: str, context: Any) -> Dict[str, Any]:
    program_topics = [line.strip() for line in program_text.split('\n') if line.strip()]
    pain_points = [line.strip() for line in pain_points_text.split('\n') if line.strip()]
    
    first_topic = program_topics[0] if program_topics else "HR мероприятие"
    first_pain = pain_points[0] if pain_points else "актуальные вызовы"
    
    subject = f"Решаем {first_pain}: {first_topic}"
    
    topics_html = ""
    for i, topic in enumerate(program_topics[:3], 1):
        topics_html += f"""
        <tr>
            <td style="padding: 15px 0; border-bottom: 1px solid #e0e0e0;">
                <div style="display: flex; align-items: start;">
                    <div style="background: #4F46E5; color: white; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; margin-right: 15px; flex-shrink: 0;">{i}</div>
                    <div>
                        <h3 style="margin: 0 0 5px 0; color: #1a1a1a; font-size: 16px;">{topic}</h3>
                    </div>
                </div>
            </td>
        </tr>
        """
    
    pains_html = ""
    for pain in pain_points[:3]:
        pains_html += f'<li style="margin-bottom: 10px; color: #4a5568;">{pain}</li>'
    
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f7fafc;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f7fafc; padding: 40px 20px;">
            <tr>
                <td align="center">
                    <table width="600" cellpadding="0" cellspacing="0" style="background-color: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                        <tr>
                            <td style="padding: 40px 30px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px 8px 0 0; text-align: center;">
                                <h1 style="margin: 0; color: white; font-size: 28px; font-weight: 700;">Приглашаем на мероприятие</h1>
                            </td>
                        </tr>
                        
                        <tr>
                            <td style="padding: 30px;">
                                <p style="color: #2d3748; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                                    Здравствуйте!
                                </p>
                                
                                <p style="color: #2d3748; font-size: 16px; line-height: 1.6; margin: 0 0 25px 0;">
                                    Мы знаем, с какими вызовами вы сталкиваетесь:
                                </p>
                                
                                <ul style="color: #4a5568; font-size: 15px; line-height: 1.8; margin: 0 0 25px 0; padding-left: 20px;">
                                    {pains_html}
                                </ul>
                                
                                <p style="color: #2d3748; font-size: 16px; line-height: 1.6; margin: 0 0 25px 0;">
                                    Поэтому мы подготовили для вас специальную программу:
                                </p>
                                
                                <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 30px;">
                                    {topics_html}
                                </table>
                                
                                <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                                    <tr>
                                        <td align="center">
                                            <a href="#" style="display: inline-block; padding: 16px 40px; background: #4F46E5; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
                                                Зарегистрироваться
                                            </a>
                                        </td>
                                    </tr>
                                </table>
                                
                                <p style="color: #718096; font-size: 14px; line-height: 1.6; margin: 25px 0 0 0; padding-top: 25px; border-top: 1px solid #e2e8f0;">
                                    С уважением,<br>
                                    Команда организаторов
                                </p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """
    
    return {
        'statusCode': 200,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'body': json.dumps({
            'subject': subject[:50],
            'html': html,
            'request_id': context.request_id,
            'ai_provider': 'demo',
            'model': 'demo'
        })
    }