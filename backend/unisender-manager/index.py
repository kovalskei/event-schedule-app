import json
import os
from typing import Dict, Any
import urllib.request
import urllib.parse

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Business: Управляет UniSender - создаёт шаблоны, отправляет тесты, получает списки рассылки
    Args: event - dict с httpMethod, body (action: create_template|send_test|get_lists, subject, html, test_email)
    Returns: HTTP response с ID шаблона, статусом или списками рассылки
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
    
    api_key = os.environ.get('UNISENDER_API_KEY', '')
    
    if not api_key:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'UNISENDER_API_KEY not configured'})
        }
    
    if method == 'GET':
        params_dict = event.get('queryStringParameters', {})
        action = params_dict.get('action', '')
        
        if action == 'get_lists':
            params = {
                'format': 'json',
                'api_key': api_key
            }
            
            data = urllib.parse.urlencode(params).encode('utf-8')
            req = urllib.request.Request('https://api.unisender.com/ru/api/getLists', data=data)
            
            with urllib.request.urlopen(req) as response:
                result = json.loads(response.read().decode('utf-8'))
                
                if 'result' in result:
                    lists = [{
                        'id': lst['id'],
                        'title': lst['title']
                    } for lst in result['result']]
                    
                    return {
                        'statusCode': 200,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'lists': lists})
                    }
                else:
                    return {
                        'statusCode': 500,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': result.get('error', 'Unknown error')})
                    }
        
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Invalid action. Use: get_lists'})
        }
    
    if method == 'POST':
        body_str = event.get('body', '{}')
        if not body_str or body_str == '':
            body_str = '{}'
        body_data = json.loads(body_str)
        
        action = body_data.get('action', '')
        
        if not action:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'Invalid action. Use: create_template or send_test'})
            }
        
        if action == 'create_template':
            subject = body_data.get('subject', '')
            html = body_data.get('html', '')
            template_name = body_data.get('template_name', 'HR Campaign')
            
            if not subject or not html:
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'subject and html required'})
                }
            
            params = {
                'format': 'json',
                'api_key': api_key,
                'title': template_name,
                'subject': subject,
                'body': html,
                'lang': 'ru'
            }
            
            data = urllib.parse.urlencode(params).encode('utf-8')
            req = urllib.request.Request('https://api.unisender.com/ru/api/createEmailTemplate', data=data)
            
            with urllib.request.urlopen(req) as response:
                result = json.loads(response.read().decode('utf-8'))
                
                if 'result' in result:
                    return {
                        'statusCode': 200,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({
                            'template_id': result['result']['template_id'],
                            'message': 'Template created successfully'
                        })
                    }
                else:
                    return {
                        'statusCode': 500,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': result.get('error', 'Unknown error')})
                    }
        
        elif action == 'send_test':
            template_id = body_data.get('template_id', '')
            test_email = body_data.get('test_email', '')
            
            if not template_id or not test_email:
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'template_id and test_email required'})
                }
            
            params = {
                'format': 'json',
                'api_key': api_key,
                'template_id': template_id,
                'email': test_email
            }
            
            data = urllib.parse.urlencode(params).encode('utf-8')
            req = urllib.request.Request('https://api.unisender.com/ru/api/sendTestEmail', data=data)
            
            with urllib.request.urlopen(req) as response:
                result = json.loads(response.read().decode('utf-8'))
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({
                        'success': 'result' in result,
                        'message': 'Test email sent' if 'result' in result else result.get('error', 'Unknown error')
                    })
                }
        
        else:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'Invalid action. Use: create_template or send_test'})
            }
    
    return {
        'statusCode': 405,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'body': json.dumps({'error': 'Method not allowed'})
    }