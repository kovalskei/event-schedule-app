import json
import os
from typing import Dict, Any
import psycopg2
from psycopg2.extras import RealDictCursor
import urllib.request
import urllib.parse

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Business: Синхронизирует события из базы с UniSender - создаёт/обновляет списки рассылки для каждого события
    Args: event - dict с httpMethod, body (event_id для синхронизации конкретного события или sync_all для всех)
    Returns: HTTP response со статусом синхронизации
    '''
    method: str = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Max-Age': '86400'
            },
            'body': ''
        }
    
    db_url = os.environ.get('DATABASE_URL', '')
    api_key = os.environ.get('UNISENDER_API_KEY', '')
    
    if not db_url:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'DATABASE_URL not configured'})
        }
    
    if not api_key:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'UNISENDER_API_KEY not configured'})
        }
    
    conn = psycopg2.connect(db_url)
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        if method == 'POST':
            body_str = event.get('body', '{}')
            if not body_str or body_str == '':
                body_str = '{}'
            body_data = json.loads(body_str)
            
            action = body_data.get('action', '')
            
            if action == 'sync_event':
                event_id = body_data.get('event_id')
                
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
                
                list_title = f"{evt['name']} - {evt['start_date']}"
                
                get_lists_params = {
                    'format': 'json',
                    'api_key': api_key
                }
                
                get_lists_data = urllib.parse.urlencode(get_lists_params).encode('utf-8')
                get_lists_req = urllib.request.Request('https://api.unisender.com/ru/api/getLists', data=get_lists_data)
                
                unisender_list_id = None
                
                with urllib.request.urlopen(get_lists_req) as response:
                    lists_result = json.loads(response.read().decode('utf-8'))
                    
                    if 'result' in lists_result:
                        for lst in lists_result['result']:
                            if lst['title'] == list_title:
                                unisender_list_id = str(lst['id'])
                                break
                
                if not unisender_list_id:
                    params = {
                        'format': 'json',
                        'api_key': api_key,
                        'title': list_title
                    }
                    
                    data = urllib.parse.urlencode(params).encode('utf-8')
                    req = urllib.request.Request('https://api.unisender.com/ru/api/createList', data=data)
                    
                    with urllib.request.urlopen(req) as response:
                        result = json.loads(response.read().decode('utf-8'))
                        
                        if 'result' in result:
                            unisender_list_id = str(result['result']['id'])
                        else:
                            return {
                                'statusCode': 500,
                                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                                'body': json.dumps({'error': result.get('error', 'Unknown error')})
                            }
                
                cur.execute('''
                    SELECT * FROM event_mailing_lists 
                    WHERE event_id = %s AND unisender_list_id = %s
                ''', (event_id, unisender_list_id))
                
                existing = cur.fetchone()
                
                if not existing:
                    cur.execute('''
                        INSERT INTO event_mailing_lists 
                        (event_id, unisender_list_id, unisender_list_name, utm_source, utm_medium, utm_campaign)
                        VALUES (%s, %s, %s, %s, %s, %s)
                    ''', (event_id, unisender_list_id, list_title, 'email', 'newsletter', evt['name']))
                    conn.commit()
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({
                        'success': True,
                        'unisender_list_id': unisender_list_id,
                        'message': 'Event synchronized with UniSender'
                    })
                }
            
            elif action == 'sync_all':
                cur.execute('SELECT * FROM events WHERE status = %s', ('active',))
                events = cur.fetchall()
                
                get_lists_params = {
                    'format': 'json',
                    'api_key': api_key
                }
                
                get_lists_data = urllib.parse.urlencode(get_lists_params).encode('utf-8')
                get_lists_req = urllib.request.Request('https://api.unisender.com/ru/api/getLists', data=get_lists_data)
                
                existing_lists = {}
                
                with urllib.request.urlopen(get_lists_req) as response:
                    lists_result = json.loads(response.read().decode('utf-8'))
                    
                    if 'result' in lists_result:
                        for lst in lists_result['result']:
                            existing_lists[lst['title']] = str(lst['id'])
                
                synced = []
                errors = []
                
                for evt in events:
                    list_title = f"{evt['name']} - {evt['start_date']}"
                    
                    try:
                        unisender_list_id = existing_lists.get(list_title)
                        
                        if not unisender_list_id:
                            params = {
                                'format': 'json',
                                'api_key': api_key,
                                'title': list_title
                            }
                            
                            data = urllib.parse.urlencode(params).encode('utf-8')
                            req = urllib.request.Request('https://api.unisender.com/ru/api/createList', data=data)
                            
                            with urllib.request.urlopen(req) as response:
                                result = json.loads(response.read().decode('utf-8'))
                                
                                if 'result' in result:
                                    unisender_list_id = str(result['result']['id'])
                                else:
                                    errors.append({
                                        'event_id': evt['id'],
                                        'event_name': evt['name'],
                                        'error': result.get('error', 'Unknown error')
                                    })
                                    continue
                        
                        cur.execute('''
                            SELECT * FROM event_mailing_lists 
                            WHERE event_id = %s AND unisender_list_id = %s
                        ''', (evt['id'], unisender_list_id))
                        
                        existing = cur.fetchone()
                        
                        if not existing:
                            cur.execute('''
                                INSERT INTO event_mailing_lists 
                                (event_id, unisender_list_id, unisender_list_name, utm_source, utm_medium, utm_campaign)
                                VALUES (%s, %s, %s, %s, %s, %s)
                            ''', (evt['id'], unisender_list_id, list_title, 'email', 'newsletter', evt['name']))
                            conn.commit()
                        
                        synced.append({
                            'event_id': evt['id'],
                            'event_name': evt['name'],
                            'unisender_list_id': unisender_list_id
                        })
                    except Exception as e:
                        errors.append({
                            'event_id': evt['id'],
                            'event_name': evt['name'],
                            'error': str(e)
                        })
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({
                        'success': True,
                        'synced': synced,
                        'errors': errors,
                        'message': f'Synced {len(synced)} events, {len(errors)} errors'
                    })
                }
            
            else:
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Invalid action. Use: sync_event or sync_all'})
                }
        
        return {
            'statusCode': 405,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Method not allowed'})
        }
        
    finally:
        cur.close()
        conn.close()