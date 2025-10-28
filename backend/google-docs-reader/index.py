import json
import os
from typing import Dict, Any
import urllib.request
import urllib.parse
import csv
from io import StringIO

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
        
        try:
            if doc_type == 'sheets':
                export_url = f'https://docs.google.com/spreadsheets/d/{doc_id}/export?format=csv'
                
                req = urllib.request.Request(export_url)
                req.add_header('User-Agent', 'Mozilla/5.0')
                
                with urllib.request.urlopen(req) as response:
                    csv_content = response.read().decode('utf-8')
                    
                    csv_reader = csv.reader(StringIO(csv_content))
                    text_lines = []
                    
                    for row in csv_reader:
                        text_lines.append('\t'.join(row))
                    
                    full_text = '\n'.join(text_lines)
                    
                    return {
                        'statusCode': 200,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'doc_id': doc_id, 'type': 'sheets', 'content': full_text})
                    }
            else:
                export_url = f'https://docs.google.com/document/d/{doc_id}/export?format=txt'
                
                req = urllib.request.Request(export_url)
                req.add_header('User-Agent', 'Mozilla/5.0')
                
                with urllib.request.urlopen(req) as response:
                    text_content = response.read().decode('utf-8')
                    
                    return {
                        'statusCode': 200,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'doc_id': doc_id, 'type': 'docs', 'content': text_content})
                    }
                    
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return {
                    'statusCode': 404,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Document not found or not public. Make sure the document is shared as "Anyone with the link can view"'})
                }
            else:
                return {
                    'statusCode': e.code,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': f'Failed to fetch document: {str(e)}'})
                }
        except Exception as e:
            return {
                'statusCode': 500,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': f'Error reading document: {str(e)}'})
            }
    
    return {
        'statusCode': 405,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'body': json.dumps({'error': 'Method not allowed'})
    }