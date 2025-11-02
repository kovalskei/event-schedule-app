import json
import os
import psycopg2
from typing import Dict, Any
from openai import OpenAI
import httpx

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Business: Генерация письма на основе размеченного шаблона
    Args: event с body: {template_id, topic, knowledge_context}
    Returns: {generated_html, variables_filled}
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
    openai_key = os.environ.get('OPENAI_API_KEY')
    openrouter_key = os.environ.get('OPENROUTER_API_KEY')
    
    if not dsn:
        return {
            'statusCode': 500,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'DATABASE_URL not configured'})
        }
    
    if not openai_key and not openrouter_key:
        return {
            'statusCode': 500,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'OPENAI_API_KEY or OPENROUTER_API_KEY required'})
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
        
        http_client = httpx.Client()
        
        if openrouter_key:
            client = OpenAI(
                base_url="https://openrouter.ai/api/v1",
                api_key=openrouter_key,
                http_client=http_client
            )
            model = "openai/gpt-4o-mini"
        else:
            client = OpenAI(
                api_key=openai_key,
                http_client=http_client
            )
            model = "gpt-4o-mini"
        
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

Верни ТОЛЬКО JSON без дополнительного текста в формате:
{{
  "variable_name": "сгенерированное значение",
  ...
}}"""

        completion = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=4000
        )
        
        response_text = completion.choices[0].message.content
        
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