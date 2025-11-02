"""
Business: Заполняет семантические блоки шаблона через ИИ с привязкой к базе знаний
Args: event (httpMethod, body с template_id, event_id, theme)
Returns: Готовое HTML письмо с заполненными блоками
"""

import json
import os
import re
from typing import Dict, Any, List
import psycopg2
import requests


def format_knowledge_base(knowledge_rows: List[tuple]) -> Dict[str, str]:
    """Форматирует базу знаний по категориям"""
    knowledge = {
        'program': [],
        'pain': [],
        'style': [],
        'content_plan': []
    }
    
    for item_type, content, metadata in knowledge_rows:
        if item_type == 'program':
            knowledge['program'].append(content)
        elif item_type == 'pain':
            knowledge['pain'].append(content)
        elif item_type == 'style':
            knowledge['style'].append(content)
        elif item_type == 'content_plan':
            knowledge['content_plan'].append(content)
    
    return {
        'program': '\n\n'.join(knowledge['program']),
        'pain': '\n\n'.join(knowledge['pain']),
        'style': '\n\n'.join(knowledge['style']),
        'content_plan': '\n\n'.join(knowledge['content_plan'])
    }


def build_block_prompt(block: Dict[str, Any], knowledge: Dict[str, str], theme: str) -> str:
    """Создаёт промпт для генерации контента блока"""
    
    sources = block['knowledge_source'].split(',')
    relevant_knowledge = []
    
    for source in sources:
        source = source.strip()
        if source in knowledge and knowledge[source]:
            relevant_knowledge.append(f"### {source.upper()}:\n{knowledge[source]}")
    
    knowledge_context = '\n\n'.join(relevant_knowledge) if relevant_knowledge else 'Нет данных в базе знаний'
    
    prompt = f"""Ты — копирайтер email-рассылок для мероприятий.

ТВОЯ ЗАДАЧА: Сгенерировать контент для блока письма на основе базы знаний.

БЛОК: {block['block_type']} ({block['block_name']})
ИНСТРУКЦИИ: {block['generation_instructions']}

ТЕМА ПИСЬМА: {theme}

БАЗА ЗНАНИЙ:
{knowledge_context}

ПРИМЕР КОНТЕНТА ИЗ ОРИГИНАЛА:
{block['example_content']}

СТРУКТУРА ДАННЫХ:
{json.dumps(block['data_schema'], ensure_ascii=False, indent=2)}

ТРЕБОВАНИЯ:
1. ⚠️ КРИТИЧНО: Выбирай ТОЛЬКО данные РЕЛЕВАНТНЫЕ теме письма "{theme}"
2. Для спикеров — бери ТОЛЬКО тех, чьи темы выступлений соответствуют теме письма
3. Для расписания — включай ТОЛЬКО пункты программы связанные с темой письма
4. Для болей — выбирай 2-3 САМЫЕ ПОДХОДЯЩИЕ боли под тему, НЕ ВСЕ
5. Копируй стиль и структуру из примера контента
6. Верни ТОЛЬКО валидный JSON объект по схеме data_schema
7. Не выдумывай данные — используй только то что есть в базе знаний

ПРИМЕР ОТВЕТА:
{json.dumps(block['data_schema'], ensure_ascii=False, indent=2)}
"""
    
    return prompt


def call_openai(prompt: str, openai_key: str) -> Dict[str, Any]:
    """Вызывает OpenAI API для генерации контента"""
    
    response = requests.post(
        'https://api.openai.com/v1/chat/completions',
        headers={
            'Authorization': f'Bearer {openai_key}',
            'Content-Type': 'application/json'
        },
        json={
            'model': 'gpt-4o-mini',
            'messages': [
                {'role': 'system', 'content': 'Ты — эксперт копирайтер email-рассылок. Отвечаешь только валидным JSON.'},
                {'role': 'user', 'content': prompt}
            ],
            'temperature': 0.7,
            'max_tokens': 2000
        },
        timeout=30
    )
    
    if response.status_code != 200:
        raise Exception(f'OpenAI API error: {response.status_code} - {response.text}')
    
    data = response.json()
    content = data['choices'][0]['message']['content'].strip()
    
    # Извлекаем JSON из ответа
    json_match = re.search(r'\{.*\}', content, re.DOTALL)
    if json_match:
        return json.loads(json_match.group(0))
    
    return json.loads(content)


def render_block(block: Dict[str, Any], data: Dict[str, Any]) -> str:
    """Рендерит HTML блока с данными"""
    
    html = block['html_content']
    
    # Простая замена для одиночных значений
    for key, value in data.items():
        if isinstance(value, str):
            html = html.replace(f'{{{{{key}}}}}', value)
    
    # Обработка списков (speakers, schedule)
    if 'speakers' in data and isinstance(data['speakers'], list):
        # Ищем шаблон блока спикера
        speaker_pattern = r'(<div[^>]*>.*?</div>)'
        matches = re.findall(speaker_pattern, html, re.DOTALL)
        
        if matches and len(matches) > 0:
            speaker_template = matches[0]
            rendered_speakers = []
            
            for speaker in data['speakers']:
                rendered = speaker_template
                for key, value in speaker.items():
                    rendered = rendered.replace(f'{{{{{key}}}}}', str(value))
                rendered_speakers.append(rendered)
            
            # Заменяем все блоки спикеров на отрендеренные
            html = re.sub(speaker_pattern, '', html, count=len(matches))
            html += '\n'.join(rendered_speakers)
    
    if 'schedule' in data and isinstance(data['schedule'], list):
        # Ищем шаблон строки таблицы
        tr_pattern = r'(<tr[^>]*>.*?</tr>)'
        matches = re.findall(tr_pattern, html, re.DOTALL)
        
        if matches and len(matches) > 0:
            tr_template = matches[0]
            rendered_rows = []
            
            for item in data['schedule']:
                rendered = tr_template
                for key, value in item.items():
                    rendered = rendered.replace(f'{{{{{key}}}}}', str(value))
                rendered_rows.append(rendered)
            
            html = re.sub(tr_pattern, '', html, count=len(matches))
            html += '\n'.join(rendered_rows)
    
    return html


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Главный обработчик функции"""
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
            'body': '',
            'isBase64Encoded': False
        }
    
    if method != 'POST':
        return {
            'statusCode': 405,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'error': 'Only POST method allowed'}),
            'isBase64Encoded': False
        }
    
    try:
        body_str = event.get('body', '{}')
        body_data = json.loads(body_str) if body_str else {}
        
        template_id = body_data.get('template_id')
        event_id = body_data.get('event_id')
        theme = body_data.get('theme', '')
        
        if not template_id or not event_id:
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'error': 'template_id and event_id are required'}),
                'isBase64Encoded': False
            }
        
        db_url = os.environ.get('DATABASE_URL', '')
        openai_key = os.environ.get('OPENAI_API_KEY', '')
        
        if not db_url or not openai_key:
            return {
                'statusCode': 500,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'error': 'DATABASE_URL or OPENAI_API_KEY not configured'}),
                'isBase64Encoded': False
            }
        
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()
        
        # 1. Загружаем блоки шаблона
        cur.execute("""
            SELECT block_type, block_name, html_content, block_order, 
                   knowledge_source, generation_instructions, example_content, data_schema
            FROM t_p22819116_event_schedule_app.template_blocks
            WHERE template_id = %s
            ORDER BY block_order
        """, (template_id,))
        
        blocks = []
        for row in cur.fetchall():
            blocks.append({
                'block_type': row[0],
                'block_name': row[1],
                'html_content': row[2],
                'block_order': row[3],
                'knowledge_source': row[4],
                'generation_instructions': row[5],
                'example_content': row[6],
                'data_schema': row[7] or {}
            })
        
        if not blocks:
            cur.close()
            conn.close()
            return {
                'statusCode': 404,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'error': f'No blocks found for template {template_id}'}),
                'isBase64Encoded': False
            }
        
        # 2. Загружаем базу знаний
        cur.execute("""
            SELECT item_type, content, metadata
            FROM t_p22819116_event_schedule_app.knowledge_store
            WHERE event_id = %s
        """, (event_id,))
        
        knowledge_rows = cur.fetchall()
        cur.close()
        conn.close()
        
        knowledge = format_knowledge_base(knowledge_rows)
        
        # 3. Генерируем контент для каждого блока
        rendered_blocks = []
        blocks_data = {}
        
        for block in blocks:
            try:
                # Создаём промпт для блока
                prompt = build_block_prompt(block, knowledge, theme)
                
                # Получаем данные от ИИ
                block_data = call_openai(prompt, openai_key)
                blocks_data[block['block_name']] = block_data
                
                # Рендерим HTML блока с данными
                rendered_html = render_block(block, block_data)
                rendered_blocks.append(rendered_html)
                
            except Exception as e:
                # Если ошибка - оставляем оригинальный HTML
                print(f"Error rendering block {block['block_name']}: {str(e)}")
                rendered_blocks.append(block['html_content'])
                blocks_data[block['block_name']] = {'error': str(e)}
        
        # 4. Собираем финальное письмо
        final_html = '\n\n'.join(rendered_blocks)
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'success': True,
                'filled_html': final_html,
                'blocks_data': blocks_data,
                'blocks_count': len(blocks),
                'theme': theme
            }, ensure_ascii=False),
            'isBase64Encoded': False
        }
        
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'error': f'Internal error: {str(e)}'}),
            'isBase64Encoded': False
        }