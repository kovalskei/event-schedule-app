"""
Business: Анализирует HTML письма и разбивает на семантические блоки с привязкой к базе знаний
Args: event - dict с html_content
Returns: HTTP response с блоками и их метаданными
"""

import json
import re
from html.parser import HTMLParser
from typing import Dict, Any, List, Tuple
from dataclasses import dataclass, asdict

@dataclass
class SemanticBlock:
    block_type: str  # intro, speakers_section, schedule_section, pain_point, cta, footer
    block_name: str  # intro_hook, main_speakers_list, etc
    html_content: str
    block_order: int
    knowledge_source: str  # program, pain, style, content_plan
    generation_instructions: str
    example_content: str
    data_schema: Dict[str, Any]

class BlockAnalyzer(HTMLParser):
    def __init__(self):
        super().__init__()
        self.blocks: List[Dict[str, Any]] = []
        self.current_content = []
        self.text_buffer = []
        self.in_table = False
        self.depth = 0
        
    def handle_starttag(self, tag, attrs):
        self.depth += 1
        attrs_str = ' '.join([f'{k}="{v}"' for k, v in attrs])
        self.current_content.append(f'<{tag} {attrs_str}>' if attrs_str else f'<{tag}>')
        
        if tag == 'table':
            self.in_table = True
    
    def handle_endtag(self, tag):
        self.current_content.append(f'</{tag}>')
        self.depth -= 1
        
        if tag == 'table':
            self.in_table = False
            content = ''.join(self.current_content)
            text = ''.join(self.text_buffer)
            self.analyze_and_save_block(content, text)
            self.current_content = []
            self.text_buffer = []
        
        elif self.depth == 0 and not self.in_table:
            content = ''.join(self.current_content)
            text = ''.join(self.text_buffer)
            if content.strip() and text.strip():
                self.analyze_and_save_block(content, text)
            self.current_content = []
            self.text_buffer = []
    
    def handle_data(self, data):
        self.current_content.append(data)
        stripped = data.strip()
        if stripped:
            self.text_buffer.append(stripped)
    
    def analyze_and_save_block(self, html: str, text: str):
        if not text or len(text) < 10:
            return
        
        block_type, knowledge_source, instructions, schema = self.classify_block(text, html)
        
        block_name = f"{block_type}_{len([b for b in self.blocks if b['block_type'] == block_type]) + 1}"
        
        self.blocks.append({
            'block_type': block_type,
            'block_name': block_name,
            'html_content': html.strip(),
            'block_order': len(self.blocks),
            'knowledge_source': knowledge_source,
            'generation_instructions': instructions,
            'example_content': text[:500],
            'data_schema': schema
        })
    
    def classify_block(self, text: str, html: str) -> Tuple[str, str, str, Dict]:
        text_lower = text.lower()
        
        # 1. INTRO / HOOK (боли + тема)
        if any(w in text_lower for w in ['привет', 'здравств', 'приглаш', 'анонс', 'рады сообщить']):
            if any(w in text_lower for w in ['проблем', 'боль', 'сложно', 'трудно', 'не получается', 'как']):
                return (
                    'intro_with_pain',
                    'pain,content_plan',
                    'Создай привлекающий заход письма. Используй боли ЦА из базы знаний (pain), упомяни тему из контент-плана. Стиль и структура должны быть как в примере.',
                    {'hook_text': 'str', 'event_theme': 'str', 'pain_points': 'list[str]'}
                )
            else:
                return (
                    'intro_general',
                    'content_plan,style',
                    'Создай вступление письма по теме из контент-плана. Копируй стиль и тон из примера.',
                    {'intro_text': 'str', 'event_theme': 'str'}
                )
        
        # 2. SPEAKERS SECTION
        if any(w in text_lower for w in ['спикер', 'эксперт', 'ведущ', 'докладчик', 'выступ']):
            if html.count('<div') > 2 or html.count('<tr') > 1:
                return (
                    'speakers_list',
                    'program',
                    'Найди всех спикеров в программе события (program). Для каждого спикера извлеки: ФИО, компанию, должность, тему выступления. Сформируй список по структуре примера.',
                    {'speakers': [{'name': 'str', 'company': 'str', 'position': 'str', 'topic': 'str', 'photo_url': 'str?'}]}
                )
            else:
                return (
                    'speaker_highlight',
                    'program',
                    'Найди главного спикера или эксперта события в программе. Извлеки ФИО, компанию, тему.',
                    {'speaker': {'name': 'str', 'company': 'str', 'topic': 'str'}}
                )
        
        # 3. SCHEDULE / PROGRAM
        if any(w in text_lower for w in ['программа', 'расписани', 'время', 'часов', 'день', 'дата']):
            if html.count('<tr') > 1 or html.count('<li') > 1:
                return (
                    'schedule_table',
                    'program',
                    'Извлеки программу мероприятия из базы знаний (program). Для каждого пункта: время, название темы, спикер. Сформируй таблицу/список как в примере.',
                    {'schedule': [{'time': 'str', 'title': 'str', 'speaker': 'str?', 'description': 'str?'}]}
                )
            else:
                return (
                    'schedule_brief',
                    'program,content_plan',
                    'Кратко опиши когда проходит событие (дата, время). Используй данные из контент-плана.',
                    {'event_date': 'str', 'event_time': 'str', 'format': 'str'}
                )
        
        # 4. PAIN POINTS (развёрнутые боли)
        if any(w in text_lower for w in ['проблем', 'трудност', 'вызов', 'сложност', 'не получается', 'столкнул']):
            return (
                'pain_elaboration',
                'pain',
                'Возьми релевантные боли целевой аудитории из базы знаний (pain). Сформулируй их в тексте по стилю примера.',
                {'pain_list': ['str'], 'pain_description': 'str'}
            )
        
        # 5. BENEFITS / VALUE PROP
        if any(w in text_lower for w in ['узнаете', 'научитесь', 'получите', 'разбер', 'обсуд', 'выгод', 'польз']):
            return (
                'benefits_section',
                'program,content_plan',
                'Опиши что получат участники. Используй темы из программы (program) и цели события из контент-плана.',
                {'benefits': ['str'], 'outcomes': ['str']}
            )
        
        # 6. CTA (призыв к действию)
        if any(w in text_lower for w in ['регистр', 'записа', 'зарегистр', 'участв', 'присоедин', 'жми', 'нажми']):
            return (
                'cta_button',
                'style',
                'Создай призыв к действию. Копируй стиль кнопки/ссылки из примера. Текст должен мотивировать на регистрацию.',
                {'cta_text': 'str', 'button_url': 'str', 'urgency': 'str?'}
            )
        
        # 7. FOOTER / CONTACT
        if any(w in text_lower for w in ['вопрос', 'контакт', 'связ', 'email', 'телефон', 'подписк', 'отписа']):
            return (
                'footer_contacts',
                'style',
                'Блок с контактами или отпиской. Копируй структуру из примера.',
                {'contact_email': 'str?', 'contact_phone': 'str?', 'unsubscribe_text': 'str?'}
            )
        
        # 8. STATS / NUMBERS (цифры, статистика)
        if re.search(r'\d{2,}', text) and any(w in text_lower for w in ['участник', 'человек', 'компани', 'стран', '%']):
            return (
                'stats_block',
                'content_plan,program',
                'Блок с цифрами/статистикой события. Если есть данные в контент-плане - используй их.',
                {'stats': [{'number': 'str', 'label': 'str'}]}
            )
        
        # DEFAULT: общий контентный блок
        return (
            'content_block',
            'content_plan,style',
            'Общий текстовый блок. Генерируй контент на основе темы из контент-плана, копируй стиль из примера.',
            {'text': 'str'}
        )

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    method = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-User-Id',
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
    
    body = json.loads(event.get('body', '{}'))
    html_content = body.get('html_content', '')
    
    if not html_content:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'html_content обязателен'})
        }
    
    parser = BlockAnalyzer()
    parser.feed(html_content)
    
    blocks = parser.blocks
    
    template_structure = {
        'original_html': html_content,
        'blocks': blocks,
        'blocks_count': len(blocks),
        'block_types_summary': {}
    }
    
    for block in blocks:
        block_type = block['block_type']
        template_structure['block_types_summary'][block_type] = \
            template_structure['block_types_summary'].get(block_type, 0) + 1
    
    return {
        'statusCode': 200,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'isBase64Encoded': False,
        'body': json.dumps(template_structure, ensure_ascii=False)
    }
