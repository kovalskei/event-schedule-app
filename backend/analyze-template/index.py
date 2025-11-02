"""
Business: Анализирует HTML шаблон пользователя и автоматически создает переменные
Args: event (httpMethod, body с html_content)
Returns: Шаблон с {{переменными}} + JSON метаданные переменных
"""

import json
import re
from html.parser import HTMLParser
from typing import Dict, Any, List, Tuple


class TextExtractor(HTMLParser):
    """Извлекает текстовые блоки из HTML"""
    
    def __init__(self):
        super().__init__()
        self.text_blocks: List[Dict[str, Any]] = []
        self.current_tag = None
        self.tag_stack = []
    
    def handle_starttag(self, tag, attrs):
        self.tag_stack.append(tag)
        self.current_tag = tag
    
    def handle_endtag(self, tag):
        if self.tag_stack and self.tag_stack[-1] == tag:
            self.tag_stack.pop()
        self.current_tag = self.tag_stack[-1] if self.tag_stack else None
    
    def handle_data(self, data):
        stripped = data.strip()
        if stripped and len(stripped) > 2:
            self.text_blocks.append({
                'text': stripped,
                'tag': self.current_tag or 'unknown',
                'length': len(stripped)
            })


def suggest_variable_name(text: str, index: int) -> Tuple[str, str]:
    """
    Умное определение названия переменной на основе контента
    Returns: (variable_name, suggested_type)
    """
    text_lower = text.lower()
    
    # Словарь ключевых слов для распознавания типов переменных
    keywords = {
        # Спикеры и персоны
        'спикер': ('speaker_name', 'text'),
        'эксперт': ('expert_name', 'text'),
        'ведущий': ('host_name', 'text'),
        'докладчик': ('presenter_name', 'text'),
        
        # Даты и время
        'дата': ('event_date', 'date'),
        'время': ('event_time', 'date'),
        'когда': ('event_datetime', 'date'),
        'день': ('event_day', 'date'),
        
        # Названия и темы
        'название': ('event_name', 'text'),
        'тема': ('topic', 'text'),
        'заголовок': ('title', 'text'),
        'вебинар': ('webinar_title', 'text'),
        'конференция': ('conference_title', 'text'),
        'мероприятие': ('event_title', 'text'),
        
        # Описания
        'описание': ('description', 'text'),
        'о чем': ('about', 'text'),
        'содержание': ('content', 'text'),
        
        # CTA и ссылки
        'регистр': ('cta_register', 'text'),
        'записаться': ('cta_signup', 'text'),
        'узнать': ('cta_learn_more', 'text'),
        'подробнее': ('cta_details', 'text'),
        'ссылка': ('link_url', 'url'),
        
        # Контакты
        'email': ('contact_email', 'text'),
        'телефон': ('contact_phone', 'text'),
        'адрес': ('address', 'text'),
        
        # Цены и бонусы
        'цена': ('price', 'number'),
        'стоимость': ('cost', 'number'),
        'скидка': ('discount', 'number'),
        'бонус': ('bonus', 'text'),
        
        # Приветствия
        'привет': ('greeting', 'text'),
        'здравствуй': ('greeting', 'text'),
    }
    
    # Поиск ключевых слов в тексте
    for keyword, (var_name, var_type) in keywords.items():
        if keyword in text_lower:
            return (var_name, var_type)
    
    # Fallback на generic названия
    if len(text) > 150:
        return (f'content_block_{index + 1}', 'text')
    elif len(text) > 50:
        return (f'paragraph_{index + 1}', 'text')
    else:
        return (f'text_{index + 1}', 'text')


def convert_to_template(html: str) -> Tuple[str, List[Dict[str, Any]]]:
    """
    Преобразует HTML в шаблон с переменными
    Returns: (template_html, variables_metadata)
    """
    parser = TextExtractor()
    parser.feed(html)
    
    result_html = html
    variables = []
    used_names = set()
    
    for idx, block in enumerate(parser.text_blocks):
        text = block['text']
        
        # Пропускаем HTML-теги и очень короткие блоки
        if '<' in text or len(text) < 3:
            continue
        
        # Генерируем уникальное имя переменной
        base_name, var_type = suggest_variable_name(text, idx)
        var_name = base_name
        
        # Обеспечиваем уникальность имени
        counter = 1
        while var_name in used_names:
            var_name = f'{base_name}_{counter}'
            counter += 1
        
        used_names.add(var_name)
        
        # Создаем placeholder переменной
        variable_placeholder = '{{' + var_name + '}}'
        
        # Заменяем ТОЛЬКО первое вхождение текста (чтобы избежать замены одинаковых строк)
        result_html = result_html.replace(text, variable_placeholder, 1)
        
        variables.append({
            'name': var_name,
            'original_text': text,
            'suggested_type': var_type,
            'description': generate_description(text, var_name),
            'default_value': text if len(text) < 100 else '',
            'is_required': True
        })
    
    return result_html, variables


def generate_description(original_text: str, var_name: str) -> str:
    """Генерирует описание переменной для ИИ"""
    text_lower = original_text.lower()
    
    # Умные описания на основе контента
    if 'спикер' in text_lower or 'эксперт' in text_lower:
        return 'ФИО спикера или эксперта мероприятия'
    elif 'дата' in text_lower or 'время' in text_lower:
        return 'Дата и время проведения мероприятия'
    elif 'тема' in text_lower or 'название' in text_lower:
        return 'Название или тема мероприятия'
    elif 'регистр' in text_lower or 'записаться' in text_lower:
        return 'Текст кнопки призыва к действию (CTA)'
    elif 'описание' in text_lower:
        return 'Описание мероприятия или программы'
    elif len(original_text) > 100:
        return f'Текстовый блок контента (примерно {len(original_text)} символов)'
    else:
        return f'Короткий текстовый элемент'


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Главный обработчик функции
    """
    method: str = event.get('httpMethod', 'GET')
    
    # CORS preflight
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
        body_data = json.loads(event.get('body', '{}'))
        html_content = body_data.get('html_content', '')
        
        if not html_content:
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'error': 'html_content is required'}),
                'isBase64Encoded': False
            }
        
        # Преобразуем HTML в шаблон
        template_html, variables = convert_to_template(html_content)
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'template_html': template_html,
                'original_html': html_content,
                'variables': variables,
                'variables_count': len(variables)
            }, ensure_ascii=False),
            'isBase64Encoded': False
        }
    
    except json.JSONDecodeError:
        return {
            'statusCode': 400,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'error': 'Invalid JSON in request body'}),
            'isBase64Encoded': False
        }
    
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'error': 'Internal server error',
                'details': str(e)
            }),
            'isBase64Encoded': False
        }
