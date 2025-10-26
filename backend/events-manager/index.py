import json
import os
from typing import Dict, Any
import psycopg2
from psycopg2.extras import RealDictCursor

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Business: Управление мероприятиями - CRUD операций, связь с UniSender списками, UTM правила
    Args: event - dict с httpMethod, body (action, параметры мероприятия)
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
                        COUNT(DISTINCT eml.id) as lists_count,
                        COUNT(DISTINCT c.id) as campaigns_count
                    FROM events e
                    LEFT JOIN event_mailing_lists eml ON eml.event_id = e.id
                    LEFT JOIN campaigns c ON c.event_id = e.id
                    GROUP BY e.id
                    ORDER BY e.start_date DESC
                ''')
                
                events = cur.fetchall()
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'events': [dict(e) for e in events]}, default=str)
                }
            
            elif action == 'get_event':
                event_id = params.get('event_id', '')
                
                if not event_id:
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'event_id required'})
                    }
                
                cur.execute('SELECT * FROM events WHERE id = %s', (event_id,))
                evt = cur.fetchone()
                
                if not evt:
                    return {
                        'statusCode': 404,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'Event not found'})
                    }
                
                cur.execute('''
                    SELECT * FROM event_mailing_lists 
                    WHERE event_id = %s 
                    ORDER BY created_at DESC
                ''', (event_id,))
                
                lists = cur.fetchall()
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({
                        'event': dict(evt),
                        'mailing_lists': [dict(l) for l in lists]
                    }, default=str)
                }
            
            else:
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Invalid action'})
                }
        
        elif method == 'POST':
            body_str = event.get('body', '{}')
            if not body_str or body_str == '':
                body_str = '{}'
            body_data = json.loads(body_str)
            
            action = body_data.get('action', '')
            
            if action == 'create_event':
                name = body_data.get('name', '')
                start_date = body_data.get('start_date')
                end_date = body_data.get('end_date')
                program_doc_id = body_data.get('program_doc_id', '')
                pain_doc_id = body_data.get('pain_doc_id', '')
                default_tone = body_data.get('default_tone', 'professional')
                email_template_examples = body_data.get('email_template_examples', '')
                
                if not name or not start_date or not end_date:
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'name, start_date, end_date required'})
                    }
                
                cur.execute('''
                    INSERT INTO events (name, start_date, end_date, program_doc_id, pain_doc_id, default_tone, email_template_examples)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    RETURNING id
                ''', (name, start_date, end_date, program_doc_id, pain_doc_id, default_tone, email_template_examples))
                
                event_id = cur.fetchone()['id']
                conn.commit()
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'event_id': event_id, 'message': 'Event created'})
                }
            
            elif action == 'link_unisender_list':
                event_id = body_data.get('event_id')
                unisender_list_id = body_data.get('unisender_list_id', '')
                unisender_list_name = body_data.get('unisender_list_name', '')
                utm_source = body_data.get('utm_source', 'email')
                utm_medium = body_data.get('utm_medium', 'newsletter')
                utm_campaign = body_data.get('utm_campaign', '')
                utm_term = body_data.get('utm_term', '')
                utm_content = body_data.get('utm_content', '')
                
                if not event_id or not unisender_list_id:
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'event_id and unisender_list_id required'})
                    }
                
                cur.execute('''
                    INSERT INTO event_mailing_lists 
                    (event_id, unisender_list_id, unisender_list_name, utm_source, utm_medium, utm_campaign, utm_term, utm_content)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING id
                ''', (event_id, unisender_list_id, unisender_list_name, utm_source, utm_medium, utm_campaign, utm_term, utm_content))
                
                list_id = cur.fetchone()['id']
                conn.commit()
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'list_id': list_id, 'message': 'UniSender list linked to event'})
                }
            
            else:
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Invalid action'})
                }
        
        elif method == 'PUT':
            body_str = event.get('body', '{}')
            if not body_str or body_str == '':
                body_str = '{}'
            body_data = json.loads(body_str)
            
            action = body_data.get('action', '')
            
            if action == 'update_event':
                event_id = body_data.get('event_id')
                
                if not event_id:
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'event_id required'})
                    }
                
                update_fields = []
                values = []
                
                for field in ['name', 'start_date', 'end_date', 'program_doc_id', 'pain_doc_id', 'default_tone']:
                    if field in body_data:
                        update_fields.append(f"{field} = %s")
                        values.append(body_data[field])
                
                if not update_fields:
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'No fields to update'})
                    }
                
                values.append(event_id)
                query = f"UPDATE events SET {', '.join(update_fields)} WHERE id = %s"
                cur.execute(query, values)
                conn.commit()
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'message': 'Event updated'})
                }
            
            elif action == 'update_utm_rules':
                list_id = body_data.get('list_id')
                
                if not list_id:
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'list_id required'})
                    }
                
                update_fields = []
                values = []
                
                for field in ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content']:
                    if field in body_data:
                        update_fields.append(f"{field} = %s")
                        values.append(body_data[field])
                
                if not update_fields:
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'No UTM fields to update'})
                    }
                
                values.append(list_id)
                query = f"UPDATE event_mailing_lists SET {', '.join(update_fields)} WHERE id = %s"
                cur.execute(query, values)
                conn.commit()
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'message': 'UTM rules updated'})
                }
            
            else:
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Invalid action'})
                }
        
        else:
            return {
                'statusCode': 405,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'Method not allowed'})
            }
    
    except Exception as e:
        conn.rollback()
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)})
        }
    finally:
        cur.close()
        conn.close()