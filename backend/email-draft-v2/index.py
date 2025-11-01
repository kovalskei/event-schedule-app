import json
import os
import re
from typing import Dict, Any, List
import psycopg2
import urllib.request

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Business: Генерирует готовый черновик письма из шаблона + базы знаний
    Args: event_id, content_type_id, theme (тема письма)
    Returns: Готовое письмо (subject + HTML) + ID черновика в БД
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
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Method not allowed'})
        }
    
    body_str = event.get('body', '{}')
    body_data = json.loads(body_str if body_str else '{}')
    
    event_id = body_data.get('event_id')
    content_type_id = body_data.get('content_type_id')
    theme = body_data.get('theme', '')
    
    if not event_id or not content_type_id:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'event_id and content_type_id required'})
        }
    
    db_url = os.environ.get('DATABASE_URL', '')
    openai_key = os.environ.get('OPENAI_API_KEY', '')
    
    if not db_url or not openai_key:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Environment not configured'})
        }
    
    try:
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()
        
        # 1. Получаем шаблон для типа контента
        cur.execute("""
            SELECT id, name, html_template, subject_template 
            FROM t_p22819116_event_schedule_app.email_templates 
            WHERE event_id = %s AND content_type_id = %s 
            LIMIT 1
        """, (event_id, content_type_id))
        
        template_row = cur.fetchone()
        if not template_row:
            cur.close()
            conn.close()
            return {
                'statusCode': 404,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'Template not found for this content type'})
            }
        
        template_id, template_name, html_template, subject_template = template_row
        
        # 2. Получаем тип контента и CTA
        cur.execute("""
            SELECT name, description, default_cta_text_primary, default_cta_primary,
                   default_cta_text_secondary, default_cta_secondary
            FROM t_p22819116_event_schedule_app.content_types
            WHERE id = %s
        """, (content_type_id,))
        
        content_type_row = cur.fetchone()
        content_type_name = content_type_row[0] if content_type_row else 'Unknown'
        content_type_desc = content_type_row[1] if content_type_row else ''
        cta_text_primary = content_type_row[2] if content_type_row else 'Посмотреть программу'
        cta_url_primary = content_type_row[3] if content_type_row else '#'
        cta_text_secondary = content_type_row[4] if content_type_row else None
        cta_url_secondary = content_type_row[5] if content_type_row else None
        
        # 3. Извлекаем переменные из шаблона
        variables = extract_template_variables(html_template)
        
        # 4. Получаем базу знаний
        cur.execute("""
            SELECT item_type, content, metadata 
            FROM t_p22819116_event_schedule_app.knowledge_store 
            WHERE event_id = %s
        """, (event_id,))
        
        knowledge_rows = cur.fetchall()
        knowledge = group_knowledge(knowledge_rows)
        
        # 5. Генерируем данные через AI
        ai_result = generate_content_with_ai(
            theme=theme,
            content_type=content_type_name,
            content_type_desc=content_type_desc,
            knowledge=knowledge,
            variables=variables,
            openai_key=openai_key
        )
        
        if not ai_result.get('success'):
            cur.close()
            conn.close()
            return {
                'statusCode': 500,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': f"AI generation failed: {ai_result.get('error')}"})
            }
        
        generated_data = ai_result['data']
        
        # 6. Добавляем CTA если их нет
        if 'cta_primary_text' not in generated_data:
            generated_data['cta_primary_text'] = cta_text_primary
        if 'cta_primary_url' not in generated_data:
            generated_data['cta_primary_url'] = cta_url_primary
        if cta_text_secondary and 'cta_secondary_text' not in generated_data:
            generated_data['cta_secondary_text'] = cta_text_secondary
        if cta_url_secondary and 'cta_secondary_url' not in generated_data:
            generated_data['cta_secondary_url'] = cta_url_secondary
        
        # 7. Рендерим HTML
        rendered_html = render_template(html_template, generated_data)
        
        # 8. Генерируем subject если не было в шаблоне
        subject = generated_data.get('subject', theme[:50])
        
        # 9. Сохраняем черновик в БД
        cur.execute("""
            INSERT INTO t_p22819116_event_schedule_app.generated_emails 
            (subject, html_content, template_id, content_type_id, status, 
             pipeline_version, input_params, pass1_json)
            VALUES (%s, %s, %s, %s, 'draft', 'v2', %s, %s)
            RETURNING id
        """, (
            subject,
            rendered_html,
            str(template_id),
            content_type_id,
            json.dumps({'event_id': event_id, 'theme': theme}),
            json.dumps(generated_data)
        ))
        
        draft_id = cur.fetchone()[0]
        conn.commit()
        
        cur.close()
        conn.close()
        
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({
                'success': True,
                'draft_id': draft_id,
                'subject': subject,
                'html': rendered_html,
                'template_name': template_name,
                'ai_reasoning': ai_result.get('reasoning', '')
            })
        }
        
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)})
        }


def extract_template_variables(template_html: str) -> List[str]:
    """Извлекает переменные вида {{var}} и {{var|default}}"""
    pattern_with_default = r'\{\{([a-zA-Z_0-9]+)\|[^}]*\}\}'
    pattern_no_default = r'\{\{([a-zA-Z_0-9]+)\}\}'
    
    vars_with_default = re.findall(pattern_with_default, template_html)
    vars_no_default = re.findall(pattern_no_default, template_html)
    
    return list(set(vars_with_default + vars_no_default))


def group_knowledge(knowledge_rows: List[tuple]) -> Dict[str, List[Dict]]:
    """Группирует знания по типам"""
    grouped = {}
    for row in knowledge_rows:
        item_type = row[0]
        content = row[1]
        metadata = row[2] or {}
        
        if item_type not in grouped:
            grouped[item_type] = []
        
        grouped[item_type].append({
            'content': content,
            'metadata': metadata
        })
    
    return grouped


def generate_content_with_ai(
    theme: str,
    content_type: str,
    content_type_desc: str,
    knowledge: Dict[str, List[Dict]],
    variables: List[str],
    openai_key: str
) -> Dict[str, Any]:
    """Генерирует контент через OpenAI"""
    
    # Формируем контекст из базы знаний
    context_parts = []
    
    if 'speaker' in knowledge:
        speakers_text = '\n'.join([
            f"- {item['metadata'].get('name', 'Unknown')}: {item['content']}"
            for item in knowledge['speaker'][:10]
        ])
        context_parts.append(f"Спикеры конференции:\n{speakers_text}")
    
    if 'program' in knowledge:
        program_text = '\n'.join([item['content'] for item in knowledge['program'][:5]])
        context_parts.append(f"Программа:\n{program_text}")
    
    if 'event_info' in knowledge:
        event_text = '\n'.join([item['content'] for item in knowledge['event_info'][:3]])
        context_parts.append(f"Информация о мероприятии:\n{event_text}")
    
    context = '\n\n'.join(context_parts) if context_parts else 'Нет данных'
    
    # Промпт для AI
    prompt = f"""Ты — AI-копирайтер для email-рассылок о конференции.

Тип письма: {content_type}
Описание типа: {content_type_desc}
Тема письма: {theme}

База знаний о конференции:
{context}

Нужно заполнить следующие переменные для шаблона письма:
{', '.join(variables)}

ВАЖНО:
1. Текст должен соответствовать типу контента "{content_type}"
2. Используй данные из базы знаний (спикеры, программа)
3. Если есть переменная "subject" — придумай цепляющую тему письма (до 50 символов)
4. Если есть speakers_* переменные — выбери 2-3 релевантных спикера из базы
5. Текст должен быть кратким, профессиональным, мотивирующим

Верни JSON со всеми переменными и коротким обоснованием выбора (reasoning).

Пример:
{{
  "subject": "3 спикера о мотивации команды",
  "hero_title": "Как удержать лучших сотрудников?",
  "intro": "Разбираем 3 кейса успешной адаптации",
  "reasoning": "Выбрал спикеров Иванова, Петрову и Сидорова, так как они эксперты по мотивации"
}}

Твой ответ (только JSON):"""
    
    # Запрос к OpenAI
    try:
        req_data = json.dumps({
            'model': 'gpt-4o-mini',
            'messages': [
                {'role': 'system', 'content': 'Ты AI-копирайтер для email-рассылок. Отвечаешь только валидным JSON.'},
                {'role': 'user', 'content': prompt}
            ],
            'temperature': 0.7,
            'max_tokens': 1500
        }).encode('utf-8')
        
        req = urllib.request.Request(
            'https://api.openai.com/v1/chat/completions',
            data=req_data,
            headers={
                'Authorization': f'Bearer {openai_key}',
                'Content-Type': 'application/json'
            }
        )
        
        with urllib.request.urlopen(req, timeout=30) as response:
            result = json.loads(response.read().decode('utf-8'))
        
        ai_text = result['choices'][0]['message']['content'].strip()
        
        # Извлекаем JSON из ответа
        json_match = re.search(r'\{.*\}', ai_text, re.DOTALL)
        if json_match:
            ai_data = json.loads(json_match.group(0))
            reasoning = ai_data.pop('reasoning', '')
            return {
                'success': True,
                'data': ai_data,
                'reasoning': reasoning
            }
        else:
            return {
                'success': False,
                'error': 'AI did not return valid JSON'
            }
            
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }


def render_template(template_html: str, data: Dict[str, Any]) -> str:
    """Подставляет данные в шаблон"""
    result = template_html
    
    # Заменяем {{var|default}} и {{var}}
    for key, value in data.items():
        # С дефолтом
        pattern_with_default = r'\{\{' + re.escape(key) + r'\|[^}]*\}\}'
        result = re.sub(pattern_with_default, str(value), result)
        
        # Без дефолта
        pattern_no_default = r'\{\{' + re.escape(key) + r'\}\}'
        result = re.sub(pattern_no_default, str(value), result)
    
    # Удаляем оставшиеся непод�тавленные переменные
    result = re.sub(r'\{\{[^}]+\}\}', '[missing]', result)
    
    return result
