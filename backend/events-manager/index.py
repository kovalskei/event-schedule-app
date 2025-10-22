import json
import os
from typing import Dict, Any
import psycopg2
from psycopg2.extras import RealDictCursor

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Business: Управление мероприятиями - CRUD операции, списки рассылок, UTM правила
    Args: event - dict с httpMethod, body (action, параметры мероприятия/списка)
    Returns: HTTP response с данными
    '''
    method: str = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
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
            params = event.get('queryStringParameters', {})
            action = params.get('action', 'list_events')
            
            if action == 'list_events':
                cur.execute('''
                    SELECT 
                        e.*,
                        COUNT(DISTINCT ml.id) as lists_count,
                        COUNT(DISTINCT c.id) as campaigns_count
                    FROM events e
                    LEFT JOIN mailing_lists ml ON e.id = ml.event_id
                    LEFT JOIN campaigns c ON e.id = c.event_id
                    GROUP BY e.id
                    ORDER BY e.created_at DESC
                ''')
                
                events = cur.fetchall()
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'events': events}, default=str)
                }
            
            elif action == 'get_event':
                event_id = params.get('event_id', 0)
                
                cur.execute('SELECT * FROM events WHERE id = %s', (event_id,))
                event_data = cur.fetchone()
                
                if not event_data:
                    return {
                        'statusCode': 404,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'Event not found'})
                    }
                
                cur.execute('''
                    SELECT ml.*, 
                           COUNT(ur.id) as utm_rules_count,
                           COUNT(lr.id) as link_rules_count
                    FROM mailing_lists ml
                    LEFT JOIN utm_rules ur ON ml.id = ur.mailing_list_id
                    LEFT JOIN link_rules lr ON ml.id = lr.mailing_list_id
                    WHERE ml.event_id = %s
                    GROUP BY ml.id
                ''', (event_id,))
                
                lists = cur.fetchall()
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'event': event_data, 'mailing_lists': lists}, default=str)
                }
            
            elif action == 'get_list_rules':
                list_id = params.get('list_id', 0)
                
                cur.execute('SELECT * FROM utm_rules WHERE mailing_list_id = %s', (list_id,))
                utm_rules = cur.fetchall()
                
                cur.execute('SELECT * FROM link_rules WHERE mailing_list_id = %s', (list_id,))
                link_rules = cur.fetchall()
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'utm_rules': utm_rules, 'link_rules': link_rules}, default=str)
                }
        
        elif method == 'POST':
            body_str = event.get('body', '{}')
            if not body_str or body_str == '':
                body_str = '{}'
            body_data = json.loads(body_str)
            
            action = body_data.get('action', '')
            
            if action == 'create_event':
                name = body_data.get('name', '')
                description = body_data.get('description', '')
                start_date = body_data.get('start_date', None)
                end_date = body_data.get('end_date', None)
                program_doc_id = body_data.get('program_doc_id', '')
                pain_doc_id = body_data.get('pain_doc_id', '')
                default_tone = body_data.get('default_tone', 'professional')
                
                if not name:
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'name required'})
                    }
                
                cur.execute('''
                    INSERT INTO events (name, description, start_date, end_date, program_doc_id, pain_doc_id, default_tone)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    RETURNING *
                ''', (name, description, start_date, end_date, program_doc_id, pain_doc_id, default_tone))
                
                event_record = cur.fetchone()
                conn.commit()
                
                return {
                    'statusCode': 201,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'event': event_record}, default=str)
                }
            
            elif action == 'create_mailing_list':
                event_id = body_data.get('event_id', 0)
                name = body_data.get('name', '')
                unisender_list_id = body_data.get('unisender_list_id', '')
                segment_rules = body_data.get('segment_rules', {})
                description = body_data.get('description', '')
                
                if not event_id or not name:
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'event_id and name required'})
                    }
                
                cur.execute('''
                    INSERT INTO mailing_lists (event_id, name, unisender_list_id, segment_rules, description)
                    VALUES (%s, %s, %s, %s, %s)
                    RETURNING *
                ''', (event_id, name, unisender_list_id, json.dumps(segment_rules), description))
                
                mailing_list = cur.fetchone()
                conn.commit()
                
                return {
                    'statusCode': 201,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'mailing_list': mailing_list}, default=str)
                }
            
            elif action == 'create_utm_rule':
                list_id = body_data.get('mailing_list_id', 0)
                utm_source = body_data.get('utm_source', '')
                utm_medium = body_data.get('utm_medium', '')
                utm_campaign = body_data.get('utm_campaign', '')
                utm_term = body_data.get('utm_term', '')
                utm_content = body_data.get('utm_content', '')
                custom_params = body_data.get('custom_params', {})
                
                if not list_id:
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'mailing_list_id required'})
                    }
                
                cur.execute('''
                    INSERT INTO utm_rules (mailing_list_id, utm_source, utm_medium, utm_campaign, utm_term, utm_content, custom_params)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    RETURNING *
                ''', (list_id, utm_source, utm_medium, utm_campaign, utm_term, utm_content, json.dumps(custom_params)))
                
                utm_rule = cur.fetchone()
                conn.commit()
                
                return {
                    'statusCode': 201,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'utm_rule': utm_rule}, default=str)
                }
            
            elif action == 'create_link_rule':
                list_id = body_data.get('mailing_list_id', 0)
                link_type = body_data.get('link_type', '')
                base_url = body_data.get('base_url', '')
                apply_utm = body_data.get('apply_utm', True)
                custom_params = body_data.get('custom_params', {})
                
                if not list_id or not base_url:
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'mailing_list_id and base_url required'})
                    }
                
                cur.execute('''
                    INSERT INTO link_rules (mailing_list_id, link_type, base_url, apply_utm, custom_params)
                    VALUES (%s, %s, %s, %s, %s)
                    RETURNING *
                ''', (list_id, link_type, base_url, apply_utm, json.dumps(custom_params)))
                
                link_rule = cur.fetchone()
                conn.commit()
                
                return {
                    'statusCode': 201,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'link_rule': link_rule}, default=str)
                }
        
        elif method == 'PUT':
            body_str = event.get('body', '{}')
            if not body_str or body_str == '':
                body_str = '{}'
            body_data = json.loads(body_str)
            
            action = body_data.get('action', 'update_event')
            
            if action == 'update_event':
                event_id = body_data.get('event_id', 0)
                updates = body_data.get('updates', {})
                
                if not event_id or not updates:
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'event_id and updates required'})
                    }
                
                set_clause = ', '.join([f"{key} = %s" for key in updates.keys()])
                values = list(updates.values()) + [event_id]
                
                cur.execute(f'''
                    UPDATE events 
                    SET {set_clause}, updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s
                    RETURNING *
                ''', values)
                
                updated_event = cur.fetchone()
                conn.commit()
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'event': updated_event}, default=str)
                }
        
        return {
            'statusCode': 405,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Method not allowed'})
        }
    
    finally:
        cur.close()
        conn.close()
