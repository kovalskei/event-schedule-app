import json
import os
from typing import Dict, Any
import psycopg2
from psycopg2.extras import RealDictCursor

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Business: Управление кампаниями - создание, получение списка, обновление статуса
    Args: event - dict с httpMethod, body (action: create|list|update, параметры кампании)
    Returns: HTTP response с данными кампании или списком
    '''
    method: str = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Max-Age': '86400'
            },
            'body': ''
        }
    
    db_url = os.environ.get('DATABASE_URL', '')
    
    if not db_url:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'DATABASE_URL not configured'})
        }
    
    conn = psycopg2.connect(db_url)
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        if method == 'GET':
            cur.execute('''
                SELECT 
                    c.id, c.name, c.program_doc_id, c.pain_doc_id, 
                    c.tone, c.status, c.created_at,
                    COUNT(ge.id) as email_count
                FROM campaigns c
                LEFT JOIN generated_emails ge ON c.id = ge.campaign_id
                GROUP BY c.id
                ORDER BY c.created_at DESC
            ''')
            
            campaigns = cur.fetchall()
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'campaigns': campaigns}, default=str)
            }
        
        elif method == 'POST':
            body_str = event.get('body', '{}')
            if not body_str or body_str == '':
                body_str = '{}'
            body_data = json.loads(body_str)
            
            action = body_data.get('action', 'create')
            
            if action == 'create':
                name = body_data.get('name', '')
                program_doc_id = body_data.get('program_doc_id', '')
                pain_doc_id = body_data.get('pain_doc_id', '')
                tone = body_data.get('tone', 'professional')
                
                if not name or not program_doc_id or not pain_doc_id:
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'name, program_doc_id, pain_doc_id required'})
                    }
                
                cur.execute('''
                    INSERT INTO campaigns (name, program_doc_id, pain_doc_id, tone, status)
                    VALUES (%s, %s, %s, %s, %s)
                    RETURNING id, name, program_doc_id, pain_doc_id, tone, status, created_at
                ''', (name, program_doc_id, pain_doc_id, tone, 'draft'))
                
                campaign = cur.fetchone()
                conn.commit()
                
                return {
                    'statusCode': 201,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'campaign': campaign}, default=str)
                }
            
            elif action == 'save_email':
                campaign_id = body_data.get('campaign_id', 0)
                subject = body_data.get('subject', '')
                html_content = body_data.get('html_content', '')
                template_id = body_data.get('template_id', '')
                
                if not campaign_id or not subject or not html_content:
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'campaign_id, subject, html_content required'})
                    }
                
                cur.execute('''
                    INSERT INTO generated_emails (campaign_id, subject, html_content, template_id)
                    VALUES (%s, %s, %s, %s)
                    RETURNING id, campaign_id, subject, template_id, created_at
                ''', (campaign_id, subject, html_content, template_id))
                
                email = cur.fetchone()
                conn.commit()
                
                return {
                    'statusCode': 201,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'email': email}, default=str)
                }
            
            elif action == 'log':
                campaign_id = body_data.get('campaign_id', 0)
                step = body_data.get('step', '')
                status = body_data.get('status', '')
                message = body_data.get('message', '')
                error_details = body_data.get('error_details', '')
                
                if not campaign_id or not step or not status:
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'campaign_id, step, status required'})
                    }
                
                cur.execute('''
                    INSERT INTO campaign_logs (campaign_id, step, status, message, error_details)
                    VALUES (%s, %s, %s, %s, %s)
                    RETURNING id
                ''', (campaign_id, step, status, message, error_details))
                
                conn.commit()
                
                return {
                    'statusCode': 201,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'success': True})
                }
        
        elif method == 'PUT':
            body_str = event.get('body', '{}')
            if not body_str or body_str == '':
                body_str = '{}'
            body_data = json.loads(body_str)
            
            campaign_id = body_data.get('campaign_id', 0)
            status = body_data.get('status', '')
            
            if not campaign_id or not status:
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'campaign_id and status required'})
                }
            
            cur.execute('''
                UPDATE campaigns 
                SET status = %s, updated_at = CURRENT_TIMESTAMP
                WHERE id = %s
                RETURNING id, status, updated_at
            ''', (status, campaign_id))
            
            campaign = cur.fetchone()
            conn.commit()
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'campaign': campaign}, default=str)
            }
        
        return {
            'statusCode': 405,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Method not allowed'})
        }
    
    finally:
        cur.close()
        conn.close()
