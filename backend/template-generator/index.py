import json
import os
import re
from typing import Dict, Any, Tuple, List
import psycopg2
import requests
from html.parser import HTMLParser
from difflib import SequenceMatcher

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Business: Преобразует HTML в Mustache шаблон через Claude 3.5 Sonnet
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
        test_mode = body_data.get('test_mode', False)
        use_ai = body_data.get('use_ai', False)  # Legacy AI (полная генерация)
        hybrid_ai = body_data.get('hybrid_ai', False)  # Гибрид: AI анализ + regex замена
        
        print(f"[INFO] Processing HTML: {len(html_content) if html_content else 0} chars")
        
        if not html_content:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'html_content required'})
            }
        
        if not test_mode and (not event_id or not content_type_id):
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
            if hybrid_ai:
                # Гибридный AI-режим: AI только анализирует, regex применяет
                openrouter_key = os.environ.get('OPENROUTER_API_KEY', '')
                if not openrouter_key:
                    return {
                        'statusCode': 500,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'OPENROUTER_API_KEY not configured for hybrid mode'})
                    }
                print("[INFO] Using hybrid AI mode: AI analyzes + regex applies")
                instructions = analyze_template_with_ai(html_content, openrouter_key)
                print(f"[INFO] AI found {len(instructions.get('loops', []))} loops, {len(instructions.get('variables', []))} variables")
                html_with_slots, result_data = apply_ai_instructions(html_content, instructions)
            elif use_ai:
                # Legacy AI-режим: полная генерация (медленно, дорого)
                openrouter_key = os.environ.get('OPENROUTER_API_KEY', '')
                if not openrouter_key:
                    return {
                        'statusCode': 500,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'OPENROUTER_API_KEY not configured'})
                    }
                print("[INFO] Using legacy AI mode (full generation)")
                html_with_slots = convert_to_template_ai(html_content, openrouter_key)
                result_data = {"variables": {}, "slots_schema": {}}
            else:
                # Pure regex-режим: мгновенно, сохраняет все стили
                print("[INFO] Using pure regex mode")
                html_with_slots, result_data = convert_to_template_regex(html_content)
                print(f"[INFO] Regex conversion: found {len(result_data.get('variables', {}))} variables")
                print(f"[INFO] Regex conversion: found {len(result_data.get('slots_schema', {}))} schema fields")
            
            if test_mode:
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({
                        'template': html_with_slots,
                        'variables': result_data.get('variables', {}),
                        'slots_schema': result_data.get('slots_schema', {}),
                        'method': 'ai' if use_ai else 'regex'
                    })
                }
            
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

def find_repeating_blocks(html: str) -> List[Tuple[str, List[str]]]:
    """
    Находит повторяющиеся блоки HTML (например, карточки спикеров)
    Возвращает: [(шаблон_блока, [экземпляр1, экземпляр2, ...])]
    """
    # Ищем повторяющиеся блоки с минимальной вложенностью
    # Не используем .*? для div — слишком жадный
    patterns = [
        r'(<tr[^>]*>(?:(?!</tr>).)*</tr>)',  # table rows
        r'(<li[^>]*>(?:(?!</li>).)*</li>)',  # list items
    ]
    
    repeating = []
    
    # Ищем последовательные div с одинаковой структурой
    div_pattern = r'<div([^>]*)>((?:(?!<div[^>]*>|</div>).)*)</div>'
    all_divs = list(re.finditer(div_pattern, html, re.DOTALL))
    
    # Группируем последовательные div с похожей структурой
    if len(all_divs) >= 2:
        groups = []
        for match in all_divs:
            div_html = match.group(0)
            # Извлекаем структуру без текста
            structure = re.sub(r'>([^<]+)<', '><', div_html)
            
            matched = False
            for group in groups:
                group_structure = re.sub(r'>([^<]+)<', '><', group[0])
                similarity = SequenceMatcher(None, structure, group_structure).ratio()
                if similarity > 0.8:  # Более строгое сходство
                    group.append(div_html)
                    matched = True
                    break
            
            if not matched:
                groups.append([div_html])
        
        # Берём только группы с 3+ элементами (более уверенное распознавание)
        for group in groups:
            if len(group) >= 3:
                repeating.append((group[0], group))
    
    # Ищем другие паттерны
    for pattern in patterns:
        blocks = re.findall(pattern, html, re.DOTALL)
        if len(blocks) < 2:
            continue
        
        groups = []
        for block in blocks:
            structure = re.sub(r'>([^<]+)<', '><', block)
            
            matched = False
            for group in groups:
                group_structure = re.sub(r'>([^<]+)<', '><', group[0])
                similarity = SequenceMatcher(None, structure, group_structure).ratio()
                if similarity > 0.7:
                    group.append(block)
                    matched = True
                    break
            
            if not matched:
                groups.append([block])
        
        for group in groups:
            if len(group) >= 2:
                repeating.append((group[0], group))
    
    return repeating

def convert_to_template_regex(html: str) -> Tuple[str, Dict[str, Any]]:
    """
    Быстрая замена через regex (без AI) — работает за миллисекунды
    Возвращает: (преобразованный HTML, словарь с переменными и slots_schema)
    """
    variables = {}
    slots_schema = {}
    counter = {'text': 0, 'url': 0, 'img': 0, 'loop': 0}
    
    # Шаг 1: Найти повторяющиеся блоки
    repeating_blocks = find_repeating_blocks(html)
    
    # Шаг 2: Заменить повторяющиеся блоки на циклы
    result = html
    for template_block, instances in repeating_blocks:
        if len(instances) < 2:
            continue
        
        counter['loop'] += 1
        loop_name = f"items_{counter['loop']}"
        
        # Извлекаем переменные из первого экземпляра
        item_template = template_block
        item_vars = {}
        item_counter = 1
        
        # Заменяем текст на переменные
        def replace_item_text(match):
            nonlocal item_counter
            text = match.group(1).strip()
            if not text or len(text) < 3:
                return match.group(0)
            var_name = f"field_{item_counter}"
            item_vars[var_name] = text
            item_counter += 1
            return f'>{{{{ {var_name} }}}}<'
        
        item_template = re.sub(r'>([^<>{}&]+)<', replace_item_text, item_template)
        
        # Создаём Mustache цикл
        loop_html = f'{{{{#{loop_name}}}}}\n{item_template}\n{{{{/{loop_name}}}}}'
        
        # Находим первое вхождение ДО замены
        first_occurrence = instances[0]
        if first_occurrence not in result:
            continue
        
        # Заменяем первое вхождение на цикл
        result = result.replace(first_occurrence, loop_html, 1)
        
        # Удаляем остальные экземпляры
        for instance in instances[1:]:
            result = result.replace(instance, '', 1)
        
        # Добавляем schema для цикла
        slots_schema[loop_name] = {
            "type": "array",
            "description": f"Массив элементов (найдено {len(instances)} шт)",
            "items": {k: "string" for k in item_vars.keys()}
        }
        
        # Добавляем примеры данных
        variables[loop_name] = [item_vars]
    
    # Шаг 3: Заменяем оставшиеся одиночные переменные
    def replace_text(match):
        text = match.group(1).strip()
        if not text or len(text) < 3 or text in ['&nbsp;', '​']:
            return match.group(0)
        
        counter['text'] += 1
        var_name = f"text_{counter['text']}"
        variables[var_name] = text
        slots_schema[var_name] = {"type": "string", "description": "Текстовое поле"}
        return f'>{{{{ {var_name} }}}}<'
    
    def replace_url(match):
        url = match.group(2).strip()
        if not url or url.startswith('{{') or url == '#':
            return match.group(0)
        
        counter['url'] += 1
        var_name = f"url_{counter['url']}"
        variables[var_name] = url
        slots_schema[var_name] = {"type": "string", "description": "URL ссылки"}
        return f'{match.group(1)}{{{{ {var_name} }}}}{match.group(3)}'
    
    def replace_img(match):
        src = match.group(2).strip()
        if not src or src.startswith('{{'):
            return match.group(0)
        
        counter['img'] += 1
        var_name = f"image_{counter['img']}"
        variables[var_name] = src
        slots_schema[var_name] = {"type": "string", "description": "URL изображения"}
        return f'{match.group(1)}{{{{ {var_name} }}}}{match.group(3)}'
    
    # Заменяем <img src="...">
    result = re.sub(r'(<img[^>]+src=["\'])([^"\']+)(["\'][^>]*>)', replace_img, result)
    
    # Заменяем <a href="...">
    result = re.sub(r'(<a[^>]+href=["\'])([^"\']+)(["\'][^>]*>)', replace_url, result)
    
    # Заменяем текст внутри тегов
    result = re.sub(r'>([^<>{}&]+)<', replace_text, result)
    
    return result, {"variables": variables, "slots_schema": slots_schema}

def apply_ai_instructions(html: str, instructions: Dict[str, Any]) -> Tuple[str, Dict[str, Any]]:
    """
    Применяет AI-инструкции через regex (без генерации кода AI)
    
    Args:
        html: исходный HTML
        instructions: JSON от analyze_template_with_ai
    
    Returns:
        (преобразованный HTML, переменные с схемой)
    """
    result = html
    variables = {}
    slots_schema = {}
    
    print(f"[DEBUG] Applying {len(instructions.get('loops', []))} loops, {len(instructions.get('variables', []))} variables")
    
    # Шаг 1: Применяем циклы
    for loop in instructions.get('loops', []):
        start = loop.get('start_marker', '')
        end = loop.get('end_marker', '')
        var_name = loop.get('variable_name', 'items')
        fields = loop.get('fields', [])
        
        print(f"[DEBUG] Loop '{var_name}': looking for '{start[:30]}...'{end[:30]}'")
        
        # Ищем блок между маркерами
        pattern = re.escape(start) + r'(.*?)' + re.escape(end)
        match = re.search(pattern, result, re.DOTALL)
        
        if not match:
            print(f"[WARN] Loop '{var_name}': markers not found in HTML")
            continue
        
        print(f"[DEBUG] Loop '{var_name}': found block {len(match.group(1))} chars")
        
        block = match.group(1)
        
        # Заменяем поля в блоке на переменные
        item_template = block
        item_vars = {}
        
        for field in fields:
            field_name = field.get('name', 'field')
            example = field.get('example', '')
            
            if example:
                # Заменяем конкретный пример на переменную
                item_template = item_template.replace(example, f'{{{{ {field_name} }}}}')
                item_vars[field_name] = example
        
        # Создаем цикл
        loop_html = f'{{{{#{var_name}}}}}{item_template}{{{{/{var_name}}}}}'
        
        # Заменяем блок на цикл
        result = result.replace(start + block + end, start + loop_html + end, 1)
        
        # Добавляем схему
        slots_schema[var_name] = {
            "type": "array",
            "description": f"Массив {var_name}",
            "items": {f['name']: "string" for f in fields}
        }
        variables[var_name] = [item_vars]
    
    # Шаг 2: Заменяем одиночные переменные
    for var in instructions.get('variables', []):
        unique_text = var.get('unique_text', '')
        var_name = var.get('variable_name', 'var')
        var_type = var.get('type', 'text')
        
        if unique_text and unique_text in result:
            result = result.replace(unique_text, f'{{{{ {var_name} }}}}')
            variables[var_name] = unique_text
            slots_schema[var_name] = {
                "type": "string",
                "description": f"{var_type.capitalize()} поле"
            }
    
    return result, {"variables": variables, "slots_schema": slots_schema}

def analyze_template_with_ai(html: str, api_key: str) -> Dict[str, Any]:
    """
    ИИ ТОЛЬКО АНАЛИЗИРУЕТ HTML и возвращает JSON-инструкцию для regex
    НЕ генерирует код, только маркирует что заменить
    
    Возвращает:
    {
      "loops": [{"pattern": "regex", "variable_name": "items", "fields": ["title", "desc"]}],
      "variables": [{"pattern": "regex", "variable_name": "heading", "type": "text|url|image"}]
    }
    """
    
    prompt = f"""Analyze this HTML and return ONLY a JSON instruction for regex replacement. Do NOT generate code.

HTML:
{html[:3000]}

Return JSON:
{{
  "loops": [
    {{"start_marker": "unique text before loop", "end_marker": "unique text after loop", "variable_name": "stats_items", "fields": [{{"name": "number", "example": "73%"}}, {{"name": "text", "example": "компаний..."}}]}}
  ],
  "variables": [
    {{"unique_text": "Ключевые показатели индустрии", "variable_name": "main_heading", "type": "text"}}
  ]
}}

Rules:
1. Find repeating blocks (3+ similar elements)
2. Identify unique text markers around loops
3. Mark standalone dynamic text/urls/images
4. Return ONLY valid JSON, no explanations"""

    # Используем OpenRouter для доступа к Claude
    response = requests.post(
        'https://openrouter.ai/api/v1/chat/completions',
        headers={
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://poehali.dev',
            'X-Title': 'Template Generator'
        },
        json={
            'model': 'anthropic/claude-3.5-sonnet',
            'messages': [{'role': 'user', 'content': prompt}],
            'max_tokens': 2000
        },
        timeout=30
    )
    
    if response.status_code != 200:
        raise Exception(f'OpenRouter API error: {response.status_code} {response.text}')
    
    result = response.json()
    content = result['choices'][0]['message']['content'].strip()
    
    print(f"[DEBUG] AI raw response: {content[:500]}")
    
    # Extract JSON from markdown code blocks if present
    if '```json' in content:
        content = content.split('```json')[1].split('```')[0].strip()
    elif '```' in content:
        content = content.split('```')[1].split('```')[0].strip()
    
    parsed = json.loads(content)
    print(f"[DEBUG] AI parsed JSON: {json.dumps(parsed, ensure_ascii=False)[:300]}")
    return parsed

def convert_to_template_ai(html: str, api_key: str) -> str:
    """
    LEGACY: Полная генерация через AI (медленно, дорого)
    Используется если use_ai=true и hybrid_ai=false
    """
    
    prompt = f"""CRITICAL: Copy ALL HTML structure, tags, attributes, and styles EXACTLY. Only replace TEXT CONTENT with Mustache variables.

PRESERVE 100%:
- All <style> blocks
- All inline style="..." attributes  
- All class names
- All CSS (colors, gradients, padding, margins, borders)
- All HTML structure and nesting

REPLACE ONLY:
- Text inside tags → {{{{variable}}}}
- href/src URLs → {{{{url_variable}}}}

BAD (removes styles):
<div class="header"><h1>{{{{title}}}}</h1></div>

GOOD (preserves everything):
<div class="header" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px;">
  <h1 style="color: #fff; font-size: 32px; margin: 0;">{{{{title}}}}</h1>
</div>

Return ONLY the converted HTML, no explanations.

HTML to convert:
{html}"""

    try:
        response = requests.post(
            'https://openrouter.ai/api/v1/chat/completions',
            headers={
                'Authorization': f'Bearer {api_key}',
                'Content-Type': 'application/json'
            },
            json={
                'model': 'anthropic/claude-3.5-sonnet',
                'messages': [{'role': 'user', 'content': prompt}],
                'max_tokens': 16000
            },
            timeout=60
        )
        
        if response.status_code != 200:
            print(f"[ERROR] OpenRouter failed: {response.status_code} {response.text}")
            raise Exception(f"OpenRouter error: {response.status_code}")
        
        result = response.json()
        html_result = result['choices'][0]['message']['content'].strip()
        
        # Убираем markdown обёртки если ИИ добавил
        html_result = re.sub(r'^```html\s*', '', html_result)
        html_result = re.sub(r'\s*```$', '', html_result)
        
        print(f"[INFO] AI conversion: {len(html)} → {len(html_result)} chars")
        return html_result
        
    except Exception as e:
        print(f"[ERROR] AI conversion failed: {str(e)}")
        raise Exception(f"Template conversion failed: {str(e)}")