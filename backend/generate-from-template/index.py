import json
import os
import psycopg2
from typing import Dict, Any, List
import anthropic

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Business: Генерация письма на основе размеченного шаблона и темы
    Args: event с body: {template_id, topic, knowledge_context}
    Returns: {generated_html, variables_filled: {...}}
    '''
    method: str = event.get('httpMethod', 'POST')
    
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
    
    if method != 'POST':
        return {
            'statusCode': 405,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Method not allowed'})
        }
    
    body_data = json.loads(event.get('body', '{}'))
    template_id: int = body_data.get('template_id')
    topic: str = body_data.get('topic', '')
    knowledge_context: str = body_data.get('knowledge_context', '')
    
    if not template_id or not topic:
        return {
            'statusCode': 400,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'template_id and topic required'})
        }
    
    dsn = os.environ.get('DATABASE_URL')
    api_key = os.environ.get('ANTHROPIC_API_KEY')
    
    if not dsn or not api_key:
        return {
            'statusCode': 500,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'DATABASE_URL or ANTHROPIC_API_KEY not configured'})
        }
    
    conn = psycopg2.connect(dsn)
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT html_template, manual_variables, name
                FROM t_p22819116_event_schedule_app.email_templates
                WHERE id = %s
            """, (template_id,))
            
            row = cur.fetchone()
            if not row:
                return {
                    'statusCode': 404,
                    'headers': {'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Template not found'})
                }
            
            html_template = row[0]
            manual_variables = row[1] or []
            template_name = row[2]
        
        client = anthropic.Anthropic(api_key=api_key)
        
        variables_to_generate = []
        for var in manual_variables:
            variables_to_generate.append({
                'name': var['name'],
                'description': var['description'],
                'source': var['source'],
                'original_content': var['content']
            })
        
        prompt = f"""Сгенерируй содержимое для переменных email-письма на основе темы.

Тема письма: {topic}

Контекст из базы знаний:
{knowledge_context if knowledge_context else 'Нет дополнительного контекста'}

Переменные для генерации:
{json.dumps(variables_to_generate, ensure_ascii=False, indent=2)}

Требования:
1. Генерируй текст строго по описанию каждой переменной
2. Учитывай тему письма и контекст
3. Сохраняй стиль оригинального контента
4. Если источник "knowledge_base" - используй контекст выше
5. Если источник "ai_generated" - придумай релевантный контент

Верни JSON в формате:
{{
  "variable_name": "сгенерированное значение",
  ...
}}"""

        message = client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=4000,
            messages=[{
                "role": "user",
                "content": prompt
            }]
        )
        
        response_text = message.content[0].text
        
        json_start = response_text.find('{')
        json_end = response_text.rfind('}') + 1
        if json_start != -1 and json_end > json_start:
            response_text = response_text[json_start:json_end]
        
        variables_filled = json.loads(response_text)
        
        generated_html = html_template
        for var in manual_variables:
            var_name = var['name']
            if var_name in variables_filled:
                original_content = var['content']
                new_content = variables_filled[var_name]
                generated_html = generated_html.replace(original_content, new_content, 1)
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'success': True,
                'generated_html': generated_html,
                'variables_filled': variables_filled,
                'template_name': template_name
            }, ensure_ascii=False)
        }
        
    finally:
        conn.close()
