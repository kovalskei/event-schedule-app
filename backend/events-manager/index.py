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
            
            elif action == 'create_campaign':
                event_id = body_data.get('event_id')
                name = body_data.get('name')
                demo_mode = body_data.get('demo_mode', False)
                
                if not event_id or not name:
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'event_id and name required'})
                    }
                
                cur.execute("""
                    INSERT INTO campaigns (event_id, name, demo_mode, status)
                    VALUES (%s, %s, %s, 'draft')
                    RETURNING id, event_id, name, status, demo_mode, created_at
                """, (event_id, name, demo_mode))
                
                campaign = cur.fetchone()
                conn.commit()
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({
                        'id': campaign[0],
                        'event_id': campaign[1],
                        'name': campaign[2],
                        'status': campaign[3],
                        'demo_mode': campaign[4],
                        'created_at': campaign[5].isoformat()
                    })
                }
            
            elif action == 'get_campaigns':
                event_id = body_data.get('event_id')
                
                if not event_id:
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'event_id required'})
                    }
                
                cur.execute("""
                    SELECT c.id, c.event_id, c.name, c.status, c.demo_mode,
                           c.scheduled_start, c.actual_start, c.completed_at,
                           COUNT(cpi.id) as items_count,
                           c.created_at
                    FROM campaigns c
                    LEFT JOIN content_plan_items cpi ON cpi.campaign_id = c.id
                    WHERE c.event_id = %s
                    GROUP BY c.id
                    ORDER BY c.created_at DESC
                """, (event_id,))
                
                campaigns = []
                for row in cur.fetchall():
                    campaigns.append({
                        'id': row[0],
                        'event_id': row[1],
                        'name': row[2],
                        'status': row[3],
                        'demo_mode': row[4],
                        'scheduled_start': row[5].isoformat() if row[5] else None,
                        'actual_start': row[6].isoformat() if row[6] else None,
                        'completed_at': row[7].isoformat() if row[7] else None,
                        'items_count': row[8],
                        'created_at': row[9].isoformat()
                    })
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'campaigns': campaigns})
                }
            
            elif action == 'add_content_item':
                campaign_id = body_data.get('campaign_id')
                content_type_id = body_data.get('content_type_id')
                scheduled_date = body_data.get('scheduled_date')
                subject = body_data.get('subject', '')
                key_message = body_data.get('key_message', '')
                cta_text = body_data.get('cta_text', '')
                
                if not campaign_id or not content_type_id or not scheduled_date:
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'campaign_id, content_type_id, and scheduled_date required'})
                    }
                
                cur.execute("""
                    INSERT INTO content_plan_items 
                    (campaign_id, content_type_id, scheduled_date, subject, key_message, cta_text, status)
                    VALUES (%s, %s, %s, %s, %s, %s, 'pending')
                    RETURNING id
                """, (campaign_id, content_type_id, scheduled_date, subject, key_message, cta_text))
                
                item_id = cur.fetchone()[0]
                conn.commit()
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'id': item_id, 'message': 'Content item added'})
                }
            
            elif action == 'get_content_plan':
                campaign_id = body_data.get('campaign_id')
                
                if not campaign_id:
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'campaign_id required'})
                    }
                
                cur.execute("""
                    SELECT cpi.id, cpi.campaign_id, cpi.content_type_id, ct.name as content_type_name,
                           cpi.scheduled_date, cpi.subject, cpi.key_message, cpi.cta_text,
                           cpi.status, cpi.generated_html, cpi.sent_at, cpi.created_at
                    FROM content_plan_items cpi
                    JOIN content_types ct ON ct.id = cpi.content_type_id
                    WHERE cpi.campaign_id = %s
                    ORDER BY cpi.scheduled_date ASC
                """, (campaign_id,))
                
                items = []
                for row in cur.fetchall():
                    items.append({
                        'id': row[0],
                        'campaign_id': row[1],
                        'content_type_id': row[2],
                        'content_type_name': row[3],
                        'scheduled_date': row[4].isoformat(),
                        'subject': row[5],
                        'key_message': row[6],
                        'cta_text': row[7],
                        'status': row[8],
                        'generated_html': row[9],
                        'sent_at': row[10].isoformat() if row[10] else None,
                        'created_at': row[11].isoformat()
                    })
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'items': items})
                }
            
            elif action == 'launch_campaign':
                campaign_id = body_data.get('campaign_id')
                
                if not campaign_id:
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'campaign_id required'})
                    }
                
                cur.execute("""
                    UPDATE campaigns 
                    SET status = 'running', actual_start = CURRENT_TIMESTAMP
                    WHERE id = %s
                    RETURNING id, status, demo_mode
                """, (campaign_id,))
                
                result = cur.fetchone()
                conn.commit()
                
                if result:
                    return {
                        'statusCode': 200,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({
                            'message': 'Campaign launched' if not result[2] else 'Campaign launched in DEMO mode',
                            'id': result[0],
                            'status': result[1],
                            'demo_mode': result[2]
                        })
                    }
                else:
                    return {
                        'statusCode': 404,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'Campaign not found'})
                    }
            
            elif action == 'import_content_plan':
                event_id = body_data.get('event_id')
                sheet_url = body_data.get('sheet_url')
                
                if not event_id or not sheet_url:
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'event_id and sheet_url required'})
                    }
                
                import requests
                from datetime import datetime
                
                try:
                    sheet_id = sheet_url.split('/d/')[1].split('/')[0]
                    csv_url = f'https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=csv'
                    
                    response = requests.get(csv_url)
                    response.raise_for_status()
                    
                    lines = response.text.strip().split('\n')
                    headers = [h.strip() for h in lines[0].split(',')]
                    
                    imported_count = 0
                    
                    for line in lines[1:]:
                        parts = [p.strip().strip('"') for p in line.split(',')]
                        if len(parts) < 3:
                            continue
                        
                        row_data = dict(zip(headers, parts))
                        
                        date_str = row_data.get('Дата', row_data.get('Date', ''))
                        content_type_name = row_data.get('Тип контента', row_data.get('Content Type', ''))
                        subject = row_data.get('Тема', row_data.get('Subject', ''))
                        key_message = row_data.get('Ключевое сообщение', row_data.get('Key Message', ''))
                        cta_text = row_data.get('CTA', '')
                        
                        if not date_str or not content_type_name:
                            continue
                        
                        try:
                            scheduled_date = datetime.strptime(date_str, '%Y-%m-%d')
                        except:
                            try:
                                scheduled_date = datetime.strptime(date_str, '%d.%m.%Y')
                            except:
                                continue
                        
                        cur.execute("""
                            SELECT id FROM content_types 
                            WHERE event_id = %s AND name = %s
                            LIMIT 1
                        """, (event_id, content_type_name))
                        
                        content_type_row = cur.fetchone()
                        if not content_type_row:
                            continue
                        
                        content_type_id = content_type_row[0]
                        
                        cur.execute("""
                            SELECT id FROM campaigns 
                            WHERE event_id = %s AND status = 'draft'
                            ORDER BY created_at DESC LIMIT 1
                        """, (event_id,))
                        
                        campaign_row = cur.fetchone()
                        
                        if not campaign_row:
                            cur.execute("""
                                INSERT INTO campaigns (event_id, name, demo_mode, status)
                                VALUES (%s, %s, true, 'draft')
                                RETURNING id
                            """, (event_id, f'Автоматическая кампания {datetime.now().strftime("%Y-%m-%d")}'))
                            campaign_row = cur.fetchone()
                        
                        campaign_id = campaign_row[0]
                        
                        cur.execute("""
                            INSERT INTO content_plan_items 
                            (campaign_id, content_type_id, scheduled_date, subject, key_message, cta_text, status)
                            VALUES (%s, %s, %s, %s, %s, %s, 'pending')
                        """, (campaign_id, content_type_id, scheduled_date, subject, key_message, cta_text))
                        
                        imported_count += 1
                    
                    conn.commit()
                    
                    return {
                        'statusCode': 200,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'imported_count': imported_count})
                    }
                
                except Exception as e:
                    return {
                        'statusCode': 500,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': f'Import failed: {str(e)}'})
                    }
            
            elif action == 'create_schedule_rule':
                event_id = body_data.get('event_id')
                mailing_list_id = body_data.get('mailing_list_id')
                content_plan_item_id = body_data.get('content_plan_item_id')
                ai_provider = body_data.get('ai_provider', 'demo')
                ai_model = body_data.get('ai_model')
                assistant_id = body_data.get('assistant_id')
                
                if not event_id or not mailing_list_id or not content_plan_item_id:
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'event_id, mailing_list_id, and content_plan_item_id required'})
                    }
                
                cur.execute("""
                    INSERT INTO schedule_rules 
                    (event_id, mailing_list_id, content_plan_item_id, ai_provider, ai_model, assistant_id, status)
                    VALUES (%s, %s, %s, %s, %s, %s, 'pending')
                    RETURNING id
                """, (event_id, mailing_list_id, content_plan_item_id, ai_provider, ai_model, assistant_id))
                
                rule_id = cur.fetchone()[0]
                conn.commit()
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'id': rule_id, 'message': 'Schedule rule created'})
                }
            
            elif action == 'get_schedule_rules':
                event_id = body_data.get('event_id')
                
                if not event_id:
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'event_id required'})
                    }
                
                cur.execute("""
                    SELECT sr.id, sr.event_id, sr.mailing_list_id, eml.unisender_list_name,
                           sr.content_plan_item_id, cpi.scheduled_date, ct.name as content_type,
                           cpi.subject, sr.ai_provider, sr.status, sr.sent_at, sr.error_message,
                           sr.created_at
                    FROM schedule_rules sr
                    JOIN event_mailing_lists eml ON eml.id = sr.mailing_list_id
                    JOIN content_plan_items cpi ON cpi.id = sr.content_plan_item_id
                    JOIN content_types ct ON ct.id = cpi.content_type_id
                    WHERE sr.event_id = %s
                    ORDER BY cpi.scheduled_date ASC
                """, (event_id,))
                
                rules = []
                for row in cur.fetchall():
                    rules.append({
                        'id': row[0],
                        'event_id': row[1],
                        'list_id': row[2],
                        'list_name': row[3],
                        'content_plan_item_id': row[4],
                        'scheduled_date': row[5].isoformat(),
                        'content_type': row[6],
                        'subject': row[7],
                        'ai_provider': row[8],
                        'status': row[9],
                        'sent_at': row[10].isoformat() if row[10] else None,
                        'error_message': row[11],
                        'created_at': row[12].isoformat()
                    })
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'rules': rules})
                }
            
            elif action == 'launch_schedule_rule':
                rule_id = body_data.get('rule_id')
                
                if not rule_id:
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'rule_id required'})
                    }
                
                cur.execute("""
                    UPDATE schedule_rules 
                    SET status = 'processing', updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s
                    RETURNING id
                """, (rule_id,))
                
                conn.commit()
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'message': 'Schedule rule launched', 'id': rule_id})
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