import json
import os
import psycopg2
from typing import Dict, Any, List
from openai import OpenAI
import httpx

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Business: Тестирование 10 разных методов генерации писем для поиска лучшего
    Args: event с body: {template_id, test_topic}
    Returns: {methods: [{method_name, generated_html, quality_score}]}
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
    template_id: int = body_data.get('template_id', 171)
    test_topic: str = body_data.get('test_topic', 'Анонс спикеров конференции по маркетингу 2025')
    
    dsn = os.environ.get('DATABASE_URL')
    openai_key = os.environ.get('OPENAI_API_KEY')
    https_proxy = os.environ.get('HTTPS_PROXY')
    
    if not dsn or not openai_key:
        return {
            'statusCode': 500,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Missing configuration'})
        }
    
    conn = psycopg2.connect(dsn)
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT html_template, manual_variables, original_html, name
                FROM t_p22819116_event_schedule_app.email_templates
                WHERE id = %s
            """, (template_id,))
            
            row = cur.fetchone()
            if not row:
                return {
                    'statusCode': 404,
                    'headers': {'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Template not found'})
                }
            
            html_template = row[0]
            manual_variables = row[1] or []
            original_html = row[2]
            template_name = row[3]
        
        if https_proxy:
            http_client = httpx.Client(proxy=https_proxy)
        else:
            http_client = httpx.Client()
        
        client = OpenAI(api_key=openai_key, http_client=http_client)
        
        # Тестовые методы генерации
        methods_results = []
        
        # МЕТОД 1: Простой промпт с переменными
        method1_result = test_method_1(client, html_template, manual_variables, test_topic)
        methods_results.append({
            'method_name': 'Метод 1: Простая генерация по переменным',
            'generated_html': method1_result,
            'description': 'Базовый промпт с описанием переменных'
        })
        
        # МЕТОД 2: Контекст + структура
        method2_result = test_method_2(client, html_template, manual_variables, test_topic, original_html)
        methods_results.append({
            'method_name': 'Метод 2: С контекстом оригинала',
            'generated_html': method2_result,
            'description': 'Использует оригинальный HTML как референс'
        })
        
        # МЕТОД 3: Пошаговая генерация
        method3_result = test_method_3(client, html_template, manual_variables, test_topic)
        methods_results.append({
            'method_name': 'Метод 3: Пошаговая генерация',
            'generated_html': method3_result,
            'description': 'Генерирует каждую переменную отдельным запросом'
        })
        
        # МЕТОД 4: С примерами
        method4_result = test_method_4(client, html_template, manual_variables, test_topic)
        methods_results.append({
            'method_name': 'Метод 4: С примерами контента',
            'generated_html': method4_result,
            'description': 'Показывает примеры желаемого контента'
        })
        
        # МЕТОД 5: Фокус на сохранении дизайна
        method5_result = test_method_5(client, html_template, manual_variables, test_topic)
        methods_results.append({
            'method_name': 'Метод 5: Сохранение дизайна',
            'generated_html': method5_result,
            'description': 'Акцент на сохранении HTML структуры и стилей'
        })
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'success': True,
                'template_id': template_id,
                'template_name': template_name,
                'test_topic': test_topic,
                'methods': methods_results,
                'total_methods': len(methods_results)
            }, ensure_ascii=False)
        }
        
    finally:
        conn.close()


def apply_variables(html_template, manual_variables, variables_filled):
    """Применяет сгенерированные переменные к HTML шаблону"""
    result_html = html_template
    for var in manual_variables:
        if var['name'] in variables_filled:
            replacement = variables_filled[var['name']]
            # Если это список/dict, конвертируем в JSON строку
            if isinstance(replacement, (list, dict)):
                replacement = json.dumps(replacement, ensure_ascii=False)
            result_html = result_html.replace(var['content'], str(replacement), 1)
    return result_html


def test_method_1(client, html_template, manual_variables, topic):
    """Простая генерация переменных"""
    vars_list = [{'name': v['name'], 'description': v['description']} for v in manual_variables]
    
    prompt = f"""Сгенерируй содержимое переменных для email-письма.

Тема: {topic}

Переменные:
{json.dumps(vars_list, ensure_ascii=False, indent=2)}

Верни JSON: {{"var_name": "значение"}}"""

    completion = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.7
    )
    
    response_text = completion.choices[0].message.content
    json_start = response_text.find('{')
    json_end = response_text.rfind('}') + 1
    if json_start != -1:
        response_text = response_text[json_start:json_end]
    
    variables_filled = json.loads(response_text)
    return apply_variables(html_template, manual_variables, variables_filled)


def test_method_2(client, html_template, manual_variables, topic, original_html):
    """С контекстом оригинального HTML"""
    vars_list = [{'name': v['name'], 'description': v['description'], 'original': v['content'][:100]} for v in manual_variables]
    
    prompt = f"""Сгенерируй контент для email-письма, сохраняя стиль оригинала.

Тема: {topic}

Оригинальный пример контента:
{original_html[:500]}...

Переменные для генерации:
{json.dumps(vars_list, ensure_ascii=False, indent=2)}

ВАЖНО: Сохраняй длину и стиль как в оригинале.

Верни JSON: {{"var_name": "значение"}}"""

    completion = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.7
    )
    
    response_text = completion.choices[0].message.content
    json_start = response_text.find('{')
    json_end = response_text.rfind('}') + 1
    if json_start != -1:
        response_text = response_text[json_start:json_end]
    
    variables_filled = json.loads(response_text)
    return apply_variables(html_template, manual_variables, variables_filled)


def test_method_3(client, html_template, manual_variables, topic):
    """Пошаговая генерация каждой переменной"""
    result_html = html_template
    variables_filled = {}
    
    for var in manual_variables:
        prompt = f"""Сгенерируй ТОЛЬКО текст для переменной email-письма.

Тема письма: {topic}
Переменная: {var['name']}
Описание: {var['description']}
Оригинальный контент: {var['content'][:100]}

Верни ТОЛЬКО текст замены, без JSON, без объяснений."""

        completion = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=500
        )
        
        generated_value = completion.choices[0].message.content.strip()
        variables_filled[var['name']] = generated_value
    
    return apply_variables(html_template, manual_variables, variables_filled)


def test_method_4(client, html_template, manual_variables, topic):
    """С примерами хорошего контента"""
    vars_list = [{'name': v['name'], 'description': v['description']} for v in manual_variables]
    
    prompt = f"""Ты - копирайтер email-рассылок для конференций. 

Тема письма: {topic}

Примеры качественного контента:
- Вступление (pain): "Устали от неэффективных маркетинговых кампаний? Мы собрали ведущих экспертов отрасли."
- Спикер: "Иван Петров, ex-CMO Яндекс, 15 лет в digital-маркетинге"
- CTA: "Зарегистрируйтесь сейчас и получите доступ к эксклюзивным материалам"

Переменные для генерации:
{json.dumps(vars_list, ensure_ascii=False, indent=2)}

Верни JSON с качественным контентом в стиле примеров: {{"var_name": "значение"}}"""

    completion = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.8
    )
    
    response_text = completion.choices[0].message.content
    json_start = response_text.find('{')
    json_end = response_text.rfind('}') + 1
    if json_start != -1:
        response_text = response_text[json_start:json_end]
    
    variables_filled = json.loads(response_text)
    return apply_variables(html_template, manual_variables, variables_filled)


def test_method_5(client, html_template, manual_variables, topic):
    """Фокус на сохранении HTML дизайна"""
    vars_list = []
    for v in manual_variables:
        vars_list.append({
            'name': v['name'],
            'description': v['description'],
            'original_length': len(v['content']),
            'original_preview': v['content'][:80]
        })
    
    prompt = f"""КРИТИЧЕСКИ ВАЖНО: Сгенерируй контент СТРОГО по формату оригинала!

Тема: {topic}

Переменные (с ограничениями по длине):
{json.dumps(vars_list, ensure_ascii=False, indent=2)}

ТРЕБОВАНИЯ:
1. Сохраняй длину текста ±20% от original_length
2. Не добавляй HTML теги если их нет в оригинале
3. Копируй стиль и тон оригинального текста
4. Логотип и футер НЕ меняй - они фиксированные

Верни JSON: {{"var_name": "значение"}}"""

    completion = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.6
    )
    
    response_text = completion.choices[0].message.content
    json_start = response_text.find('{')
    json_end = response_text.rfind('}') + 1
    if json_start != -1:
        response_text = response_text[json_start:json_end]
    
    variables_filled = json.loads(response_text)
    return apply_variables(html_template, manual_variables, variables_filled)