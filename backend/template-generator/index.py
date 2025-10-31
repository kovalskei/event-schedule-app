import json
import os
import re
from typing import Dict, Any
import psycopg2

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Business: Преобразует HTML в Mustache шаблон по жёстким правилам (БЕЗ ИИ)
    Args: event - dict с httpMethod, body {html_content: str, event_id: int, content_type_id: int, name: str}
    Returns: HTTP response с созданными template_id (оригинал + шаблон)
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
        
        html_content = body_data.get('html_content')
        event_id = body_data.get('event_id')
        content_type_id = body_data.get('content_type_id')
        template_name = body_data.get('name', 'Шаблон')
        
        print(f"[INFO] Processing HTML: {len(html_content) if html_content else 0} chars")
        
        if not html_content:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'html_content required'})
            }
        
        if not event_id or not content_type_id:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'event_id and content_type_id required'})
            }
        
        db_url = os.environ.get('DATABASE_URL', '')
        if not db_url:
            return {
                'statusCode': 500,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'DATABASE_URL not configured'})
            }
        
        try:
            html_with_slots = convert_to_template(html_content)
            
            conn = psycopg2.connect(db_url)
            cur = conn.cursor()
            
            cur.execute(
                "INSERT INTO t_p22819116_event_schedule_app.email_templates " +
                "(event_id, content_type_id, name, html_template, is_example) VALUES " +
                "(%s, %s, %s, %s, %s) RETURNING id",
                (event_id, content_type_id, f"{template_name} (Оригинал)", html_content, True)
            )
            example_id = cur.fetchone()[0]
            
            slots_schema = {
                "intro_heading": "string",
                "intro_text": "string",
                "subheading": "string",
                "cta_text": "string",
                "cta_url": "string",
                "speakers": "array"
            }
            
            cur.execute(
                "INSERT INTO t_p22819116_event_schedule_app.email_templates " +
                "(event_id, content_type_id, name, html_template, html_layout, slots_schema, is_example) VALUES " +
                "(%s, %s, %s, %s, %s, %s, %s) RETURNING id",
                (event_id, content_type_id, template_name, html_with_slots, html_with_slots, json.dumps(slots_schema), False)
            )
            template_id = cur.fetchone()[0]
            
            conn.commit()
            cur.close()
            conn.close()
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({
                    'success': True,
                    'example_id': example_id,
                    'template_id': template_id,
                    'notes': 'Создан эталон (is_example=true) и рабочий шаблон со слотами'
                })
            }
            
        except Exception as e:
            print(f'[ERROR] {str(e)}')
            return {
                'statusCode': 500,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': f'Failed to generate template: {str(e)}'})
            }
    
    return {
        'statusCode': 405,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'body': json.dumps({'error': 'Method not allowed'})
    }

def convert_to_template(html: str) -> str:
    """
    Преобразует HTML в Mustache шаблон - ищет ЛЮБЫЕ текстовые блоки
    
    Правила:
    1. Все <h1>, <h2>, <h3> → {{intro_heading}}, {{subheading}}
    2. Все <p> с текстом >20 символов → {{intro_text}}, {{description}}
    3. Все <a> с href → {{cta_url}}, текст → {{cta_text}}
    4. Все <td> с текстом → {{speaker_name}}, {{speaker_title}}
    5. Все <img> → src={{photo_url}}, alt={{name}}
    """
    result = html
    replacements = []
    
    # 1. Заменяем ВСЕ заголовки на слоты
    h1_count = 0
    def replace_h1(match):
        nonlocal h1_count
        h1_count += 1
        tag = match.group(1)
        content = match.group(2)
        if h1_count == 1:
            return f'<{tag}>{{{{intro_heading}}}}</{tag}>'
        else:
            return f'<{tag}>{{{{subheading_{h1_count}}}}}</{tag}>'
    
    result = re.sub(r'<(h[1-3][^>]*)>(.*?)</\1>', replace_h1, result, flags=re.DOTALL | re.IGNORECASE)
    replacements.append(f"Заголовки: {h1_count} → слоты")
    
    # 2. Заменяем ВСЕ параграфы с длинным текстом
    p_count = 0
    def replace_p(match):
        nonlocal p_count
        content = match.group(2).strip()
        if len(content) > 20 and not '{{' in content:
            p_count += 1
            attrs = match.group(1)
            if p_count == 1:
                return f'<p{attrs}>{{{{intro_text}}}}</p>'
            else:
                return f'<p{attrs}>{{{{description_{p_count}}}}}</p>'
        return match.group(0)
    
    result = re.sub(r'<p([^>]*)>(.*?)</p>', replace_p, result, flags=re.DOTALL | re.IGNORECASE)
    replacements.append(f"Параграфы: {p_count} → слоты")
    
    # 3. Заменяем ВСЕ ссылки
    a_count = 0
    def replace_a(match):
        nonlocal a_count
        a_count += 1
        before_href = match.group(1) if match.group(1) else ''
        after_href = match.group(2) if match.group(2) else ''
        if a_count == 1:
            return f'<a {before_href}href="{{{{cta_url}}}}"{after_href}>{{{{cta_text}}}}</a>'
        else:
            return f'<a {before_href}href="{{{{link_url_{a_count}}}}}"{after_href}>{{{{link_text_{a_count}}}}}</a>'
    
    result = re.sub(r'<a\s+([^>]*?)href=["\'][^"\']*["\']([^>]*)>(.*?)</a>', replace_a, result, flags=re.DOTALL | re.IGNORECASE)
    replacements.append(f"Ссылки: {a_count} → слоты")
    
    # 4. Заменяем изображения
    img_count = 0
    def replace_img(match):
        nonlocal img_count
        img_count += 1
        attrs_before = match.group(1) if match.group(1) else ''
        attrs_after = match.group(2) if match.group(2) else ''
        return f'<img {attrs_before}src="{{{{photo_url}}}}" alt="{{{{name}}}}"{attrs_after}'
    
    result = re.sub(r'<img\s+([^>]*?)src=["\'][^"\']*["\']([^>]*)', replace_img, result, flags=re.IGNORECASE)
    replacements.append(f"Изображения: {img_count} → слоты")
    
    # 5. Оборачиваем повторяющиеся блоки в {{#speakers}}
    if '<!-- Спикер' in html or 'speaker' in html.lower():
        speaker_matches = list(re.finditer(r'(<!--\s*Спикер.*?-->.*?</tr>)', result, re.DOTALL | re.IGNORECASE))
        if len(speaker_matches) >= 2:
            first_start = speaker_matches[0].start()
            last_end = speaker_matches[-1].end()
            speaker_block = result[first_start:last_end]
            result = result[:first_start] + '{{#speakers}}' + speaker_block + '{{/speakers}}' + result[last_end:]
            replacements.append(f"Спикеры: обёрнуто {len(speaker_matches)} блоков")
    
    diff = len(html) - len(result)
    print(f"[INFO] Замены: {', '.join(replacements)}. Разница: {diff} символов")
    
    return result