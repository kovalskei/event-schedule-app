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
                    SELECT 
                        eml.*,
                        COUNT(ge.id) as drafts_count
                    FROM event_mailing_lists eml
                    LEFT JOIN generated_emails ge ON ge.event_list_id = eml.id AND ge.status = 'draft'
                    WHERE eml.event_id = %s 
                    GROUP BY eml.id
                    ORDER BY eml.created_at DESC
                ''', (event_id,))
                lists = cur.fetchall()
                
                cur.execute('''
                    SELECT * FROM content_types
                    WHERE event_id = %s
                    ORDER BY name
                ''', (event_id,))
                content_types = cur.fetchall()
                
                cur.execute('''
                    SELECT et.*, ct.name as content_type_name
                    FROM email_templates et
                    JOIN content_types ct ON et.content_type_id = ct.id
                    WHERE et.event_id = %s
                    ORDER BY ct.name, et.name
                ''', (event_id,))
                templates = cur.fetchall()
                
                cur.execute('''
                    SELECT cp.*, ct.name as content_type_name
                    FROM content_plan cp
                    JOIN content_types ct ON cp.content_type_id = ct.id
                    WHERE cp.event_id = %s
                    ORDER BY cp.scheduled_date, cp.created_at
                ''', (event_id,))
                content_plan = cur.fetchall()
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({
                        'event': dict(evt),
                        'mailing_lists': [dict(l) for l in lists],
                        'content_types': [dict(ct) for ct in content_types],
                        'email_templates': [dict(t) for t in templates],
                        'content_plan': [dict(cp) for cp in content_plan]
                    }, default=str)
                }
            
            elif action == 'get_drafts':
                event_list_id = params.get('event_list_id', '')
                
                if not event_list_id:
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'event_list_id required'})
                    }
                
                cur.execute('''
                    SELECT 
                        ge.*,
                        ct.name as content_type_name,
                        ct.description as content_type_description
                    FROM generated_emails ge
                    LEFT JOIN campaigns c ON c.id = ge.campaign_id
                    LEFT JOIN content_types ct ON ct.id = c.mailing_list_id
                    WHERE ge.event_list_id = %s
                    ORDER BY ge.created_at DESC
                ''', (event_list_id,))
                
                drafts = cur.fetchall()
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'drafts': [dict(d) for d in drafts]}, default=str)
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
            
            elif action == 'create_content_type':
                event_id = body_data.get('event_id')
                name = body_data.get('name', '')
                description = body_data.get('description', '')
                
                if not event_id or not name:
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'event_id and name required'})
                    }
                
                cur.execute('''
                    INSERT INTO content_types (event_id, name, description)
                    VALUES (%s, %s, %s)
                    RETURNING id
                ''', (event_id, name, description))
                
                content_type_id = cur.fetchone()['id']
                conn.commit()
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'content_type_id': content_type_id, 'message': 'Content type created'})
                }
            
            elif action == 'create_email_template':
                event_id = body_data.get('event_id')
                content_type_id = body_data.get('content_type_id')
                name = body_data.get('name', '')
                html_template = body_data.get('html_template', '')
                subject_template = body_data.get('subject_template', '')
                instructions = body_data.get('instructions', '')
                
                if not event_id or not content_type_id or not name or not html_template:
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'event_id, content_type_id, name, html_template required'})
                    }
                
                cur.execute('''
                    INSERT INTO email_templates (event_id, content_type_id, name, html_template, subject_template, instructions)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    RETURNING id
                ''', (event_id, content_type_id, name, html_template, subject_template, instructions))
                
                template_id = cur.fetchone()['id']
                conn.commit()
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'template_id': template_id, 'message': 'Email template created'})
                }
            
            elif action == 'update_mailing_list_settings':
                list_id = body_data.get('list_id')
                content_type_ids = body_data.get('content_type_ids', [])
                content_type_order = body_data.get('content_type_order', '[]')
                ai_provider = body_data.get('ai_provider', 'openai')
                ai_model = body_data.get('ai_model', 'gpt-4o-mini')
                ai_assistant_id = body_data.get('ai_assistant_id')
                demo_mode = body_data.get('demo_mode', False)
                schedule_type = body_data.get('schedule_type', 'manual')
                schedule_rrule = body_data.get('schedule_rrule')
                schedule_datetime = body_data.get('schedule_datetime')
                schedule_window_start = body_data.get('schedule_window_start', '10:00')
                schedule_window_end = body_data.get('schedule_window_end', '19:00')
                test_required = body_data.get('test_required', True)
                
                if not list_id:
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'list_id required'})
                    }
                
                cur.execute('''
                    UPDATE event_mailing_lists SET
                        content_type_ids = %s,
                        content_type_order = %s,
                        ai_provider = %s,
                        ai_model = %s,
                        ai_assistant_id = %s,
                        demo_mode = %s,
                        schedule_type = %s,
                        schedule_rrule = %s,
                        schedule_datetime = %s,
                        schedule_window_start = %s,
                        schedule_window_end = %s,
                        test_required = %s
                    WHERE id = %s
                ''', (content_type_ids, content_type_order, ai_provider, ai_model, 
                      ai_assistant_id, demo_mode, schedule_type, schedule_rrule, 
                      schedule_datetime, schedule_window_start, schedule_window_end, 
                      test_required, list_id))
                
                conn.commit()
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'message': 'Mailing list settings updated'})
                }
            
            elif action == 'import_content_plan':
                event_id = body_data.get('event_id')
                items = body_data.get('items', [])
                
                if not event_id or not items:
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'event_id and items required'})
                    }
                
                imported_count = 0
                for item in items:
                    content_type_id = item.get('content_type_id')
                    topic = item.get('topic', '')
                    scheduled_date = item.get('scheduled_date')
                    
                    if content_type_id and topic:
                        cur.execute('''
                            INSERT INTO content_plan (event_id, content_type_id, topic, scheduled_date)
                            VALUES (%s, %s, %s, %s)
                        ''', (event_id, content_type_id, topic, scheduled_date))
                        imported_count += 1
                
                conn.commit()
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'imported_count': imported_count, 'message': f'{imported_count} items imported'})
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
                
                for field in ['name', 'description', 'start_date', 'end_date', 'program_doc_id', 'pain_doc_id', 'default_tone', 'email_template_examples']:
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
            
            elif action == 'generate_drafts':
                list_id = body_data.get('list_id')
                
                if not list_id:
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'list_id required'})
                    }
                
                cur.execute('''
                    SELECT content_type_ids, content_type_order
                    FROM event_mailing_lists
                    WHERE id = %s
                ''', (list_id,))
                
                mailing_list = cur.fetchone()
                if not mailing_list or not mailing_list['content_type_ids']:
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'No content types selected for this list'})
                    }
                
                content_type_ids = mailing_list['content_type_ids']
                
                created_count = 0
                for content_type_id in content_type_ids:
                    cur.execute('''
                        INSERT INTO generated_emails 
                        (event_list_id, content_type_id, subject, html_body, status)
                        VALUES (%s, %s, %s, %s, %s)
                    ''', (
                        list_id,
                        content_type_id,
                        f'Черновик письма для типа {content_type_id}',
                        f'<p>Это автоматически созданный черновик для типа контента {content_type_id}</p>',
                        'draft'
                    ))
                    created_count += 1
                
                conn.commit()
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'count': created_count, 'message': f'Created {created_count} draft emails'})
                }
            
            elif action == 'get_drafts':
                list_id = body_data.get('list_id')
                
                if not list_id:
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'list_id required'})
                    }
                
                cur.execute('''
                    SELECT 
                        ge.id,
                        ge.content_type_id,
                        ge.subject,
                        ge.html_body,
                        ge.status,
                        ge.created_at,
                        ct.name as content_type_name
                    FROM generated_emails ge
                    LEFT JOIN content_types ct ON ct.id = ge.content_type_id
                    WHERE ge.event_list_id = %s AND ge.status = 'draft'
                    ORDER BY ge.created_at DESC
                ''', (list_id,))
                
                drafts = cur.fetchall()
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'drafts': drafts}, default=str)
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