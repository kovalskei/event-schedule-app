import json
import os
from typing import Dict, Any
import urllib.request
import urllib.parse

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Business: Читает содержимое Google Docs по ID документа
    Args: event - dict с httpMethod, queryStringParameters (doc_id)
    Returns: HTTP response с текстом документа
    '''
    method: str = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Max-Age': '86400'
            },
            'body': ''
        }
    
    if method == 'GET':
        params = event.get('queryStringParameters', {})
        doc_id = params.get('doc_id', '')
        
        if not doc_id:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'doc_id parameter required'})
            }
        
        api_key = os.environ.get('GOOGLE_DOCS_API_KEY', '')
        
        if not api_key:
            return {
                'statusCode': 500,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'GOOGLE_DOCS_API_KEY not configured'})
            }
        
        url = f'https://docs.googleapis.com/v1/documents/{doc_id}?key={api_key}'
        
        req = urllib.request.Request(url)
        
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode('utf-8'))
            
            text_content = []
            if 'body' in data and 'content' in data['body']:
                for element in data['body']['content']:
                    if 'paragraph' in element:
                        for text_run in element['paragraph'].get('elements', []):
                            if 'textRun' in text_run:
                                text_content.append(text_run['textRun']['content'])
            
            full_text = ''.join(text_content)
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'doc_id': doc_id, 'content': full_text})
            }
    
    return {
        'statusCode': 405,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'body': json.dumps({'error': 'Method not allowed'})
    }
