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
    https_proxy = os.environ.get('HTTPS_PROXY')
    
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
        
        if https_proxy:
            http_client = httpx.Client(proxy=https_proxy)
        else:
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
        
        # Подготовка данных о переменных с ограничениями
        vars_with_limits = []
        for var in manual_variables:
            var_info = {
                'name': var['name'],
                'description': var['description'],
                'source': var['source'],
                'original_length': len(var['content']),
                'original_preview': var['content'][:100] + '...' if len(var['content']) > 100 else var['content']
            }
            vars_with_limits.append(var_info)
        
        prompt = f"""Ты - профессиональный копирайтер email-рассылок для бизнес-конференций.

КРИТИЧЕСКИ ВАЖНО: Сохраняй HTML-дизайн! Не добавляй теги, если их нет. Соблюдай длину текста.

Тема письма: {topic}

Контекст из базы знаний мероприятия:
{knowledge_context if knowledge_context else 'Используй общие знания о теме'}

Переменные для генерации (с ограничениями):
{json.dumps(vars_with_limits, ensure_ascii=False, indent=2)}

СТРОГИЕ ТРЕБОВАНИЯ:
1. **Длина**: Сохраняй длину ±20% от original_length (критично для дизайна!)
2. **Стиль**: Копируй тон и структуру из original_preview
3. **HTML**: НЕ добавляй HTML теги если их нет в оригинале
4. **Логотип/Футер**: НЕ меняй (они фиксированные для мероприятия)
5. **knowledge_base**: Используй контекст выше для точности
6. **user_input**: Оставь как есть или адаптируй минимально

ПРИМЕРЫ качественного контента:
- pain (вступление): "В 2024 рынок X столкнулся с проблемой Y. Мы собрали 10+ экспертов, которые решили это."
- speakers: Формат JSON массива с name, title, pitch, photo_url
- cta_text: "Зарегистрироваться бесплатно" или "Получить программу"

Верни ТОЛЬКО JSON без markdown, без ```json:
{{
  "variable_name": "значение",
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
                new_content = variables_filled[var_name]
                
                # Обработка разных типов данных
                if isinstance(new_content, (list, dict)):
                    new_content = json.dumps(new_content, ensure_ascii=False)
                new_content = str(new_content)
                
                # Заменяем mustache-переменную на сгенерированный контент
                generated_html = generated_html.replace(f'{{{{{var_name}}}}}', new_content)
        
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