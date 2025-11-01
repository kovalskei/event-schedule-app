'''
Execute HTTP POST request to template-generator function
Reads HTML content from request body and forwards it to the template-generator
'''

import json
import urllib.request
import urllib.parse

def handler(event, context):
    """Execute HTTP POST request to template-generator"""
    
    method = event.get('httpMethod', 'GET')
    
    # Handle OPTIONS for CORS
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
    
    try:
        # Parse request body
        body_data = json.loads(event.get('body', '{}'))
        html_content = body_data.get('html_content', '')
        
        if not html_content:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'html_content is required in request body'})
            }
        
        # Prepare request to template-generator
        request_body = {
            'html_content': html_content,
            'event_id': body_data.get('event_id', 1),
            'content_type_id': body_data.get('content_type_id', 13),
            'name': body_data.get('name', 'Тестовый лонгрид со стилями')
        }
        
        print(f'Making POST request to template-generator...')
        print(f'HTML content length: {len(html_content)} characters')
        print(f'Request body size: {len(json.dumps(request_body))} bytes')
        
        # Make the request to template-generator
        url = 'https://functions.poehali.dev/616d6890-24c3-49c8-8b29-692dd342933b'
        data = json.dumps(request_body).encode('utf-8')
        
        req = urllib.request.Request(
            url,
            data=data,
            headers={'Content-Type': 'application/json'},
            method='POST'
        )
        
        try:
            with urllib.request.urlopen(req, timeout=30) as response:
                response_text = response.read().decode('utf-8')
                status_code = response.status
                
                # Try to parse JSON
                try:
                    response_data = json.loads(response_text)
                except json.JSONDecodeError:
                    response_data = {'raw': response_text}
                
                # Prepare result
                result = {
                    'status_code': status_code,
                    'ok': status_code >= 200 and status_code < 300,
                    'response_body': response_data,
                    'summary': {
                        'template_id': response_data.get('template_id') if isinstance(response_data, dict) else None,
                        'example_id': response_data.get('example_id') if isinstance(response_data, dict) else None,
                        'error': response_data.get('error') if isinstance(response_data, dict) else None,
                        'message': response_data.get('message') if isinstance(response_data, dict) else None
                    }
                }
                
                print(f'Response: {json.dumps(result, indent=2, ensure_ascii=False)}')
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps(result, ensure_ascii=False)
                }
                
        except urllib.error.HTTPError as e:
            error_body = e.read().decode('utf-8')
            try:
                error_data = json.loads(error_body)
            except:
                error_data = {'raw': error_body}
            
            result = {
                'status_code': e.code,
                'ok': False,
                'response_body': error_data,
                'summary': {
                    'template_id': None,
                    'example_id': None,
                    'error': error_data.get('error') if isinstance(error_data, dict) else str(e),
                    'message': error_data.get('message') if isinstance(error_data, dict) else None
                }
            }
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps(result, ensure_ascii=False)
            }
            
    except Exception as e:
        print(f'[ERROR] {str(e)}')
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({
                'error': 'Failed to execute request',
                'message': str(e)
            })
        }
