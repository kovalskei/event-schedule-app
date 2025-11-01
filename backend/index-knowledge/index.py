import json
import os
import re
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
        
        openai_key = os.environ.get('OPENAI_API_KEY', '')
        openrouter_key = os.environ.get('OPENROUTER_API_KEY', '')
        gemini_key = os.environ.get('GEMINI_API_KEY', '')
        
        if not openai_key and not openrouter_key and not gemini_key:
            return {
                'statusCode': 500,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'OPENAI_API_KEY, OPENROUTER_API_KEY or GEMINI_API_KEY required'})
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
                
                max_items = 20
                processed = 0
                
                for line in lines:
                    if processed >= max_items:
                        print(f"[INFO] Reached limit of {max_items} program items")
                        break
                    
                    line = line.strip()
                    if not line or len(line) < 10:
                        continue
                    
                    try:
                        embedding = create_embedding(line, openai_key, openrouter_key, gemini_key)
                        
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
                
                max_pain_items = 10
                processed_pain = 0
                
                for para in paragraphs:
                    if processed_pain >= max_pain_items:
                        print(f"[INFO] Reached limit of {max_pain_items} pain points")
                        break
                    
                    if len(para) < 10:
                        continue
                    
                    try:
                        embedding = create_embedding(para, openai_key, openrouter_key, gemini_key)
                        
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
        
        cur.execute(
            "SELECT html_layout FROM t_p22819116_event_schedule_app.email_templates WHERE event_id = " + str(event_id) + " LIMIT 10"
        )
        
        templates = cur.fetchall()
        
        if templates:
            style_snippets = extract_style_snippets([t[0] for t in templates])
            
            max_snippets = 10
            processed_snippets = 0
            
            for snippet in style_snippets:
                if processed_snippets >= max_snippets:
                    print(f"[INFO] Reached limit of {max_snippets} style snippets")
                    break
                
                if len(snippet) < 20:
                    continue
                
                try:
                    embedding = create_embedding(snippet, openai_key, openrouter_key, gemini_key)
                    
                    cur.execute(
                        "INSERT INTO t_p22819116_event_schedule_app.knowledge_store (event_id, item_type, content, metadata, embedding) VALUES (" + 
                        str(event_id) + ", 'style_snippet', '" + snippet.replace("'", "''") + "', '{}', ARRAY[" + 
                        ",".join(str(x) for x in embedding) + "])"
                    )
                    
                    indexed_count += 1
                    processed_snippets += 1
                except Exception as e:
                    print(f"[ERROR] Failed to index style snippet: {str(e)}")
                    continue
            
            print(f"[INFO] Indexed {processed_snippets} style snippets from email templates")
        
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

def extract_style_snippets(html_templates: List[str]) -> List[str]:
    """Извлекает тон и стиль общения из HTML шаблонов (без CTA и структурных элементов)"""
    snippets = []
    
    for html in html_templates:
        text = re.sub(r'<[^>]+>', ' ', html)
        text = re.sub(r'\s+', ' ', text).strip()
        
        text = re.sub(r'\{\{[^}]+\}\}', '', text)
        
        sentences = re.split(r'[.!?]+', text)
        
        for sent in sentences:
            sent = sent.strip()
            
            if len(sent) < 30 or len(sent) > 250:
                continue
            
            if re.search(r'(регистр|билет|ссылк|кнопк|переход|смотр|подробн)', sent, re.IGNORECASE):
                continue
            
            style_indicators = [
                'рад', 'расскажем', 'поделимся', 'узнаете', 'разберём',
                'важно', 'полезн', 'интересн', 'уникальн', 'эксклюзив',
                'друзья', 'коллеги', 'сообщество', 'вместе',
                'опыт', 'знания', 'практик', 'кейс', 'история'
            ]
            
            if any(keyword in sent.lower() for keyword in style_indicators):
                if sent not in snippets and len(snippets) < 15:
                    snippets.append(sent)
        
        greeting_pattern = r'((?:Привет|Здравствуй|Дорог|Уважаем)[^.!?]{20,200}[.!?])'
        greeting_match = re.search(greeting_pattern, text, re.IGNORECASE)
        if greeting_match:
            greeting = greeting_match.group(1).strip()
            if greeting not in snippets and len(snippets) < 15:
                snippets.insert(0, greeting)
        
        intro_pattern = r'([^.!?]{20,200}(?:рады|приглашаем|ждём|хотим поделиться)[^.!?]{20,200}[.!?])'
        intro_match = re.search(intro_pattern, text, re.IGNORECASE)
        if intro_match:
            intro = intro_match.group(1).strip()
            if intro not in snippets and len(snippets) < 15:
                snippets.append(intro)
    
    return snippets[:15]

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

def create_embedding(text: str, openai_key: str, openrouter_key: str, gemini_key: str = '') -> List[float]:
    """Создаёт эмбеддинг через Gemini (приоритет), OpenAI или OpenRouter"""
    
    if gemini_key:
        url = f'https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key={gemini_key}'
        data = {
            'model': 'models/text-embedding-004',
            'content': {
                'parts': [{
                    'text': text
                }]
            }
        }
        
        req = urllib.request.Request(
            url,
            data=json.dumps(data).encode('utf-8'),
            headers={'Content-Type': 'application/json'}
        )
        
        try:
            with urllib.request.urlopen(req, timeout=10) as response:
                response_text = response.read().decode('utf-8')
                result = json.loads(response_text)
                
                if 'error' in result:
                    print(f"[WARNING] Gemini API error: {result['error']}, trying OpenAI")
                    if not openai_key and not openrouter_key:
                        raise Exception(f"Gemini API error: {result['error']}")
                else:
                    return result['embedding']['values']
        except Exception as e:
            print(f"[WARNING] Gemini request failed: {str(e)}, trying OpenAI")
            if not openai_key and not openrouter_key:
                raise
    
    if openai_key:
        data = {
            'model': 'text-embedding-3-small',
            'input': text
        }
        
        req = urllib.request.Request(
            'https://api.openai.com/v1/embeddings',
            data=json.dumps(data).encode('utf-8'),
            headers={
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {openai_key}'
            }
        )
        
        try:
            with urllib.request.urlopen(req, timeout=15) as response:
                response_text = response.read().decode('utf-8')
                result = json.loads(response_text)
                
                if 'error' in result:
                    print(f"[WARNING] OpenAI API error: {result['error']}, falling back to OpenRouter")
                    if not openrouter_key:
                        raise Exception(f"OpenAI API error: {result['error']}")
                else:
                    return result['data'][0]['embedding']
        except Exception as e:
            print(f"[WARNING] OpenAI request failed: {str(e)}, falling back to OpenRouter")
            if not openrouter_key:
                raise
    
    if openrouter_key:
        data = {
            'model': 'text-embedding-3-small',
            'input': text
        }
        
        req = urllib.request.Request(
            'https://openrouter.ai/api/v1/embeddings',
            data=json.dumps(data).encode('utf-8'),
            headers={
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {openrouter_key}',
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
                raise Exception(f"Invalid response: {response_text[:200]}")
            
            return result['data'][0]['embedding']
    
    raise Exception('No API key available for embeddings')