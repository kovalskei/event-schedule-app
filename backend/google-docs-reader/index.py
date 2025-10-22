import json
import os
from typing import Dict, Any
import urllib.request
import urllib.parse

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Business: Читает содержимое Google Docs или Google Sheets по ID или ссылке
    Args: event - dict с httpMethod, queryStringParameters (doc_id или url)
    Returns: HTTP response с текстом документа/таблицы
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
        doc_url = params.get('url', '')
        doc_type = 'docs'
        
        if doc_url:
            if '/document/d/' in doc_url:
                doc_id = doc_url.split('/document/d/')[1].split('/')[0]
                doc_type = 'docs'
            elif '/spreadsheets/d/' in doc_url:
                doc_id = doc_url.split('/spreadsheets/d/')[1].split('/')[0]
                doc_type = 'sheets'
            elif 'id=' in doc_url:
                doc_id = doc_url.split('id=')[1].split('&')[0]
            else:
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Invalid Google Docs/Sheets URL format'})
                }
        
        if not doc_id:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'doc_id or url parameter required'})
            }
        
        api_key = os.environ.get('GOOGLE_DOCS_API_KEY', '')
        
        if not api_key:
            return {
                'statusCode': 500,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'GOOGLE_DOCS_API_KEY not configured'})
            }
        
        if doc_type == 'sheets':
            url = f'https://sheets.googleapis.com/v4/spreadsheets/{doc_id}?key={api_key}'
            
            req = urllib.request.Request(url)
            
            with urllib.request.urlopen(req) as response:
                data = json.loads(response.read().decode('utf-8'))
                
                text_content = []
                if 'sheets' in data:
                    for sheet in data['sheets']:
                        sheet_title = sheet.get('properties', {}).get('title', '')
                        text_content.append(f"\n=== {sheet_title} ===\n")
                        
                        sheet_name = sheet['properties']['title']
                        values_url = f'https://sheets.googleapis.com/v4/spreadsheets/{doc_id}/values/{sheet_name}?key={api_key}'
                        values_req = urllib.request.Request(values_url)
                        
                        with urllib.request.urlopen(values_req) as values_response:
                            values_data = json.loads(values_response.read().decode('utf-8'))
                            rows = values_data.get('values', [])
                            
                            for row in rows:
                                text_content.append('\t'.join(str(cell) for cell in row))
                                text_content.append('\n')
                
                full_text = ''.join(text_content)
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'doc_id': doc_id, 'type': 'sheets', 'content': full_text})
                }
        else:
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
                    'body': json.dumps({'doc_id': doc_id, 'type': 'docs', 'content': full_text})
                }
    
    return {
        'statusCode': 405,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'body': json.dumps({'error': 'Method not allowed'})
    }
