import json
import os
from typing import Dict, Any, List
import psycopg2
import urllib.request

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Business: Генерирует письма через слоты: AI заполняет структурированные данные, шаблон остаётся неизменным
    Args: event - dict с httpMethod, body {event_id: int, content_type_id: int, content_plan_item_id?: int}
    Returns: HTTP response с сгенерированным письмом (subject, html, slots_data)
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
        
        event_id = body_data.get('event_id')
        content_type_id = body_data.get('content_type_id')
        content_plan_item_id = body_data.get('content_plan_item_id')
        
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
        
        openrouter_key = os.environ.get('OPENROUTER_API_KEY', '')
        if not openrouter_key:
            return {
                'statusCode': 500,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'OPENROUTER_API_KEY not configured'})
            }
        
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()
        
        cur.execute(
            "SELECT use_v2_pipeline FROM t_p22819116_event_schedule_app.events WHERE id = " + str(event_id)
        )
        result = cur.fetchone()
        
        if not result or not result[0]:
            cur.close()
            conn.close()
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'V2 pipeline not enabled for this event'})
            }
        
        cur.execute(
            "SELECT name, instructions, html_layout, slots_schema FROM t_p22819116_event_schedule_app.email_templates "
            "WHERE event_id = " + str(event_id) + " AND content_type_id = " + str(content_type_id) + " LIMIT 1"
        )
        
        template_row = cur.fetchone()
        
        if not template_row:
            cur.close()
            conn.close()
            return {
                'statusCode': 404,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'Template not found for this content type'})
            }
        
        template_name, instructions, html_layout, slots_schema_json = template_row
        
        if not html_layout or not slots_schema_json:
            cur.close()
            conn.close()
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'Template missing html_layout or slots_schema. Update template first.'})
            }
        
        slots_schema = slots_schema_json
        
        key_message = None
        subject_hint = None
        
        if content_plan_item_id:
            cur.execute(
                "SELECT subject, key_message FROM t_p22819116_event_schedule_app.content_plan_items "
                "WHERE id = " + str(content_plan_item_id)
            )
            plan_row = cur.fetchone()
            if plan_row:
                subject_hint, key_message = plan_row
        
        query_text = key_message if key_message else (instructions if instructions else template_name)
        query_embedding = create_embedding(query_text, openrouter_key)
        
        cur.execute(
            "SELECT content, item_type, metadata FROM t_p22819116_event_schedule_app.knowledge_store WHERE event_id = " + 
            str(event_id) + " ORDER BY embedding <-> ARRAY[" + ",".join(str(x) for x in query_embedding) + "] LIMIT 5"
        )
        
        rag_results = cur.fetchall()
        
        if not rag_results:
            cur.close()
            conn.close()
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'No knowledge indexed for this event. Run indexing first.'})
            }
        
        context_texts = []
        for content, item_type, metadata_str in rag_results:
            context_texts.append(f"[{item_type}] {content}")
        
        context = "\n".join(context_texts)
        
        cur.execute(
            "SELECT default_cta_primary, default_cta_text_primary, default_cta_secondary, default_cta_text_secondary "
            "FROM t_p22819116_event_schedule_app.content_types WHERE id = " + str(content_type_id)
        )
        
        cta_row = cur.fetchone()
        
        cta_url = cta_row[0] if cta_row and cta_row[0] else 'https://human-obuchenie.ru'
        cta_text_default = cta_row[1] if cta_row and cta_row[1] else 'Узнать больше'
        
        subject_instruction = ""
        if subject_hint:
            subject_instruction = f"""
ТЕМА ПИСЬМА ФИКСИРОВАНА (из контент-плана):
"{subject_hint}"

⚠️ НЕ МЕНЯЙ ТЕМУ! Используй её как есть в поле "subject".
"""
        else:
            subject_instruction = "5. subject: тема письма до 50 символов"
        
        prompt = f"""Ты — эксперт по email-маркетингу для мероприятий.

КОНТЕКСТ (релевантные данные из программы и болей HR):
{context}

ИНСТРУКЦИИ ДЛЯ ПИСЬМА:
{instructions}

{"КЛЮЧЕВОЕ СООБЩЕНИЕ: " + key_message if key_message else ""}

{subject_instruction}

ЗАДАЧА:
Заполни слоты для email-шаблона. НЕ генерируй HTML! Верни ТОЛЬКО данные для слотов.

СХЕМА СЛОТОВ:
{json.dumps(slots_schema, ensure_ascii=False, indent=2)}

ПРАВИЛА:
1. headline: цепляющий заголовок до 60 символов, говорит про боль HR
2. intro_text: 2-3 предложения про проблему, которую решает конференция
3. speakers: массив из 2-3 спикеров из контекста, выбери самых релевантных
   - Каждый спикер: {{"name": "Имя", "title": "Должность", "pitch": "Что даст доклад (1 предложение)", "photo_url": "https://via.placeholder.com/150"}}
4. cta_text: текст для кнопки (например: "Посмотреть программу", "Зарегистрироваться")

CTA ссылка будет подставлена автоматически: {cta_url}
Текст CTA по умолчанию: {cta_text_default}

Верни JSON в точном формате:
{{
  "subject": "{subject_hint if subject_hint else 'тема письма'}",
  "headline": "заголовок",
  "intro_text": "вступительный текст",
  "speakers": [
    {{"name": "...", "title": "...", "pitch": "...", "photo_url": "https://via.placeholder.com/150"}}
  ],
  "cta_text": "текст кнопки"
}}
"""
        
        generated = call_openai(prompt, openrouter_key)
        
        cur.close()
        conn.close()
        
        try:
            slots_data = json.loads(generated)
            
            if subject_hint:
                slots_data['subject'] = subject_hint
            
            slots_data['cta_url'] = cta_url
            
            filled_html = fill_html_template(html_layout, slots_data)
            
            validation_result = None
            try:
                conn2 = psycopg2.connect(db_url)
                cur2 = conn2.cursor()
                cur2.execute(
                    "SELECT email_template_examples FROM t_p22819116_event_schedule_app.events WHERE id = " + str(event_id)
                )
                template_examples_row = cur2.fetchone()
                cur2.close()
                conn2.close()
                
                if template_examples_row and template_examples_row[0]:
                    validation_prompt = f"""Проверь сгенерированное письмо на соответствие стилю примеров.

ПРИМЕРЫ: {template_examples_row[0]}

СГЕНЕРИРОВАНО: {filled_html}

Оцени по 7 критериям (colors, typography, structure, spacing, cta_buttons, responsive, branding) от 0 до 10.
Верни JSON: {{"overall_score": 8.5, "issues": [...], "suggestions": [...], "passed": true}}"""
                    
                    validation_response = call_openai(validation_prompt, openrouter_key)
                    validation_json_str = validation_response.strip()
                    if validation_json_str.startswith('```json'):
                        validation_json_str = validation_json_str[7:]
                    if validation_json_str.startswith('```'):
                        validation_json_str = validation_json_str[3:]
                    if validation_json_str.endswith('```'):
                        validation_json_str = validation_json_str[:-3]
                    validation_json_str = validation_json_str.strip()
                    
                    validation_result = json.loads(validation_json_str)
            except:
                pass
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({
                    'success': True,
                    'subject': slots_data.get('subject', subject_hint or 'Письмо сгенерировано'),
                    'html': filled_html,
                    'slots_data': slots_data,
                    'template_name': template_name,
                    'rag_context_items': len(rag_results),
                    'validation': validation_result
                })
            }
        except Exception as e:
            return {
                'statusCode': 500,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({
                    'error': f'Failed to parse AI response: {str(e)}',
                    'raw_response': generated
                })
            }
    
    return {
        'statusCode': 405,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'body': json.dumps({'error': 'Method not allowed'})
    }

def fill_html_template(html_layout: str, slots_data: Dict[str, Any]) -> str:
    """Заполняет HTML шаблон данными из слотов"""
    result = html_layout
    
    for key, value in slots_data.items():
        if isinstance(value, list):
            if key == 'speakers' and '{{#speakers}}' in result:
                speakers_block_start = result.find('{{#speakers}}')
                speakers_block_end = result.find('{{/speakers}}')
                
                if speakers_block_start != -1 and speakers_block_end != -1:
                    template_block = result[speakers_block_start + len('{{#speakers}}'):speakers_block_end]
                    
                    rendered_speakers = ''
                    for speaker in value:
                        speaker_html = template_block
                        for sp_key, sp_value in speaker.items():
                            speaker_html = speaker_html.replace('{{' + sp_key + '}}', str(sp_value))
                        rendered_speakers += speaker_html
                    
                    result = result[:speakers_block_start] + rendered_speakers + result[speakers_block_end + len('{{/speakers}}'):]
        else:
            result = result.replace('{{' + key + '}}', str(value))
    
    return result

def create_embedding(text: str, api_key: str) -> List[float]:
    """Создаёт эмбеддинг через OpenRouter API"""
    data = {
        'model': 'openai/text-embedding-3-small',
        'input': text
    }
    
    req = urllib.request.Request(
        'https://openrouter.ai/api/v1/embeddings',
        data=json.dumps(data).encode('utf-8'),
        headers={
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {api_key}',
            'HTTP-Referer': 'https://poehali.dev',
            'X-Title': 'Event Schedule App'
        }
    )
    
    with urllib.request.urlopen(req) as response:
        result = json.loads(response.read().decode('utf-8'))
        return result['data'][0]['embedding']

def call_openai(prompt: str, api_key: str) -> str:
    """Вызывает OpenRouter Chat API"""
    data = {
        'model': 'openai/gpt-4o-mini',
        'messages': [{'role': 'user', 'content': prompt}],
        'temperature': 0.7
    }
    
    req = urllib.request.Request(
        'https://openrouter.ai/api/v1/chat/completions',
        data=json.dumps(data).encode('utf-8'),
        headers={
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {api_key}',
            'HTTP-Referer': 'https://poehali.dev',
            'X-Title': 'Event Schedule App'
        }
    )
    
    with urllib.request.urlopen(req) as response:
        result = json.loads(response.read().decode('utf-8'))
        return result['choices'][0]['message']['content']