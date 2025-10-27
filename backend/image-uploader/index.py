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
            # Извлекаем base64 часть
            header, encoded = image_data.split(',', 1)
            image_bytes = base64.b64decode(encoded)
        # Если это уже base64 строка
        elif not image_data.startswith('http'):
            image_bytes = base64.b64decode(image_data)
        else:
            # Если это URL - скачиваем изображение
            with urllib.request.urlopen(image_data) as response:
                image_bytes = response.read()
        
        # Используем внешний сервис для хостинга (например imgbb, imgur или свой S3)
        # Временно возвращаем data URL обратно (в продакшене заменить на реальное хранилище)
        
        # TODO: Интегрировать с реальным хранилищем (S3/imgbb)
        image_base64 = base64.b64encode(image_bytes).decode('utf-8')
        
        # Определяем MIME тип
        mime_type = 'image/png'
        if filename.endswith('.jpg') or filename.endswith('.jpeg'):
            mime_type = 'image/jpeg'
        elif filename.endswith('.gif'):
            mime_type = 'image/gif'
        elif filename.endswith('.svg'):
            mime_type = 'image/svg+xml'
        
        data_url = f'data:{mime_type};base64,{image_base64}'
        
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({
                'url': data_url,
                'filename': filename,
                'size': len(image_bytes),
                'message': 'Image uploaded successfully (stored as data URL)'
            })
        }
        
    except Exception as e:
        print(f'[ERROR] Upload failed: {str(e)}')
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': f'Upload failed: {str(e)}'})
        }
