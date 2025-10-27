'''
Uploads images to cloud storage and returns public URLs
Args: event with httpMethod, body (base64 image or URL)
Returns: HTTP response with image URL
'''

import json
import os
import base64
import urllib.request
import urllib.parse
from typing import Dict, Any
import uuid

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
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
    
    if method != 'POST':
        return {
            'statusCode': 405,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Method not allowed'})
        }
    
    try:
        body_data = json.loads(event.get('body', '{}'))
        image_data = body_data.get('image', '')
        filename = body_data.get('filename', f'{uuid.uuid4().hex}.png')
        
        if not image_data:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'Image data required'})
            }
        
        # Если это data URL (base64)
        if image_data.startswith('data:'):
            header, encoded = image_data.split(',', 1)
            image_base64 = encoded
        elif not image_data.startswith('http'):
            image_base64 = image_data
        else:
            with urllib.request.urlopen(image_data) as response:
                image_bytes = response.read()
                image_base64 = base64.b64encode(image_bytes).decode('utf-8')
        
        # Загружаем на imgbb
        imgbb_api_key = os.environ.get('IMGBB_API_KEY')
        
        if not imgbb_api_key:
            return {
                'statusCode': 500,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'IMGBB_API_KEY not configured'})
            }
        
        # Отправляем на imgbb
        upload_data = urllib.parse.urlencode({
            'key': imgbb_api_key,
            'image': image_base64,
            'name': filename
        }).encode('utf-8')
        
        imgbb_request = urllib.request.Request(
            'https://api.imgbb.com/1/upload',
            data=upload_data,
            headers={'Content-Type': 'application/x-www-form-urlencoded'}
        )
        
        with urllib.request.urlopen(imgbb_request) as response:
            result = json.loads(response.read().decode('utf-8'))
        
        if not result.get('success'):
            raise Exception('ImgBB upload failed')
        
        image_url = result['data']['url']
        
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({
                'url': image_url,
                'filename': filename,
                'size': result['data']['size'],
                'message': 'Image uploaded to ImgBB successfully'
            })
        }
        
    except Exception as e:
        print(f'[ERROR] Upload failed: {str(e)}')
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': f'Upload failed: {str(e)}'})
        }