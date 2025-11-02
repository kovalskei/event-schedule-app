import json
import os
import psycopg2
from typing import Dict, Any, List

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Business: Сохранение вручную размеченного HTML шаблона с переменными
    Args: event с body: {name, description, html_content, manual_variables[]}
    Returns: {success, template_id}
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
    name: str = body_data.get('name', '')
    description: str = body_data.get('description', '')
    html_content: str = body_data.get('html_content', '')
    original_html: str = body_data.get('original_html', '')  # Опционально из автоанализа
    manual_variables: List[Dict[str, Any]] = body_data.get('manual_variables', [])
    
    if not name or not html_content:
        return {
            'statusCode': 400,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Name and html_content required'})
        }
    
    dsn = os.environ.get('DATABASE_URL')
    if not dsn:
        return {
            'statusCode': 500,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'DATABASE_URL not configured'})
        }
    
    # Если original_html передан (из автоанализа), используем готовый шаблон
    if original_html:
        html_template = html_content  # Уже содержит {{плейсхолдеры}}
        original_html_to_save = original_html
        print(f'[INFO] Using pre-processed template from auto-analysis')
    else:
        # Создаём шаблон с плейсхолдерами {{variable_name}} из ручной разметки
        html_template = html_content
        
        # Сортируем переменные по startIndex в обратном порядке (с конца)
        sorted_vars = sorted(manual_variables, key=lambda v: v.get('startIndex', 0), reverse=True)
        
        for var in sorted_vars:
            start = var.get('startIndex', 0)
            end = var.get('endIndex', 0)
            var_name = var.get('name', '')
            
            if start >= 0 and end > start and var_name:
                # Заменяем выделенный текст на плейсхолдер
                html_template = html_template[:start] + '{{' + var_name + '}}' + html_template[end:]
        
        original_html_to_save = html_content  # Оригинал = исходный HTML
        print(f'[INFO] Created template with {len(manual_variables)} placeholders from manual markup')
    
    conn = psycopg2.connect(dsn)
    try:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO t_p22819116_event_schedule_app.email_templates 
                (event_id, content_type_id, name, html_template, original_html, 
                 manual_variables, instructions, is_example)
                VALUES (1, 1, %s, %s, %s, %s, %s, true)
                RETURNING id
            """, (
                name,
                html_template,  # Шаблон с {{плейсхолдерами}}
                original_html_to_save,  # Оригинал с реальным текстом
                json.dumps(manual_variables),
                description or 'Вручную размеченный шаблон'
            ))
            
            template_id = cur.fetchone()[0]
            conn.commit()
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({
                    'success': True,
                    'template_id': template_id,
                    'variables_count': len(manual_variables)
                })
            }
    finally:
        conn.close()