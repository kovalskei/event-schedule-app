import json
import os
from typing import Dict, Any
import urllib.request
import urllib.parse

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Business: Отправляет уведомления в Telegram менеджеру о готовых черновиках
    Args: event - dict с httpMethod, body (message, template_id, unisender_link)
    Returns: HTTP response со статусом отправки
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
        
        message = body_data.get('message', '')
        template_id = body_data.get('template_id', '')
        unisender_link = body_data.get('unisender_link', 'https://cp.unisender.com')
        
        bot_token = os.environ.get('TELEGRAM_BOT_TOKEN', '')
        chat_id = os.environ.get('TELEGRAM_CHAT_ID', '')
        
        if not bot_token or not chat_id:
            return {
                'statusCode': 500,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not configured'})
            }
        
        if not message:
            message = f'✅ Черновик письма готов!\n\nID шаблона: {template_id}\n\n📋 Следующий шаг:\n1. Откройте UniSender: {unisender_link}\n2. Выберите список/сегмент получателей\n3. Нажмите "Отправить" или "Запланировать"\n\nУспешной рассылки! 🚀'
        
        telegram_data = {
            'chat_id': chat_id,
            'text': message,
            'parse_mode': 'HTML'
        }
        
        url = f'https://api.telegram.org/bot{bot_token}/sendMessage'
        data = json.dumps(telegram_data).encode('utf-8')
        
        req = urllib.request.Request(
            url,
            data=data,
            headers={'Content-Type': 'application/json'}
        )
        
        with urllib.request.urlopen(req) as response:
            result = json.loads(response.read().decode('utf-8'))
            
            if result.get('ok'):
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({
                        'success': True,
                        'message_id': result['result']['message_id']
                    })
                }
            else:
                return {
                    'statusCode': 500,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': result.get('description', 'Unknown error')})
                }
    
    return {
        'statusCode': 405,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'body': json.dumps({'error': 'Method not allowed'})
    }