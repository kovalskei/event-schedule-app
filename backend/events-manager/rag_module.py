'''
RAG module for email generation: embeddings + top-k semantic search
'''

import os
import json
import psycopg2
import psycopg2.extras
import urllib.request
from typing import List, Dict, Any, Tuple

def get_embedding(text: str, api_key: str) -> List[float]:
    '''
    Get OpenAI text embedding (text-embedding-3-small, 1536 dims)
    '''
    url = 'https://api.openai.com/v1/embeddings'
    
    payload = {
        'model': 'text-embedding-3-small',
        'input': text[:8000]
    }
    
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode('utf-8'),
        headers={
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {api_key}'
        }
    )
    
    with urllib.request.urlopen(req, timeout=30) as response:
        result = json.loads(response.read().decode('utf-8'))
        return result['data'][0]['embedding']

def cosine_similarity(a: List[float], b: List[float]) -> float:
    '''
    Cosine similarity between two vectors
    '''
    dot_product = sum(x * y for x, y in zip(a, b))
    magnitude_a = sum(x * x for x in a) ** 0.5
    magnitude_b = sum(y * y for y in b) ** 0.5
    
    if magnitude_a == 0 or magnitude_b == 0:
        return 0.0
    
    return dot_product / (magnitude_a * magnitude_b)

def search_knowledge(
    conn,
    event_id: int,
    query: str,
    item_type: str,
    top_k: int = 5,
    api_key: str = None
) -> List[Dict[str, Any]]:
    '''
    Semantic search in knowledge_store using embeddings
    
    Args:
        conn: psycopg2 connection
        event_id: event ID
        query: search query text
        item_type: 'program_item', 'pain_point', 'style_snippet'
        top_k: number of results to return
        api_key: OpenAI API key for embeddings
    
    Returns:
        List of knowledge items with metadata and scores
    '''
    
    if not api_key:
        api_key = os.environ.get('OPENAI_API_KEY')
    
    if not api_key:
        print('[RAG] No API key for embeddings, returning empty results')
        return []
    
    query_embedding = get_embedding(query, api_key)
    
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    
    cur.execute('''
        SELECT id, content, metadata, embedding
        FROM t_p22819116_event_schedule_app.knowledge_store
        WHERE event_id = %s AND item_type = %s AND embedding IS NOT NULL
    ''', (event_id, item_type))
    
    items = cur.fetchall()
    
    if not items:
        print(f'[RAG] No {item_type} embeddings found for event {event_id}')
        return []
    
    scored_items = []
    for item in items:
        embedding = item['embedding']
        
        if not embedding:
            continue
        
        score = cosine_similarity(query_embedding, embedding)
        
        scored_items.append({
            'id': item['id'],
            'content': item['content'],
            'metadata': item['metadata'],
            'score': score,
            'type': item_type
        })
    
    scored_items.sort(key=lambda x: x['score'], reverse=True)
    
    return scored_items[:top_k]

def index_program_items(conn, event_id: int, program_data: List[Dict[str, Any]], api_key: str):
    '''
    Index program items (from Google Sheets) into knowledge_store
    
    Args:
        conn: psycopg2 connection
        event_id: event ID
        program_data: list of program items (title, speaker, time, track, abstract, tags)
        api_key: OpenAI API key
    '''
    
    cur = conn.cursor()
    
    cur.execute('''
        DELETE FROM t_p22819116_event_schedule_app.knowledge_store
        WHERE event_id = %s AND item_type = 'program_item'
    ''', (event_id,))
    
    for item in program_data:
        content = f"{item.get('title', '')} | {item.get('speaker', '')} | {item.get('abstract', '')}"
        
        metadata = {
            'title': item.get('title', ''),
            'speaker': item.get('speaker', ''),
            'time': item.get('time', ''),
            'track': item.get('track', ''),
            'hall': item.get('hall', ''),
            'tags': item.get('tags', [])
        }
        
        embedding = get_embedding(content, api_key)
        
        cur.execute('''
            INSERT INTO t_p22819116_event_schedule_app.knowledge_store
            (event_id, item_type, content, metadata, embedding)
            VALUES (%s, %s, %s, %s, %s)
        ''', (event_id, 'program_item', content, json.dumps(metadata), embedding))
    
    conn.commit()
    print(f'[RAG] Indexed {len(program_data)} program items')

def index_pain_points(conn, event_id: int, pain_points: List[str], api_key: str):
    '''
    Index pain points into knowledge_store
    
    Args:
        conn: psycopg2 connection
        event_id: event ID
        pain_points: list of pain point texts
        api_key: OpenAI API key
    '''
    
    cur = conn.cursor()
    
    cur.execute('''
        DELETE FROM t_p22819116_event_schedule_app.knowledge_store
        WHERE event_id = %s AND item_type = 'pain_point'
    ''', (event_id,))
    
    for pain in pain_points:
        if not pain.strip():
            continue
        
        embedding = get_embedding(pain, api_key)
        
        cur.execute('''
            INSERT INTO t_p22819116_event_schedule_app.knowledge_store
            (event_id, item_type, content, metadata, embedding)
            VALUES (%s, %s, %s, %s, %s)
        ''', (event_id, 'pain_point', pain, json.dumps({}), embedding))
    
    conn.commit()
    print(f'[RAG] Indexed {len(pain_points)} pain points')

def index_style_snippets(conn, event_id: int, snippets: List[str], api_key: str):
    '''
    Index style snippets into knowledge_store
    
    Args:
        conn: psycopg2 connection
        event_id: event ID
        snippets: list of email style examples
        api_key: OpenAI API key
    '''
    
    cur = conn.cursor()
    
    cur.execute('''
        DELETE FROM t_p22819116_event_schedule_app.knowledge_store
        WHERE event_id = %s AND item_type = 'style_snippet'
    ''', (event_id,))
    
    for snippet in snippets:
        if not snippet.strip():
            continue
        
        embedding = get_embedding(snippet, api_key)
        
        cur.execute('''
            INSERT INTO t_p22819116_event_schedule_app.knowledge_store
            (event_id, item_type, content, metadata, embedding)
            VALUES (%s, %s, %s, %s, %s)
        ''', (event_id, 'style_snippet', snippet, json.dumps({}), embedding))
    
    conn.commit()
    print(f'[RAG] Indexed {len(snippets)} style snippets')
