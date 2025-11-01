import json
import os
from typing import Dict, Any, List
import psycopg2
import urllib.request
import urllib.parse
import csv
from io import StringIO

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Business: Индексирует знания мероприятия из Google Docs в knowledge_store с эмбеддингами для RAG
    Args: event - dict с httpMethod, body {event_id: int}
    Returns: HTTP response с количеством проиндексированных элементов
    '''
    method: str = event.get('httpMethod', 'GET')
    
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
    
    if method == 'POST':
        body_str = event.get('body', '{}')
        if not body_str or body_str == '':
            body_str = '{}'
        body_data = json.loads(body_str)
        
        event_id = body_data.get('event_id')
        
        if not event_id:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'event_id required'})
            }
        
        db_url = os.environ.get('DATABASE_URL', '')
        if not db_url:
            return {
                'statusCode': 500,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'DATABASE_URL not configured'})
            }
        
        openrouter_key = os.environ.get('OPENROUTER_API_KEY', '')
        if not openrouter_key:
            return {
                'statusCode': 500,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'OPENROUTER_API_KEY not configured'})
            }
        
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()
        
        cur.execute(
            "SELECT program_doc_id, pain_doc_id FROM t_p22819116_event_schedule_app.events WHERE id = " + str(event_id)
        )
        
        result = cur.fetchone()
        
        if not result:
            cur.close()
            conn.close()
            return {
                'statusCode': 404,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'Event not found'})
            }
        
        program_doc_url, pain_doc_url = result
        
        cur.execute(
            "DELETE FROM t_p22819116_event_schedule_app.knowledge_store WHERE event_id = " + str(event_id)
        )
        conn.commit()
        
        indexed_count = 0
        
        if program_doc_url:
            program_text = read_google_doc(program_doc_url)
            if program_text:
                lines = program_text.strip().split('\n')
                
                max_items = 50
                processed = 0
                
                for line in lines:
                    if processed >= max_items:
                        print(f"[INFO] Reached limit of {max_items} program items")
                        break
                    
                    line = line.strip()
                    if not line or len(line) < 10:
                        continue
                    
                    try:
                        embedding = create_embedding(line, openrouter_key)
                        
                        cur.execute(
                            "INSERT INTO t_p22819116_event_schedule_app.knowledge_store (event_id, item_type, content, metadata, embedding) VALUES (" + 
                            str(event_id) + ", 'program_item', '" + line.replace("'", "''") + "', '{}', ARRAY[" + 
                            ",".join(str(x) for x in embedding) + "])"
                        )
                        
                        indexed_count += 1
                        processed += 1
                    except Exception as e:
                        print(f"[ERROR] Failed to index program line: {str(e)}")
                        continue
        
        if pain_doc_url:
            pain_text = read_google_doc(pain_doc_url)
            if pain_text:
                paragraphs = [p.strip() for p in pain_text.split('\n\n') if p.strip()]
                
                max_pain_items = 20
                processed_pain = 0
                
                for para in paragraphs:
                    if processed_pain >= max_pain_items:
                        print(f"[INFO] Reached limit of {max_pain_items} pain points")
                        break
                    
                    if len(para) < 10:
                        continue
                    
                    try:
                        embedding = create_embedding(para, openrouter_key)
                        
                        cur.execute(
                            "INSERT INTO t_p22819116_event_schedule_app.knowledge_store (event_id, item_type, content, metadata, embedding) VALUES (" + 
                            str(event_id) + ", 'pain_point', '" + para.replace("'", "''") + "', '{}', ARRAY[" + 
                            ",".join(str(x) for x in embedding) + "])"
                        )
                        
                        indexed_count += 1
                        processed_pain += 1
                    except Exception as e:
                        print(f"[ERROR] Failed to index pain point: {str(e)}")
                        continue
        
        conn.commit()
        cur.close()
        conn.close()
        
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({
                'success': True,
                'indexed_count': indexed_count,
                'event_id': event_id
            })
        }
    
    return {
        'statusCode': 405,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'body': json.dumps({'error': 'Method not allowed'})
    }

def read_google_doc(url: str) -> str:
    """Читает Google Docs или Sheets"""
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
            return ''
        
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

def create_embedding(text: str, api_key: str) -> List[float]:
    """Создаёт эмбеддинг через OpenRouter API"""
    data = {
        'model': 'openai/text-embedding-3-small',
        'input': text
    }
    
    req = urllib.request.Request(
        'https://openrouter.ai/api/v1/embeddings',
        data=json.dumps(data).encode('utf-8'),
        headers={
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {api_key}',
            'HTTP-Referer': 'https://poehali.dev',
            'X-Title': 'Event Schedule App'
        }
    )
    
    with urllib.request.urlopen(req) as response:
        response_text = response.read().decode('utf-8')
        result = json.loads(response_text)
        
        if 'error' in result:
            raise Exception(f"OpenRouter API error: {result['error']}")
        
        if 'data' not in result or len(result['data']) == 0:
            raise Exception(f"Invalid OpenRouter response: {response_text[:200]}")
        
        return result['data'][0]['embedding']