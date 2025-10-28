import json
import os
from typing import Dict, Any
import psycopg2
from psycopg2.extras import RealDictCursor
import urllib.request
import csv
from io import StringIO

def read_google_doc(url: str) -> str:
    """Читает Google Docs или Sheets напрямую"""
    try:
        doc_id = ''
        doc_type = 'docs'
        
        if '/document/d/' in url:
            doc_id = url.split('/document/d/')[1].split('/')[0]
            doc_type = 'docs'
        elif '/spreadsheets/d/' in url:
            doc_id = url.split('/spreadsheets/d/')[1].split('/')[0]
            doc_type = 'sheets'
        else:
            doc_id = url
            doc_type = 'sheets'
        
        if not doc_id:
            return ''
        
        if doc_type == 'sheets':
            export_url = f'https://docs.google.com/spreadsheets/d/{doc_id}/export?format=csv'
            req = urllib.request.Request(export_url)
            req.add_header('User-Agent', 'Mozilla/5.0')
            
            with urllib.request.urlopen(req, timeout=10) as response:
                csv_content = response.read().decode('utf-8')
                csv_reader = csv.reader(StringIO(csv_content))
                text_lines = []
                
                for row in csv_reader:
                    text_lines.append('\t'.join(row))
                
                return '\n'.join(text_lines)
        else:
            export_url = f'https://docs.google.com/document/d/{doc_id}/export?format=txt'
            req = urllib.request.Request(export_url)
            req.add_header('User-Agent', 'Mozilla/5.0')
            
            with urllib.request.urlopen(req, timeout=10) as response:
                return response.read().decode('utf-8')
    except Exception as e:
        print(f'[ERROR] Failed to read Google doc: {str(e)}')
        return ''

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
            print(f'[REQUEST] GET action={action}')
            
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
            
            elif action == 'preview_content_plan':
                doc_id = params.get('doc_id', '')
                
                if not doc_id:
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'doc_id required'})
                    }
                
                print(f'[DEBUG] Reading content plan from: {doc_id}')
                content_text = read_google_doc(doc_id)
                print(f'[DEBUG] Content plan text length: {len(content_text)}')
                
                rows = []
                for line in content_text.split('\n'):
                    line = line.strip()
                    if not line or line.lower().startswith('заголовок'):
                        continue
                    
                    parts = line.split('\t')
                    if len(parts) >= 2:
                        title = parts[0].strip()
                        content_type = parts[1].strip()
                        if title and content_type:
                            rows.append({'title': title, 'content_type': content_type})
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'rows': rows, 'total': len(rows)})
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
            print(f'[REQUEST] POST action={action}')
            
            if action == 'create_event':
                name = body_data.get('name', '')
                start_date = body_data.get('start_date')
                end_date = body_data.get('end_date')
                program_doc_id = body_data.get('program_doc_id', '')
                pain_doc_id = body_data.get('pain_doc_id', '')
                default_tone = body_data.get('default_tone', 'professional')
                email_template_examples = body_data.get('email_template_examples', '')
                logo_url = body_data.get('logo_url', '')
                
                if not name or not start_date or not end_date:
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'name, start_date, end_date required'})
                    }
                
                cur.execute('''
                    INSERT INTO events (name, start_date, end_date, program_doc_id, pain_doc_id, default_tone, email_template_examples, logo_url)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING id
                ''', (name, start_date, end_date, program_doc_id, pain_doc_id, default_tone, email_template_examples, logo_url))
                
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
                sender_email = body_data.get('sender_email')
                sender_name = body_data.get('sender_name', 'HR Team')
                
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
                        test_required = %s,
                        sender_email = %s,
                        sender_name = %s
                    WHERE id = %s
                ''', (content_type_ids, content_type_order, ai_provider, ai_model, 
                      ai_assistant_id, demo_mode, schedule_type, schedule_rrule, 
                      schedule_datetime, schedule_window_start, schedule_window_end, 
                      test_required, sender_email, sender_name, list_id))
                
                conn.commit()
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'message': 'Mailing list settings updated'})
                }
            
            elif action == 'delete_mailing_list':
                list_id = body_data.get('list_id')
                
                if not list_id:
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'list_id required'})
                    }
                
                # Delete drafts first
                cur.execute('DELETE FROM email_drafts WHERE mailing_list_id = %s', (list_id,))
                
                # Delete mailing list
                cur.execute('DELETE FROM event_mailing_lists WHERE id = %s', (list_id,))
                
                conn.commit()
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'message': 'Mailing list deleted'})
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
            
            elif action == 'generate_drafts':
                list_id = body_data.get('list_id')
                
                if not list_id:
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'list_id required'})
                    }
                
                cur.execute('''
                    SELECT 
                        eml.*,
                        e.program_doc_id,
                        e.pain_doc_id,
                        e.default_tone
                    FROM event_mailing_lists eml
                    JOIN events e ON e.id = eml.event_id
                    WHERE eml.id = %s
                ''', (list_id,))
                
                mailing_list = cur.fetchone()
                
                if not mailing_list:
                    return {
                        'statusCode': 404,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'Mailing list not found'})
                    }
                
                content_type_ids = mailing_list['content_type_ids'] if mailing_list['content_type_ids'] else []
                
                if not content_type_ids:
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'No content types selected'})
                    }
                
                event_id = mailing_list['event_id']
                program_doc_id = mailing_list['program_doc_id']
                pain_doc_id = mailing_list['pain_doc_id']
                
                program_text = ''
                pain_points_text = ''
                
                if program_doc_id:
                    print(f'[DEBUG] Reading program from: {program_doc_id}')
                    program_text = read_google_doc(program_doc_id)
                    print(f'[DEBUG] Program text length: {len(program_text)}')
                
                if pain_doc_id:
                    print(f'[DEBUG] Reading pain points from: {pain_doc_id}')
                    pain_points_text = read_google_doc(pain_doc_id)
                    print(f'[DEBUG] Pain text length: {len(pain_points_text)}')
                
                program_topics = [line.strip() for line in program_text.split('\n') if line.strip()]
                pain_points = [line.strip() for line in pain_points_text.split('\n') if line.strip()]
                
                print(f'[DEBUG] program_text length: {len(program_text)}, first 100 chars: {program_text[:100]}')
                print(f'[DEBUG] pain_points_text length: {len(pain_points_text)}, first 100 chars: {pain_points_text[:100]}')
                print(f'[DEBUG] program_topics count: {len(program_topics)}')
                print(f'[DEBUG] pain_points count: {len(pain_points)}')
                
                ai_api_key = os.environ.get('OPENAI_API_KEY')
                
                created_count = 0
                skipped_count = 0
                for content_type_id in content_type_ids:
                    # Проверяем, есть ли уже черновик для этого content_type
                    cur.execute('''
                        SELECT id FROM generated_emails
                        WHERE event_list_id = %s AND content_type_id = %s AND status = 'draft'
                        LIMIT 1
                    ''', (list_id, content_type_id))
                    
                    existing_draft = cur.fetchone()
                    
                    if existing_draft:
                        print(f'[SKIP] Draft already exists for list_id={list_id}, content_type={content_type_id}')
                        skipped_count += 1
                        continue
                    
                    cur.execute('''
                        SELECT html_template, subject_template, instructions, name
                        FROM email_templates
                        WHERE event_id = %s AND content_type_id = %s
                        LIMIT 1
                    ''', (event_id, content_type_id))
                    
                    template_row = cur.fetchone()
                    
                    if not template_row:
                        continue
                    
                    html_template = template_row['html_template'] or ''
                    subject_template = template_row['subject_template'] or 'Новое письмо'
                    instructions = template_row['instructions'] or ''
                    
                    print(f'[TEMPLATE] Using template substitution for content_type={content_type_id}')
                    final_html = html_template.replace('{program_topics}', '\n'.join(program_topics))
                    final_html = final_html.replace('{pain_points}', '\n'.join(pain_points))
                    final_subject = subject_template.replace('{program_topics}', '\n'.join(program_topics))
                    final_subject = final_subject.replace('{pain_points}', '\n'.join(pain_points))
                    
                    cur.execute('''
                        INSERT INTO generated_emails (
                            event_list_id,
                            content_type_id,
                            subject,
                            html_content,
                            status
                        ) VALUES (%s, %s, %s, %s, %s)
                    ''', (
                        list_id,
                        content_type_id,
                        final_subject,
                        final_html,
                        'draft'
                    ))
                    created_count += 1
                
                conn.commit()
                
                message = f'Создано: {created_count}'
                if skipped_count > 0:
                    message += f', пропущено дублей: {skipped_count}'
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'count': created_count, 'skipped': skipped_count, 'message': message})
                }
            
            elif action == 'create_content_types':
                event_id = body_data.get('event_id')
                type_names = body_data.get('type_names', [])
                
                if not event_id or not type_names:
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'event_id and type_names required'})
                    }
                
                default_html_template = '''
                <html>
                <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h1>{subject}</h1>
                    <div>{content}</div>
                </body>
                </html>
                '''
                
                created_count = 0
                for name in type_names:
                    if not name or not name.strip():
                        continue
                    
                    cur.execute('''
                        INSERT INTO content_types (event_id, name, description)
                        VALUES (%s, %s, %s)
                        RETURNING id
                    ''', (event_id, name.strip(), f'Автоматически создан из контент-плана'))
                    
                    content_type_id = cur.fetchone()['id']
                    
                    cur.execute('''
                        INSERT INTO email_templates (
                            event_id, 
                            content_type_id, 
                            name, 
                            html_template, 
                            subject_template,
                            instructions
                        ) VALUES (%s, %s, %s, %s, %s, %s)
                    ''', (
                        event_id, 
                        content_type_id, 
                        f'Базовый шаблон: {name}',
                        default_html_template,
                        '{subject}',
                        f'Создай письмо в стиле "{name}". Используй информацию о программе мероприятия и болях целевой аудитории.'
                    ))
                    
                    created_count += 1
                
                conn.commit()
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'created_count': created_count, 'message': f'Created {created_count} content types'})
                }
            
            elif action == 'generate_from_content_plan':
                event_id = body_data.get('event_id')
                event_list_id = body_data.get('event_list_id')
                content_plan_doc_id = body_data.get('content_plan_doc_id', '')
                
                if not event_id or not event_list_id or not content_plan_doc_id:
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'event_id, event_list_id, content_plan_doc_id required'})
                    }
                
                print(f'[CONTENT_PLAN] Starting generation for event={event_id}, list={event_list_id}')
                
                cur.execute('SELECT * FROM events WHERE id = %s', (event_id,))
                evt = cur.fetchone()
                
                if not evt:
                    return {
                        'statusCode': 404,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'Event not found'})
                    }
                
                program_doc_id = evt['program_doc_id']
                pain_doc_id = evt['pain_doc_id']
                default_tone = evt.get('default_tone', 'professional')
                email_template_examples = evt.get('email_template_examples', '')
                
                print(f'[DEBUG] Reading program from: {program_doc_id}')
                program_text = read_google_doc(program_doc_id)
                
                print(f'[DEBUG] Reading pain points from: {pain_doc_id}')
                pain_points_text = read_google_doc(pain_doc_id)
                
                print(f'[DEBUG] Reading content plan from: {content_plan_doc_id}')
                content_plan_text = read_google_doc(content_plan_doc_id)
                
                cur.execute('SELECT * FROM content_types WHERE event_id = %s', (event_id,))
                content_types_list = cur.fetchall()
                content_type_map = {ct['name']: ct['id'] for ct in content_types_list}
                
                rows = []
                missing_types = set()
                
                for line in content_plan_text.split('\n'):
                    line = line.strip()
                    if not line or line.lower().startswith('заголовок'):
                        continue
                    
                    parts = line.split('\t')
                    if len(parts) >= 2:
                        title = parts[0].strip()
                        content_type_name = parts[1].strip()
                        
                        if title and content_type_name:
                            if content_type_name in content_type_map:
                                rows.append({
                                    'title': title,
                                    'content_type_id': content_type_map[content_type_name]
                                })
                            else:
                                missing_types.add(content_type_name)
                
                if missing_types:
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({
                            'error': 'missing_content_types',
                            'message': f'В настройках не найдены типы контента: {", ".join(missing_types)}',
                            'missing_types': list(missing_types),
                            'available_types': list(content_type_map.keys())
                        })
                    }
                
                print(f'[CONTENT_PLAN] Found {len(rows)} valid rows')
                
                cur.execute('''
                    SELECT ai_provider, ai_model, ai_assistant_id
                    FROM event_mailing_lists
                    WHERE id = %s
                ''', (event_list_id,))
                
                ai_settings = cur.fetchone()
                ai_provider = ai_settings['ai_provider'] if ai_settings else 'openai'
                ai_model = ai_settings['ai_model'] if ai_settings else 'gpt-4o-mini'
                ai_assistant_id = ai_settings['ai_assistant_id'] if ai_settings else ''
                
                # Используем OpenRouter для обхода региональных ограничений
                openrouter_key = os.environ.get('OPENROUTER_API_KEY')
                openai_key = os.environ.get('OPENAI_API_KEY')
                
                if openrouter_key:
                    api_key = openrouter_key
                    api_url = 'https://openrouter.ai/api/v1/chat/completions'
                    provider = 'openrouter'
                elif openai_key:
                    api_key = openai_key
                    api_url = 'https://api.openai.com/v1/chat/completions'
                    provider = 'openai'
                else:
                    return {
                        'statusCode': 500,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'OPENROUTER_API_KEY or OPENAI_API_KEY not configured'})
                    }
                
                print(f'[AI] Using provider={provider}, model={ai_model}, api_url={api_url}')
                
                generated_count = 0
                for row in rows:
                    title = row['title']
                    content_type_id = row['content_type_id']
                    
                    cur.execute('''
                        SELECT html_template, subject_template, instructions
                        FROM email_templates
                        WHERE event_id = %s AND content_type_id = %s
                        LIMIT 1
                    ''', (event_id, content_type_id))
                    
                    template_row = cur.fetchone()
                    if not template_row:
                        print(f'[WARN] No template for content_type_id={content_type_id}')
                        continue
                    
                    instructions = template_row['instructions'] or ''
                    html_template = template_row['html_template'] or ''
                    subject_template = template_row['subject_template'] or ''
                    
                    tone_descriptions = {
                        'professional': 'профессиональный и деловой',
                        'friendly': 'дружелюбный и неформальный',
                        'enthusiastic': 'энергичный и вдохновляющий',
                        'formal': 'формальный и официальный',
                        'casual': 'лёгкий и непринужденный'
                    }
                    tone_desc = tone_descriptions.get(default_tone, default_tone)
                    
                    prompt = f"""Ты - эксперт по email-маркетингу. Твоя задача - создать эффективное письмо для рассылки.

КОНТЕКСТ МЕРОПРИЯТИЯ:
Название: {evt.get('name', '')}
Тон общения: {tone_desc}

ПРОГРАММА МЕРОПРИЯТИЯ:
{program_text[:3000]}

БОЛИ ЦЕЛЕВОЙ АУДИТОРИИ:
{pain_points_text[:2000]}

ЗАДАНИЕ НА ПИСЬМО:
Тема/заголовок: {title}
Тип контента: {instructions}

ПРИМЕРЫ СТИЛЯ ПИСЕМ (если есть):
{email_template_examples[:1000] if email_template_examples else 'Используй профессиональный стиль email-маркетинга'}

ТРЕБОВАНИЯ:
1. Изучи программу мероприятия и выбери темы, максимально соответствующие заголовку "{title}"
2. Определи из списка болей ЦА те, которые решаются выбранными темами программы
3. Создай цепляющую тему письма (subject) длиной до 60 символов, которая отражает суть и привлекает внимание
4. Создай HTML-письмо:
   - Начни с яркого крючка (боль или выгода)
   - Покажи как программа решает эту боль
   - Используй конкретные темы из программы
   - Добавь призыв к действию
   - Соблюдай тон: {tone_desc}
   - Структурируй текст: заголовки, абзацы, списки
   - HTML должен быть валидным и адаптивным

ФОРМАТ ОТВЕТА (строго JSON):
{{"subject": "цепляющая тема письма", "html": "<html><body>...полный HTML код письма...</body></html>"}}

Верни ТОЛЬКО JSON, без дополнительных комментариев."""
                    
                    print(f'[AI] Generating for title: {title}')
                    
                    try:
                        request_payload = {
                            'model': ai_model,
                            'messages': [
                                {
                                    'role': 'system', 
                                    'content': f'Ты профессиональный email-маркетолог. Стиль общения: {tone_desc}. Отвечаешь строго в формате JSON.'
                                },
                                {
                                    'role': 'user', 
                                    'content': prompt
                                }
                            ],
                            'temperature': 0.8,
                            'max_tokens': 4000
                        }
                        
                        print(f'[AI] Request payload: model={ai_model}, temp=0.8, max_tokens=4000')
                        
                        req = urllib.request.Request(
                            api_url,
                            data=json.dumps(request_payload).encode('utf-8'),
                            headers={
                                'Content-Type': 'application/json',
                                'Authorization': f'Bearer {api_key}'
                            }
                        )
                        
                        with urllib.request.urlopen(req, timeout=60) as response:
                            result = json.loads(response.read().decode('utf-8'))
                            content = result['choices'][0]['message']['content']
                            
                            content = content.strip()
                            if content.startswith('```json'):
                                content = content[7:]
                            if content.startswith('```'):
                                content = content[3:]
                            if content.endswith('```'):
                                content = content[:-3]
                            content = content.strip()
                            
                            try:
                                email_data = json.loads(content)
                            except json.JSONDecodeError as json_err:
                                print(f'[ERROR] JSON parse failed for "{title}": {str(json_err)}')
                                print(f'[ERROR] Content preview: {content[:500]}')
                                
                                # Пробуем исправить проблемные escape-последовательности
                                try:
                                    import re
                                    # Убираем одинарные обратные слэши перед буквами (не \n, \t, \", \\)
                                    fixed_content = re.sub(r'\\(?![ntr"\\])', '', content)
                                    email_data = json.loads(fixed_content)
                                    print(f'[AI] Fixed JSON parsing with regex cleanup')
                                except Exception as e2:
                                    print(f'[ERROR] Even after cleanup failed: {str(e2)}')
                                    continue
                            final_subject = email_data.get('subject', title)
                            final_html = email_data.get('html', '')
                            
                            print(f'[AI] Generated subject: {final_subject}')
                            
                            cur.execute('''
                                INSERT INTO generated_emails (
                                    event_list_id,
                                    content_type_id,
                                    subject,
                                    html_content,
                                    status
                                ) VALUES (%s, %s, %s, %s, %s)
                            ''', (
                                event_list_id,
                                content_type_id,
                                final_subject,
                                final_html,
                                'draft'
                            ))
                            generated_count += 1
                            
                    except urllib.error.HTTPError as e:
                        error_body = e.read().decode('utf-8') if hasattr(e, 'read') else str(e)
                        print(f'[ERROR] API HTTP Error for "{title}": {e.code} - {error_body[:500]}')
                        continue
                    except urllib.error.URLError as e:
                        print(f'[ERROR] API timeout/network error for "{title}": {str(e)}')
                        continue
                    except Exception as e:
                        print(f'[ERROR] AI generation failed for "{title}": {type(e).__name__} - {str(e)[:500]}')
                        continue
                
                conn.commit()
                print(f'[CONTENT_PLAN] Generated {generated_count} emails')
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'generated_count': generated_count})
                }
            
            elif action == 'generate_single_email':
                event_id = body_data.get('event_id')
                event_list_id = body_data.get('event_list_id')
                title = body_data.get('title', '')
                content_type_name = body_data.get('content_type', '')
                
                if not event_id or not event_list_id or not title or not content_type_name:
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'event_id, event_list_id, title, content_type required'})
                    }
                
                print(f'[SINGLE_EMAIL] Generating for title="{title}", type="{content_type_name}"')
                
                cur.execute('SELECT program_doc_id, pain_doc_id FROM events WHERE id = %s', (event_id,))
                event_row = cur.fetchone()
                
                if not event_row:
                    return {
                        'statusCode': 404,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'Event not found'})
                    }
                
                program_doc_id = event_row['program_doc_id'] or ''
                pain_doc_id = event_row['pain_doc_id'] or ''
                
                program_text = read_google_doc(program_doc_id) if program_doc_id else ''
                pain_text = read_google_doc(pain_doc_id) if pain_doc_id else ''
                
                cur.execute('SELECT id FROM content_types WHERE event_id = %s AND name = %s', (event_id, content_type_name))
                content_type_row = cur.fetchone()
                
                if not content_type_row:
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'missing_content_type', 'message': f'Content type "{content_type_name}" not found'})
                    }
                
                content_type_id = content_type_row['id']
                
                # Проверяем, есть ли уже черновик для этого title + content_type
                cur.execute('''
                    SELECT id FROM generated_emails
                    WHERE event_list_id = %s 
                      AND content_type_id = %s 
                      AND subject = %s 
                      AND status = 'draft'
                    LIMIT 1
                ''', (event_list_id, content_type_id, title))
                
                existing = cur.fetchone()
                if existing:
                    return {
                        'statusCode': 200,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({
                            'success': True, 
                            'skipped': True,
                            'email_id': existing['id'],
                            'message': f'Черновик "{title}" уже существует'
                        })
                    }
                
                cur.execute('''
                    SELECT html_template, subject_template, instructions
                    FROM email_templates
                    WHERE event_id = %s AND content_type_id = %s
                    LIMIT 1
                ''', (event_id, content_type_id))
                
                template_row = cur.fetchone()
                if not template_row:
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'Template not found for this content type'})
                    }
                
                instructions = template_row['instructions'] or ''
                html_template = template_row['html_template'] or ''
                
                cur.execute('''
                    SELECT ai_provider, ai_model, ai_assistant_id
                    FROM event_mailing_lists
                    WHERE id = %s
                ''', (event_list_id,))
                
                ai_settings = cur.fetchone()
                ai_model = ai_settings['ai_model'] if ai_settings else 'gpt-4o-mini'
                
                openrouter_key = os.environ.get('OPENROUTER_API_KEY')
                openai_key = os.environ.get('OPENAI_API_KEY')
                
                if openrouter_key:
                    api_key = openrouter_key
                    api_url = 'https://openrouter.ai/api/v1/chat/completions'
                elif openai_key:
                    api_key = openai_key
                    api_url = 'https://api.openai.com/v1/chat/completions'
                else:
                    return {
                        'statusCode': 500,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'OPENROUTER_API_KEY or OPENAI_API_KEY not configured'})
                    }
                
                prompt = f"""
Тема письма: {title}
Инструкции для генерации: {instructions}

Программа мероприятия:
{program_text[:3000]}

Боли целевой аудитории:
{pain_text[:2000]}

Шаблон HTML:
{html_template[:1000]}

Создай письмо на основе этих данных. Верни JSON:
{{
  "subject": "Тема письма",
  "html": "<html>...</html>"
}}
"""
                
                request_payload = {
                    'model': ai_model,
                    'messages': [
                        {'role': 'system', 'content': 'Ты - эксперт по email маркетингу. Создаёшь продающие письма.'},
                        {'role': 'user', 'content': prompt}
                    ],
                    'temperature': 0.8,
                    'max_tokens': 4000
                }
                
                try:
                    req = urllib.request.Request(
                        api_url,
                        data=json.dumps(request_payload).encode('utf-8'),
                        headers={
                            'Content-Type': 'application/json',
                            'Authorization': f'Bearer {api_key}'
                        }
                    )
                    
                    with urllib.request.urlopen(req, timeout=60) as response:
                        result = json.loads(response.read().decode('utf-8'))
                        content = result['choices'][0]['message']['content']
                        
                        content = content.strip()
                        if content.startswith('```json'):
                            content = content[7:]
                        if content.startswith('```'):
                            content = content[3:]
                        if content.endswith('```'):
                            content = content[:-3]
                        content = content.strip()
                        
                        try:
                            email_data = json.loads(content)
                        except json.JSONDecodeError as json_err:
                            import re
                            fixed_content = re.sub(r'\\(?![ntr"\\])', '', content)
                            email_data = json.loads(fixed_content)
                        
                        final_subject = email_data.get('subject', title)
                        final_html = email_data.get('html', '')
                        
                        cur.execute('''
                            INSERT INTO generated_emails (
                                event_list_id,
                                content_type_id,
                                subject,
                                html_content,
                                status
                            ) VALUES (%s, %s, %s, %s, %s)
                            RETURNING id
                        ''', (
                            event_list_id,
                            content_type_id,
                            final_subject,
                            final_html,
                            'draft'
                        ))
                        
                        email_id = cur.fetchone()['id']
                        conn.commit()
                        
                        return {
                            'statusCode': 200,
                            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                            'body': json.dumps({'success': True, 'email_id': email_id, 'subject': final_subject})
                        }
                
                except Exception as e:
                    conn.rollback()
                    print(f'[ERROR] Single email generation failed: {type(e).__name__} - {str(e)[:500]}')
                    return {
                        'statusCode': 500,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': f'Generation failed: {str(e)[:200]}'})
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
                
                for field in ['name', 'description', 'start_date', 'end_date', 'program_doc_id', 'pain_doc_id', 'default_tone', 'email_template_examples', 'logo_url']:
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
        
        elif method == 'DELETE':
            params = event.get('queryStringParameters') or {}
            action = params.get('action', '')
            
            if action == 'delete_draft':
                draft_id = params.get('draft_id')
                
                if not draft_id:
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'draft_id required'})
                    }
                
                cur.execute('DELETE FROM generated_emails WHERE id = %s', (draft_id,))
                conn.commit()
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'message': 'Draft deleted successfully'})
                }
            
            elif action == 'delete_all_drafts':
                list_id = params.get('list_id')
                
                if not list_id:
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'list_id required'})
                    }
                
                cur.execute('DELETE FROM generated_emails WHERE event_list_id = %s AND status = %s', (list_id, 'draft'))
                deleted_count = cur.rowcount
                conn.commit()
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'message': f'Deleted {deleted_count} drafts', 'count': deleted_count})
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