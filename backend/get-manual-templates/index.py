import json
import os
import psycopg2
from typing import Dict, Any

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Business: Получение списка вручную размеченных шаблонов
    Args: event с queryStringParameters: {template_id} (опционально)
    Returns: {templates: [...]} или {template: {...}}
    '''
    method: str = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Max-Age': '86400'
            },
            'body': ''
        }
    
    if method != 'GET':
        return {
            'statusCode': 405,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Method not allowed'})
        }
    
    params = event.get('queryStringParameters') or {}
    template_id = params.get('template_id')
    
    dsn = os.environ.get('DATABASE_URL')
    if not dsn:
        return {
            'statusCode': 500,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'DATABASE_URL not configured'})
        }
    
    conn = psycopg2.connect(dsn)
    try:
        with conn.cursor() as cur:
            if template_id:
                cur.execute("""
                    SELECT id, name, instructions, html_template, original_html, 
                           manual_variables, created_at, updated_at
                    FROM t_p22819116_event_schedule_app.email_templates
                    WHERE id = %s AND manual_variables IS NOT NULL
                """, (template_id,))
                
                row = cur.fetchone()
                if not row:
                    return {
                        'statusCode': 404,
                        'headers': {'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'Template not found'})
                    }
                
                template = {
                    'id': row[0],
                    'name': row[1],
                    'description': row[2],
                    'html_content': row[3],
                    'original_html': row[4],
                    'manual_variables': row[5],
                    'created_at': row[6].isoformat() if row[6] else None,
                    'updated_at': row[7].isoformat() if row[7] else None,
                }
                
                return {
                    'statusCode': 200,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'body': json.dumps({'template': template})
                }
            else:
                cur.execute("""
                    WITH ranked_templates AS (
                        SELECT id, name, instructions, created_at, 
                               jsonb_array_length(COALESCE(manual_variables, '[]'::jsonb)) as vars_count,
                               ROW_NUMBER() OVER (PARTITION BY name ORDER BY created_at DESC) as rn
                        FROM t_p22819116_event_schedule_app.email_templates
                        WHERE manual_variables IS NOT NULL 
                          AND jsonb_array_length(manual_variables) > 0
                    )
                    SELECT id, name, instructions, created_at, vars_count
                    FROM ranked_templates
                    WHERE rn = 1
                    ORDER BY created_at DESC
                    LIMIT 50
                """)
                
                rows = cur.fetchall()
                templates = []
                for row in rows:
                    templates.append({
                        'id': row[0],
                        'name': row[1],
                        'description': row[2],
                        'created_at': row[3].isoformat() if row[3] else None,
                        'variables_count': row[4]
                    })
                
                return {
                    'statusCode': 200,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'body': json.dumps({
                        'templates': templates,
                        'total': len(templates)
                    })
                }
    finally:
        conn.close()