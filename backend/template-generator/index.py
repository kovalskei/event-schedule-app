import json
import os
import re
from typing import Dict, Any, Tuple, List
import psycopg2
import requests
from html.parser import HTMLParser
from difflib import SequenceMatcher
import base64

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
        screenshot_base64 = body_data.get('screenshot')  # NEW: скриншот блока
        event_id = body_data.get('event_id')
        content_type_id = body_data.get('content_type_id')
        template_name = body_data.get('name', 'Шаблон')
        test_mode = body_data.get('test_mode', False)
        use_ai = body_data.get('use_ai', False)  # Legacy AI (полная генерация)
        hybrid_ai = body_data.get('hybrid_ai', False)  # Гибрид: AI анализ + regex замена
        vision_ai = body_data.get('vision_ai', False)  # NEW: Vision AI режим
        
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
            if vision_ai:
                # Vision AI-режим: анализ скриншота + HTML
                openai_key = os.environ.get('OPENAI_API_KEY', '')
                if not openai_key:
                    return {
                        'statusCode': 500,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'OPENAI_API_KEY not configured for vision mode'})
                    }
                if not screenshot_base64:
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'screenshot required for vision_ai mode'})
                    }
                print("[INFO] Using vision AI mode: analyzing screenshot + HTML")
                instructions = analyze_with_vision(html_content, screenshot_base64, openai_key)
                print(f"[INFO] Vision AI found {len(instructions.get('loops', []))} loops, {len(instructions.get('variables', []))} variables")
                html_with_slots, result_data = apply_ai_instructions(html_content, instructions)
            elif hybrid_ai:
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

def extract_fields_from_block(block: str) -> Dict[str, str]:
    """
    Извлекает поля из блока HTML (текст, ссылки, изображения).
    Возвращает: {field_name: field_value}
    
    Логика из билда 894439ae — именованные поля!
    """
    fields = {}
    
    # 1. Извлекаем текстовое содержимое из ячеек таблицы <td>
    td_pattern = r'<td[^>]*>(.*?)</td>'
    td_matches = re.findall(td_pattern, block, re.DOTALL | re.IGNORECASE)
    
    for i, td_content in enumerate(td_matches):
        # Убираем HTML теги, оставляем только текст
        text = re.sub(r'<[^>]+>', '', td_content).strip()
        
        if text and len(text) > 2:  # Игнорируем короткие/пустые
            # Определяем тип поля по позиции
            if i == 0:
                fields['name'] = text
            elif i == 1:
                fields['title'] = text
            elif i == 2:
                fields['description'] = text
            else:
                fields[f'field_{i}'] = text
    
    # 2. Если нет <td>, ищем текст в <div>
    if not fields:
        div_texts = re.findall(r'>([^<>{}&]{3,})<', block)
        for i, text in enumerate(div_texts):
            text = text.strip()
            if text:
                if i == 0:
                    fields['title'] = text
                elif i == 1:
                    fields['description'] = text
                else:
                    fields[f'text_{i}'] = text
    
    # 3. Извлекаем URL изображения
    img_match = re.search(r'<img[^>]*src=["\']([^"\']+)["\']', block, re.IGNORECASE)
    if img_match:
        fields['photo_url'] = img_match.group(1)
    
    # 4. Извлекаем ссылки
    link_match = re.search(r'<a[^>]*href=["\']([^"\']+)["\']', block, re.IGNORECASE)
    if link_match:
        fields['link_url'] = link_match.group(1)
    
    return fields


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
    
    # ПРИОРИТЕТ: Ищем div с числами/процентами (статистика)
    div_pattern_with_numbers = r'<div[^>]*>[^<]*?(\d+%|\d+\.\d+x)[^<]*?</div>'
    number_divs = re.findall(r'(<div[^>]*>[^<]*?(?:\d+%|\d+\.\d+x)[^<]*?</div>)', html, re.DOTALL)
    
    print(f"[DEBUG] Found {len(number_divs)} divs with numbers/percentages")
    
    if len(number_divs) >= 3:
        # Группируем блоки со статистикой
        number_groups = []
        for div_html in number_divs:
            # Нормализуем числа для сравнения структуры
            normalized = re.sub(r'\d+%', 'NUM%', div_html)
            normalized = re.sub(r'\d+\.\d+x', 'NUMx', normalized)
            normalized = re.sub(r'>\s*[^<]*\s*<', '><', normalized)
            
            matched = False
            for group in number_groups:
                group_norm = re.sub(r'\d+%', 'NUM%', group[0])
                group_norm = re.sub(r'\d+\.\d+x', 'NUMx', group_norm)
                group_norm = re.sub(r'>\s*[^<]*\s*<', '><', group_norm)
                
                similarity = SequenceMatcher(None, normalized, group_norm).ratio()
                if similarity > 0.7:
                    group.append(div_html)
                    matched = True
                    break
            
            if not matched:
                number_groups.append([div_html])
        
        # Приоритет: статистика с 3+ элементами
        for group in number_groups:
            if len(group) >= 3:
                print(f"[DEBUG] Found PRIORITY stats group with {len(group)} items")
                repeating.append((group[0], group))
                return repeating  # Возвращаем сразу!
    
    # Fallback: Ищем обычные div (только крупные блоки >200 символов)
    div_pattern = r'<div([^>]*)>((?:(?!<div[^>]*>|</div>).)*)</div>'
    all_divs = list(re.finditer(div_pattern, html, re.DOTALL))
    all_divs = [m for m in all_divs if len(m.group(0)) > 200]  # Фильтруем маленькие блоки
    
    if len(all_divs) >= 2:
        groups = []
        for match in all_divs:
            div_html = match.group(0)
            structure = re.sub(r'>([^<]+)<', '><', div_html)
            
            matched = False
            for group in groups:
                group_structure = re.sub(r'>([^<]+)<', '><', group[0])
                similarity = SequenceMatcher(None, structure, group_structure).ratio()
                if similarity > 0.85:
                    group.append(div_html)
                    matched = True
                    break
            
            if not matched:
                groups.append([div_html])
        
        for group in groups:
            if len(group) >= 3:
                repeating.append((group[0], group))
    
    # Ищем другие паттерны (только крупные блоки)
    for pattern in patterns:
        blocks = re.findall(pattern, html, re.DOTALL)
        # Фильтруем маленькие блоки
        blocks = [b for b in blocks if len(b) > 200]
        
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
    
    # Шаг 2: Заменить повторяющиеся блоки на циклы (от больших к меньшим)
    # Сортируем по размеру — сначала обрабатываем крупные блоки
    repeating_blocks = sorted(repeating_blocks, key=lambda x: len(x[0]), reverse=True)
    
    result = html
    processed_areas = []  # Храним уже обработанные позиции
    
    for template_block, instances in repeating_blocks:
        if len(instances) < 2:
            continue
        
        counter['loop'] += 1
        
        # Определяем имя цикла по контенту
        if '<!-- Спикер' in template_block or 'спикер' in template_block.lower():
            loop_name = 'speakers'
        elif 'speaker' in template_block.lower():
            loop_name = 'speakers'
        else:
            loop_name = f"items_{counter['loop']}"
        
        # Извлекаем переменные из первого экземпляра
        item_template = template_block
        item_vars = extract_fields_from_block(template_block)
        
        print(f"[INFO] Loop '{loop_name}': extracted {len(item_vars)} fields: {list(item_vars.keys())}")
        
        # Заменяем значения полей на переменные Mustache
        for field_name, field_value in item_vars.items():
            if field_value and len(str(field_value)) > 0:
                # Экранируем спецсимволы для regex
                escaped_value = re.escape(str(field_value))
                item_template = re.sub(escaped_value, f'{{{{ {field_name} }}}}', item_template, count=1)
                print(f"[DEBUG] Replaced '{field_value[:30]}...' → {{{{ {field_name} }}}}")
        
        # Создаём Mustache цикл
        loop_html = f'{{{{#{loop_name}}}}}\n{item_template}\n{{{{/{loop_name}}}}}'
        
        # Находим первое вхождение ДО замены
        first_occurrence = instances[0]
        if first_occurrence not in result:
            continue
        
        # Проверяем, не попадает ли этот блок в уже обработанную область
        first_pos = result.find(first_occurrence)
        skip_block = False
        for start, end in processed_areas:
            if start <= first_pos < end:
                skip_block = True
                print(f"[SKIP] Block already inside processed loop at pos {first_pos}")
                break
        
        if skip_block:
            continue
        
        # Заменяем первое вхождение на цикл
        result = result.replace(first_occurrence, loop_html, 1)
        
        # Запоминаем обработанную область
        new_pos = result.find(loop_html)
        processed_areas.append((new_pos, new_pos + len(loop_html)))
        
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

def analyze_with_vision(html: str, screenshot_base64: str, openai_key: str) -> Dict[str, Any]:
    """
    Vision AI: анализирует скриншот + HTML через GPT-4 Vision
    Возвращает инструкцию для regex замены
    """
    
    # Извлекаем текст из HTML для контекста
    text_content = re.sub(r'<[^>]+>', ' ', html)
    text_content = re.sub(r'\s+', ' ', text_content).strip()[:2000]
    
    print(f"[INFO] Analyzing with Vision AI: {len(html)} chars HTML, screenshot provided")
    
    prompt = f"""You are analyzing a screenshot of HTML block that user wants to convert to a template with loops.

USER TASK: Find repeating blocks in this screenshot and create loop instructions.

HTML text content (for reference):
{text_content}

YOUR INSTRUCTIONS:
1. Look at the screenshot - identify visually repeating blocks (3+ similar items)
2. Find EXACT TEXT that appears BEFORE first repeating item and AFTER last item (markers)
3. Extract field examples from repeating blocks (numbers, text, etc.)

CRITICAL RULES:
- start_marker and end_marker MUST be EXACT VISIBLE TEXT from screenshot/HTML
- Do NOT use class names or technical markers
- Copy-paste examples EXACTLY as they appear
- Look for: numbers (73%, 52%, 2.5x), names, descriptions

Return ONLY JSON in this format:
{{
  "loops": [{{
    "start_marker": "Text right before first repeating block",
    "end_marker": "Text right after last repeating block",
    "variable_name": "items",
    "fields": [
      {{"name": "value", "example": "73%"}},
      {{"name": "description", "example": "companies using AI"}}
    ]
  }}],
  "variables": []
}}

Return ONLY valid JSON, no explanations."""
    
    url = "https://api.openai.com/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {openai_key}",
        "Content-Type": "application/json"
    }
    
    # Убираем data:image prefix если есть
    if screenshot_base64.startswith('data:image'):
        screenshot_base64 = screenshot_base64.split(',')[1]
    
    payload = {
        "model": "gpt-4o",
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/png;base64,{screenshot_base64}",
                            "detail": "high"
                        }
                    }
                ]
            }
        ],
        "max_tokens": 2000,
        "temperature": 0.3
    }
    
    print(f"[INFO] Sending request to OpenAI Vision API...")
    response = requests.post(url, headers=headers, json=payload, timeout=60)
    
    if response.status_code != 200:
        print(f"[ERROR] OpenAI Vision API error: {response.status_code} {response.text}")
        return {"loops": [], "variables": []}
    
    result = response.json()
    ai_response = result['choices'][0]['message']['content']
    print(f"[INFO] Vision AI response: {ai_response[:500]}")
    
    # Парсим JSON из ответа
    json_match = re.search(r'\{.*\}', ai_response, re.DOTALL)
    if not json_match:
        print(f"[ERROR] No JSON found in Vision AI response")
        return {"loops": [], "variables": []}
    
    instructions = json.loads(json_match.group(0))
    print(f"[INFO] Vision AI parsed: {len(instructions.get('loops', []))} loops")
    
    return instructions

def analyze_template_with_ai(html: str, api_key: str) -> Dict[str, Any]:
    """
    ИИ АНАЛИЗИРУЕТ HTML и возвращает JSON-инструкцию для regex
    НЕ генерирует код, только маркирует что заменить
    
    Возвращает:
    {
      "loops": [{"pattern": "regex", "variable_name": "items", "fields": ["title", "desc"]}],
      "variables": [{"pattern": "regex", "variable_name": "heading", "type": "text|url|image"}]
    }
    """
    
    # Извлекаем текстовое содержимое для анализа
    text_content = re.sub(r'<[^>]+>', ' ', html)
    text_content = re.sub(r'\s+', ' ', text_content).strip()
    
    # Считаем сколько раз встречаются числа (признак повторов)
    numbers = re.findall(r'\d+%|\d+\.\d+x|\d+ [а-яА-Яa-zA-Z]+', text_content)
    print(f"[DEBUG] Found {len(numbers)} numbers in text: {numbers[:5]}")
    
    prompt = f"""Analyze this HTML and return ONLY a JSON instruction for regex replacement. Do NOT generate code.

HTML (first 7000 chars):
{html[:7000]}

Text content preview (look for repeating patterns):
{text_content[:2000]}

YOUR TASK: Find REPEATING PATTERNS (3+ similar blocks with same structure but different content).

STEP 1: Look for repeating numbers/percentages in text above
Examples: "73%", "52%", "2.5x" appearing multiple times = LOOP!

STEP 2: Find ACTUAL TEXT that comes:
- RIGHT BEFORE the first repeating item
- RIGHT AFTER the last repeating item

CRITICAL RULES:
1. start_marker and end_marker = ACTUAL VISIBLE TEXT, NOT class names
2. "example" field = copy-paste EXACT text from HTML (don't change it!)
3. Look for 3+ items with identical HTML structure

Example GOOD JSON:
{{
  "loops": [{{
    "start_marker": "📊 Ключевые показатели",
    "end_marker": "💡 Почему это важно",
    "variable_name": "stats",
    "fields": [
      {{"name": "percentage", "example": "73%"}},
      {{"name": "description", "example": "компаний уже внедрили AI"}}
    ]
  }}]
}}

Return ONLY valid JSON, no explanations."""

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