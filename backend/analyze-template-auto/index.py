import json
import os
import re
from typing import Dict, Any, List, Tuple
from bs4 import BeautifulSoup

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Business: Автоматический анализ HTML и создание шаблона с переменными
    Args: event с body: {html_content, event_id}
    Returns: {template_html, variables, suggestions}
    '''
    method: str = event.get('httpMethod', 'POST')
    
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
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Method not allowed'})
        }
    
    body_data = json.loads(event.get('body', '{}'))
    html_content: str = body_data.get('html_content', '')
    
    if not html_content:
        return {
            'statusCode': 400,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'html_content required'})
        }
    
    try:
        # Парсим HTML
        soup = BeautifulSoup(html_content, 'html.parser')
        
        # Ищем переменные
        variables = []
        template_html = html_content
        offset = 0
        
        # Правило 1: Находим вступительный текст (первый большой <p> или <td> с текстом)
        intro_var = find_intro_text(soup)
        if intro_var:
            template_html, offset = replace_content(
                template_html, intro_var['content'], 'pain', offset
            )
            variables.append({
                'name': 'pain',
                'description': 'Используй тему письма, посмотри на боли и программу мероприятия и предложи актуальный заход и подводку',
                'source': 'knowledge_base',
                'default_value': intro_var['content'][:100]
            })
        
        # Правило 2: Находим повторяющиеся блоки спикеров
        speaker_blocks = find_speaker_blocks(soup)
        if speaker_blocks:
            # Заменяем на {{#speakers}}...{{/speakers}}
            for i, block in enumerate(speaker_blocks):
                placeholder = '{{#speakers}}' + block['template'] + '{{/speakers}}' if i == 0 else ''
                if i == 0:
                    template_html = template_html.replace(block['full_html'], placeholder, 1)
                else:
                    template_html = template_html.replace(block['full_html'], '', 1)
            
            variables.append({
                'name': 'speakers',
                'description': 'Найди релевантных спикеров которые подходят по теме письма. Верни массив объектов [{name, title, pitch, photo_url}]',
                'source': 'knowledge_base',
                'type': 'array',
                'default_value': json.dumps(speaker_blocks[0]['data'])
            })
        
        # Правило 3: Находим заголовки и подзаголовки
        headlines = find_headlines(soup)
        for headline in headlines:
            var_name = f"headline_{headline['level']}"
            template_html, offset = replace_content(
                template_html, headline['text'], var_name, offset
            )
            variables.append({
                'name': var_name,
                'description': f'Заголовок уровня {headline["level"]}',
                'source': 'user_input',
                'default_value': headline['text']
            })
        
        # Правило 4: Находим ссылки и CTA кнопки
        cta_buttons = find_cta_buttons(soup)
        for i, cta in enumerate(cta_buttons):
            var_name = f"cta_text_{i+1}" if i > 0 else "cta_text"
            template_html = template_html.replace(cta['text'], '{{' + var_name + '}}', 1)
            variables.append({
                'name': var_name,
                'description': 'Текст кнопки призыва к действию',
                'source': 'user_input',
                'default_value': cta['text']
            })
        
        # Правило 5: Находим даты и время
        dates = find_dates(html_content)
        for i, date in enumerate(dates):
            var_name = f"event_date_{i+1}" if i > 0 else "event_date"
            template_html = template_html.replace(date, '{{' + var_name + '}}', 1)
            variables.append({
                'name': var_name,
                'description': 'Дата мероприятия',
                'source': 'knowledge_base',
                'default_value': date
            })
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'success': True,
                'template_html': template_html,
                'original_html': html_content,
                'variables': variables,
                'variables_count': len(variables),
                'suggestions': {
                    'has_speakers': len(speaker_blocks) > 0,
                    'has_intro': intro_var is not None,
                    'has_cta': len(cta_buttons) > 0
                }
            }, ensure_ascii=False)
        }
    
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'error': 'Analysis failed',
                'details': str(e)
            })
        }


def find_intro_text(soup: BeautifulSoup) -> Dict[str, Any] | None:
    """Находит вступительный текст (обычно первый большой абзац)"""
    # Ищем <td> или <p> с текстом >100 символов в начале письма
    for tag in soup.find_all(['td', 'p']):
        text = tag.get_text(strip=True)
        # Пропускаем заголовки, футеры, короткие тексты
        if len(text) > 100 and len(text) < 800:
            # Проверяем что это не спикер (нет "ex-", "Директор", "Руководитель" в начале)
            if not re.search(r'^(ex-|Директор|Руководитель|Лидер)', text):
                return {
                    'content': text,
                    'tag': tag.name
                }
    return None


def find_speaker_blocks(soup: BeautifulSoup) -> List[Dict[str, Any]]:
    """Находит повторяющиеся блоки спикеров"""
    speakers = []
    
    # Паттерн: <td> с вложенной таблицей, содержащей img + текст
    for td in soup.find_all('td'):
        inner_table = td.find('table')
        if not inner_table:
            continue
        
        # Ищем img внутри
        img = inner_table.find('img')
        if not img:
            continue
        
        # Ищем текстовые части
        text_parts = []
        for text_td in inner_table.find_all('td'):
            text = text_td.get_text(strip=True)
            if text and text_td != td.find('td', recursive=False):  # не сам контейнер
                text_parts.append(text)
        
        if len(text_parts) >= 2:  # Должно быть минимум 2 части (title + pitch)
            # Определяем структуру
            title = text_parts[0]  # ex-HRD, РИВ ГОШ
            pitch = text_parts[1] if len(text_parts) > 1 else ''  # Заголовок доклада
            description = text_parts[2] if len(text_parts) > 2 else ''  # Описание
            
            speakers.append({
                'full_html': str(td),
                'template': str(td).replace(title, '{{title}}').replace(pitch, '{{pitch}}').replace(description, '{{description}}'),
                'data': {
                    'name': '',  # Нет имени в примере
                    'title': title,
                    'pitch': pitch,
                    'description': description,
                    'photo_url': img.get('src', '')
                }
            })
    
    return speakers if len(speakers) >= 2 else []  # Минимум 2 спикера


def find_headlines(soup: BeautifulSoup) -> List[Dict[str, str]]:
    """Находит заголовки h1-h6"""
    headlines = []
    for level in range(1, 7):
        for tag in soup.find_all(f'h{level}'):
            text = tag.get_text(strip=True)
            if text:
                headlines.append({
                    'text': text,
                    'level': level,
                    'tag': tag.name
                })
    return headlines


def find_cta_buttons(soup: BeautifulSoup) -> List[Dict[str, str]]:
    """Находит CTA кнопки (обычно <a> с определённым стилем)"""
    ctas = []
    for a in soup.find_all('a'):
        style = a.get('style', '')
        # Ищем ссылки с background-color (обычно кнопки)
        if 'background-color' in style or 'background:' in style:
            text = a.get_text(strip=True)
            if text:
                ctas.append({
                    'text': text,
                    'href': a.get('href', '#')
                })
    return ctas


def find_dates(text: str) -> List[str]:
    """Находит даты в тексте"""
    # Паттерны: "15 ноября", "15.11.2024", "2024-11-15"
    date_patterns = [
        r'\d{1,2}\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)(?:\s+\d{4})?',
        r'\d{1,2}\.\d{1,2}\.\d{2,4}',
        r'\d{4}-\d{2}-\d{2}'
    ]
    
    dates = []
    for pattern in date_patterns:
        matches = re.findall(pattern, text, re.IGNORECASE)
        dates.extend(matches)
    
    return list(set(dates))  # Уникальные даты


def replace_content(template: str, content: str, var_name: str, offset: int) -> Tuple[str, int]:
    """Заменяет контент на плейсхолдер с учётом offset"""
    placeholder = '{{' + var_name + '}}'
    index = template.find(content, offset)
    if index != -1:
        new_template = template[:index] + placeholder + template[index + len(content):]
        new_offset = index + len(placeholder)
        return new_template, new_offset
    return template, offset
