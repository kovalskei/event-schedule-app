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
        
        # Правило 6: Находим email и телефоны в футере
        contacts = find_contacts(soup)
        for contact in contacts:
            if '@' in contact:
                template_html = template_html.replace(contact, '{{email}}', 1)
                variables.append({
                    'name': 'email',
                    'description': 'Email для контактов',
                    'source': 'user_input',
                    'default_value': contact
                })
            elif any(c.isdigit() for c in contact):
                template_html = template_html.replace(contact, '{{phone}}', 1)
                variables.append({
                    'name': 'phone',
                    'description': 'Телефон для контактов',
                    'source': 'user_input',
                    'default_value': contact
                })
        
        # Правило 7: Находим название компании/мероприятия
        event_name = find_event_name(soup)
        if event_name:
            template_html = template_html.replace(event_name, '{{event_name}}', 1)
            variables.append({
                'name': 'event_name',
                'description': 'Название мероприятия',
                'source': 'knowledge_base',
                'default_value': event_name
            })
        
        print(f'[INFO] Total variables found: {len(variables)}')
        print(f'[INFO] Speakers: {len(speaker_blocks)}, Intro: {intro_var is not None}, CTA: {len(cta_buttons)}, Dates: {len(dates)}')
        
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
    
    # Правило 1: <td> с вложенной таблицей (классический паттерн)
    for td in soup.find_all('td'):
        inner_table = td.find('table', recursive=False)
        if not inner_table:
            continue
        
        img = inner_table.find('img')
        if not img:
            continue
        
        text_parts = []
        for text_td in inner_table.find_all('td'):
            text = text_td.get_text(strip=True)
            if text and len(text) > 10:  # Игнорируем короткие тексты
                text_parts.append(text)
        
        if len(text_parts) >= 2:
            title = text_parts[0]
            pitch = text_parts[1] if len(text_parts) > 1 else ''
            description = text_parts[2] if len(text_parts) > 2 else ''
            
            speakers.append({
                'full_html': str(td),
                'template': str(td).replace(title, '{{title}}').replace(pitch, '{{pitch}}').replace(description, '{{description}}'),
                'data': {
                    'name': '',
                    'title': title,
                    'pitch': pitch,
                    'description': description,
                    'photo_url': img.get('src', '')
                }
            })
    
    # Правило 2: Повторяющиеся <tr> с bgcolor (спикеры в одной таблице)
    if len(speakers) < 2:
        for table in soup.find_all('table'):
            rows_with_img = []
            for tr in table.find_all('tr'):
                img = tr.find('img')
                if img and 'speaker' in img.get('src', '').lower() or img and 'avatar' in img.get('alt', '').lower():
                    rows_with_img.append(tr)
            
            # Если нашли несколько строк с изображениями - это спикеры
            if len(rows_with_img) >= 2:
                speakers = []
                for tr in rows_with_img:
                    img = tr.find('img')
                    texts = []
                    for td in tr.find_all('td'):
                        text = td.get_text(strip=True)
                        if text and len(text) > 15:
                            texts.append(text)
                    
                    if len(texts) >= 2:
                        speakers.append({
                            'full_html': str(tr),
                            'template': str(tr),
                            'data': {
                                'title': texts[0],
                                'pitch': texts[1],
                                'description': texts[2] if len(texts) > 2 else '',
                                'photo_url': img.get('src', '')
                            }
                        })
                break
    
    # Правило 3: Ищем по тексту "спикер", "ex-", "Директор", "Руководитель"
    if len(speakers) < 2:
        speaker_markers = ['ex-', 'Директор', 'Руководитель', 'Лидер отдела', 'Head of', 'CEO', 'CTO']
        potential_speakers = []
        
        for td in soup.find_all('td'):
            text = td.get_text(strip=True)
            # Проверяем наличие маркеров должностей
            if any(marker in text for marker in speaker_markers):
                # Ищем изображение рядом (в том же tr)
                tr = td.find_parent('tr')
                if tr:
                    img = tr.find('img')
                    if img:
                        potential_speakers.append({
                            'full_html': str(tr),
                            'template': str(tr),
                            'data': {
                                'title': text.split('\n')[0][:100],
                                'pitch': text.split('\n')[1][:200] if '\n' in text else '',
                                'description': '',
                                'photo_url': img.get('src', '')
                            }
                        })
        
        if len(potential_speakers) >= 2:
            speakers = potential_speakers
    
    print(f'[DEBUG] Found {len(speakers)} speaker blocks')
    return speakers if len(speakers) >= 2 else []


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


def find_contacts(soup: BeautifulSoup) -> List[str]:
    """Находит email и телефоны"""
    contacts = []
    
    # Ищем в <a href="mailto:"> и <a href="tel:">
    for a in soup.find_all('a'):
        href = a.get('href', '')
        if 'mailto:' in href:
            email = href.replace('mailto:', '')
            contacts.append(email)
        elif 'tel:' in href:
            phone = a.get_text(strip=True)
            contacts.append(phone)
    
    # Ищем паттерны email и телефонов в тексте
    text = soup.get_text()
    emails = re.findall(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', text)
    phones = re.findall(r'\+?\d[\d\s\(\)\-]{7,}', text)
    
    contacts.extend(emails)
    contacts.extend([p.strip() for p in phones])
    
    return list(set(contacts))[:3]  # Максимум 3 контакта


def find_event_name(soup: BeautifulSoup) -> str | None:
    """Находит название мероприятия (обычно в логотипе или первом заголовке)"""
    # Ищем в alt атрибуте логотипа
    for img in soup.find_all('img'):
        alt = img.get('alt', '')
        if alt and len(alt) > 3 and len(alt) < 50:
            # Проверяем что это не "logo", "image" и т.д.
            if alt.lower() not in ['logo', 'image', 'banner', 'header']:
                return alt
    
    # Ищем первый крупный текст (логотип может быть текстом)
    for tag in ['h1', 'h2', 'strong', 'b']:
        element = soup.find(tag)
        if element:
            text = element.get_text(strip=True)
            if len(text) > 3 and len(text) < 50:
                return text
    
    return None


def replace_content(template: str, content: str, var_name: str, offset: int) -> Tuple[str, int]:
    """Заменяет контент на плейсхолдер с учётом offset"""
    placeholder = '{{' + var_name + '}}'
    index = template.find(content, offset)
    if index != -1:
        new_template = template[:index] + placeholder + template[index + len(content):]
        new_offset = index + len(placeholder)
        return new_template, new_offset
    return template, offset