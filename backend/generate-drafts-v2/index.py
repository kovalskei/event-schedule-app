import json
import os
from typing import Dict, Any, List
import psycopg2
import urllib.request
import urllib.parse

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Business: Генерирует черновики писем через V2 pipeline с RAG-поиском из knowledge_store
    Args: event - dict с httpMethod, body {event_id: int, content_type_id: int}
    Returns: HTTP response с сгенерированным письмом (subject, html)
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
        content_type_id = body_data.get('content_type_id')
        
        if not event_id or not content_type_id:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'event_id and content_type_id required'})
            }
        
        db_url = os.environ.get('DATABASE_URL', '')
        if not db_url:
            return {
                'statusCode': 500,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'DATABASE_URL not configured'})
            }
        
        openai_key = os.environ.get('OPENAI_API_KEY', '')
        if not openai_key:
            return {
                'statusCode': 500,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'OPENAI_API_KEY not configured'})
            }
        
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()
        
        cur.execute(
            "SELECT use_v2_pipeline FROM t_p22819116_event_schedule_app.events WHERE id = " + str(event_id)
        )
        result = cur.fetchone()
        
        if not result or not result[0]:
            cur.close()
            conn.close()
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'V2 pipeline not enabled for this event'})
            }
        
        cur.execute(
            "SELECT name, instructions, html_layout, slots_schema FROM t_p22819116_event_schedule_app.email_templates WHERE event_id = " + 
            str(event_id) + " AND content_type_id = " + str(content_type_id) + " LIMIT 1"
        )
        
        template_row = cur.fetchone()
        
        if not template_row:
            cur.close()
            conn.close()
            return {
                'statusCode': 404,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'Template not found for this content type'})
            }
        
        template_name, instructions, html_layout, slots_schema = template_row
        
        query_text = instructions if instructions else template_name
        query_embedding = create_embedding(query_text, openai_key)
        
        cur.execute(
            "SELECT content, item_type, metadata FROM t_p22819116_event_schedule_app.knowledge_store WHERE event_id = " + 
            str(event_id) + " ORDER BY embedding <-> ARRAY[" + ",".join(str(x) for x in query_embedding) + "] LIMIT 5"
        )
        
        rag_results = cur.fetchall()
        
        if not rag_results:
            cur.close()
            conn.close()
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'No knowledge indexed for this event. Run indexing first.'})
            }
        
        context_texts = []
        for content, item_type, metadata_str in rag_results:
            context_texts.append(f"[{item_type}] {content}")
        
        context = "\n".join(context_texts)
        
        prompt = f"""Ты — эксперт по email-маркетингу для мероприятий.

КОНТЕКСТ (релевантные данные из RAG):
{context}

ИНСТРУКЦИИ ДЛЯ ПИСЬМА:
{instructions}

ЗАДАЧА:
Создай цепляющее маркетинговое письмо на основе контекста.

Верни JSON в формате:
{{"subject": "тема письма (до 50 символов)", "html": "HTML код письма с профессиональным дизайном"}}

HTML должен быть адаптивным, с CTA-кнопкой и структурой как у профессиональных email-рассылок.
"""
        
        generated = call_openai(prompt, openai_key)
        
        cur.close()
        conn.close()
        
        try:
            result_json = json.loads(generated)
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({
                    'success': True,
                    'subject': result_json.get('subject', ''),
                    'html': result_json.get('html', ''),
                    'template_name': template_name,
                    'rag_context_items': len(rag_results)
                })
            }
        except:
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({
                    'success': True,
                    'subject': 'Письмо сгенерировано',
                    'html': generated,
                    'template_name': template_name,
                    'rag_context_items': len(rag_results)
                })
            }
    
    return {
        'statusCode': 405,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'body': json.dumps({'error': 'Method not allowed'})
    }

def create_embedding(text: str, api_key: str) -> List[float]:
    """Создаёт эмбеддинг через OpenAI API"""
    data = {
        'input': text,
        'model': 'text-embedding-3-small'
    }
    
    req = urllib.request.Request(
        'https://api.openai.com/v1/embeddings',
        data=json.dumps(data).encode('utf-8'),
        headers={
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {api_key}'
        }
    )
    
    with urllib.request.urlopen(req) as response:
        result = json.loads(response.read().decode('utf-8'))
        return result['data'][0]['embedding']

def call_openai(prompt: str, api_key: str) -> str:
    """Вызывает OpenAI Chat API"""
    data = {
        'model': 'gpt-4o-mini',
        'messages': [{'role': 'user', 'content': prompt}],
        'temperature': 0.7
    }
    
    req = urllib.request.Request(
        'https://api.openai.com/v1/chat/completions',
        data=json.dumps(data).encode('utf-8'),
        headers={
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {api_key}'
        }
    )
    
    with urllib.request.urlopen(req) as response:
        result = json.loads(response.read().decode('utf-8'))
        return result['choices'][0]['message']['content']
