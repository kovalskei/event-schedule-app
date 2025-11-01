import json
import os
import re
from typing import Dict, Any, List
import psycopg2
import urllib.request
import urllib.parse
import csv
from io import StringIO

def split_by_numbered_paragraphs(text: str) -> List[str]:
    """Разбивает текст на параграфы по нумерации (84., 85., 86. и т.д.)"""
    pattern = r'^\s*(\d+)\.\s+'
    
    paragraphs = []
    current_paragraph = []
    current_number = None
    
    for line in text.split('\n'):
        match = re.match(pattern, line)
        
        if match:
            if current_paragraph:
                paragraphs.append('\n'.join(current_paragraph).strip())
            
            current_number = match.group(1)
            current_paragraph = [line]
        else:
            if current_paragraph:
                current_paragraph.append(line)
    
    if current_paragraph:
        paragraphs.append('\n'.join(current_paragraph).strip())
    
    paragraphs = [p for p in paragraphs if len(p) >= 20]
    
    print(f"[INFO] Split text into {len(paragraphs)} numbered paragraphs")
    return paragraphs

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
            "SELECT COUNT(*) FROM t_p22819116_event_schedule_app.knowledge_store WHERE event_id = " + str(event_id)
        )
        existing_count = cur.fetchone()[0]
        
        if existing_count > 0:
            print(f"[INFO] Event {event_id} already has {existing_count} indexed items, skipping re-indexing")
            cur.close()
            conn.close()
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'message': f'Event already indexed with {existing_count} items', 'indexed_count': existing_count, 'skipped': True})
            }
        
        indexed_count = 0
        all_texts = []
        all_metadata = []
        
        if program_doc_url:
            program_text = read_google_doc(program_doc_url)
            if program_text:
                lines = program_text.strip().split('\n')
                processed = 0
                
                for line in lines:
                    line = line.strip()
                    if not line or len(line) < 10:
                        continue
                    all_texts.append(line)
                    all_metadata.append({'event_id': event_id, 'item_type': 'program_item', 'content': line})
                    processed += 1
                
                print(f"[INFO] Collected {processed} program items (all lines)")
        
        if pain_doc_url:
            pain_text = read_google_doc(pain_doc_url)
            if pain_text:
                paragraphs = split_by_numbered_paragraphs(pain_text)
                processed_pain = 0
                
                for para in paragraphs:
                    if len(para) < 10:
                        continue
                    all_texts.append(para)
                    all_metadata.append({'event_id': event_id, 'item_type': 'pain_point', 'content': para})
                    processed_pain += 1
                
                print(f"[INFO] Collected {processed_pain} pain points (all numbered paragraphs)")
        
        cur.execute(
            "SELECT html_layout FROM t_p22819116_event_schedule_app.email_templates WHERE event_id = " + str(event_id) + " LIMIT 10"
        )
        
        templates = cur.fetchall()
        
        if templates:
            style_snippets = extract_style_snippets([t[0] for t in templates])
            processed_snippets = 0
            
            for snippet in style_snippets:
                if len(snippet) < 20:
                    continue
                all_texts.append(snippet)
                all_metadata.append({'event_id': event_id, 'item_type': 'style_snippet', 'content': snippet})
                processed_snippets += 1
            
            print(f"[INFO] Collected {processed_snippets} style snippets (all snippets)")
        
        if not all_texts:
            print(f"[WARNING] No texts to index for event {event_id}")
            conn.commit()
            cur.close()
            conn.close()
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'success': True, 'indexed_count': 0, 'event_id': event_id})
            }
        
        print(f"[INFO] Creating embeddings for {len(all_texts)} texts...")
        embeddings = create_embeddings_batch(all_texts, openai_key, openrouter_key, gemini_key)
        
        for i, (meta, embedding) in enumerate(zip(all_metadata, embeddings)):
            try:
                cur.execute(
                    "INSERT INTO t_p22819116_event_schedule_app.knowledge_store (event_id, item_type, content, metadata, embedding) VALUES (" + 
                    str(meta['event_id']) + ", '" + meta['item_type'] + "', '" + meta['content'].replace("'", "''") + "', '{}', ARRAY[" + 
                    ",".join(str(x) for x in embedding) + "])"
                )
                indexed_count += 1
            except Exception as e:
                print(f"[ERROR] Failed to insert item {i}: {str(e)[:100]}")
                continue
        
        print(f"[SUCCESS] Inserted {indexed_count} items into database")
        
        conn.commit()
        cur.close()
        conn.close()
        
        print(f"[SUCCESS] Total indexed: {indexed_count} items for event {event_id}")
        
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

def create_embeddings_batch(texts: List[str], openai_key: str, openrouter_key: str, gemini_key: str = '') -> List[List[float]]:
    """Создаёт эмбеддинги батчем через OpenAI (быстрее чем по одному)"""
    
    if openai_key:
        data = {
            'model': 'text-embedding-3-small',
            'input': [text[:8000] for text in texts]
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
            with urllib.request.urlopen(req, timeout=30) as response:
                response_text = response.read().decode('utf-8')
                result = json.loads(response_text)
                
                if 'error' in result:
                    error_msg = result.get('error', {}).get('message', str(result['error']))
                    print(f"[WARNING] OpenAI batch error: {error_msg}, falling back to one-by-one")
                else:
                    embeddings = [item['embedding'] for item in result['data']]
                    print(f"[SUCCESS] Got {len(embeddings)} embeddings from OpenAI batch")
                    return embeddings
        except Exception as e:
            print(f"[WARNING] OpenAI batch failed: {str(e)[:200]}, falling back to one-by-one")
    
    print(f"[INFO] Processing {len(texts)} embeddings one by one...")
    embeddings = []
    for i, text in enumerate(texts):
        try:
            emb = create_embedding(text, openai_key, openrouter_key, gemini_key)
            embeddings.append(emb)
            if (i + 1) % 5 == 0:
                print(f"[INFO] Processed {i + 1}/{len(texts)} embeddings")
        except Exception as e:
            print(f"[ERROR] Failed embedding {i}: {str(e)[:100]}")
            embeddings.append([0.0] * 1536)
    
    return embeddings

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
            'input': text[:8000]
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
                    error_msg = result.get('error', {}).get('message', str(result['error']))
                    print(f"[WARNING] OpenAI API error: {error_msg}")
                    if not openrouter_key and not gemini_key:
                        raise Exception(f"OpenAI API error: {error_msg}")
                else:
                    return result['data'][0]['embedding']
        except urllib.error.HTTPError as e:
            error_body = e.read().decode('utf-8') if hasattr(e, 'read') else str(e)
            print(f"[WARNING] OpenAI HTTP error {e.code}: {error_body[:200]}")
            if not openrouter_key and not gemini_key:
                raise
        except Exception as e:
            print(f"[WARNING] OpenAI request failed: {str(e)[:200]}")
            if not openrouter_key and not gemini_key:
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