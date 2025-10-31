'''
V2 Email Generation Pipeline: Two-pass generation (Plan → Slots)
'''

import json
import os
import urllib.request
from typing import Dict, Any, List, Optional, Tuple
from jsonschema import validate, ValidationError

PASS1_SCHEMA = {
    "type": "object",
    "required": ["subject_variants", "preheader", "angle", "selected_program_items", "pain_to_benefit", "ctas"],
    "properties": {
        "subject_variants": {"type": "array", "items": {"type": "string"}, "minItems": 2, "maxItems": 4},
        "preheader": {"type": "string", "maxLength": 90},
        "angle": {"type": "string", "maxLength": 240},
        "selected_program_items": {
            "type": "array",
            "items": {
                "type": "object",
                "required": ["title", "speaker"],
                "properties": {
                    "title": {"type": "string"},
                    "speaker": {"type": "string"},
                    "time": {"type": "string"},
                    "track": {"type": "string"},
                    "tags": {"type": "array", "items": {"type": "string"}}
                }
            }
        },
        "pain_to_benefit": {
            "type": "array",
            "items": {
                "type": "object",
                "required": ["pain", "benefit"],
                "properties": {
                    "pain": {"type": "string"},
                    "benefit": {"type": "string"}
                }
            }
        },
        "ctas": {
            "type": "array",
            "items": {
                "type": "object",
                "required": ["id"],
                "properties": {
                    "id": {"type": "string"},
                    "text": {"type": "string"}
                }
            },
            "minItems": 1
        }
    }
}

def call_ai_model(
    messages: List[Dict[str, str]],
    model: str,
    api_key: str,
    api_url: str,
    temperature: float = 0.5,
    max_tokens: int = 2000
) -> str:
    '''
    Call OpenAI/OpenRouter API
    '''
    
    payload = {
        'model': model,
        'messages': messages,
        'temperature': temperature,
        'max_tokens': max_tokens
    }
    
    req = urllib.request.Request(
        api_url,
        data=json.dumps(payload).encode('utf-8'),
        headers={
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {api_key}'
        }
    )
    
    with urllib.request.urlopen(req, timeout=60) as response:
        result = json.loads(response.read().decode('utf-8'))
        return result['choices'][0]['message']['content']

def clean_json_response(content: str) -> str:
    '''
    Clean AI response to extract JSON
    '''
    content = content.strip()
    
    if content.startswith('```json'):
        content = content[7:]
    elif content.startswith('```'):
        content = content[3:]
    
    if content.endswith('```'):
        content = content[:-3]
    
    return content.strip()

def generate_pass1_plan(
    event_context: Dict[str, Any],
    rag_context: Dict[str, Any],
    allowed_ctas: List[Dict[str, str]],
    title: str,
    segment: str,
    language: str,
    tone: str,
    model: str,
    api_key: str,
    api_url: str
) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    '''
    Pass 1: Generate email plan (subject variants, angle, content selection)
    
    Returns:
        (pass1_json, error_message)
    '''
    
    program_items_text = '\n'.join([
        f"- {item['metadata'].get('title', '')} | {item['metadata'].get('speaker', '')} | {item['metadata'].get('time', '')} (score: {item['score']:.2f})"
        for item in rag_context.get('program_items', [])
    ])
    
    pain_points_text = '\n'.join([
        f"- {item['content'][:200]} (score: {item['score']:.2f})"
        for item in rag_context.get('pain_points', [])
    ])
    
    style_snippets_text = '\n'.join([
        f"{item['content'][:300]}"
        for item in rag_context.get('style_snippets', [])
    ])
    
    ctas_text = '\n'.join([
        f"- {cta.get('id')}: {cta.get('label', '')}"
        for cta in allowed_ctas
    ])
    
    user_prompt = f'''Ты — профессиональный email-маркетолог. Создай план письма для рассылки.

КОНТЕКСТ МЕРОПРИЯТИЯ:
Название: {event_context.get('name', '')}
Дата: {event_context.get('date', '')}
Место: {event_context.get('venue', '')}
Тон общения: {tone}
Локаль: {language}

ЗАДАНИЕ НА ПИСЬМО:
Тема/заголовок: {title}
Сегмент аудитории: {segment or 'общая аудитория'}

РЕЛЕВАНТНАЯ ПРОГРАММА (top-6 по семантике):
{program_items_text}

БОЛИ ЦЕЛЕВОЙ АУДИТОРИИ (top-4):
{pain_points_text}

ПРИМЕРЫ СТИЛЯ:
{style_snippets_text or 'Используй профессиональный email-маркетинг стиль'}

ДОСТУПНЫЕ CTA (призывы к действию):
{ctas_text}

ЗАДАЧА:
1. Придумай 2-4 варианта цепляющей темы письма (subject) — до 60 символов каждая
2. Создай preheader (до 90 символов) — дополняет subject
3. Определи angle (угол) письма — главную идею/месседж (до 240 символов)
4. Выбери 2-4 наиболее релевантных пункта программы из списка выше
5. Подбери 1-3 пары "боль → выгода" из аудитории
6. Выбери 1-2 CTA по id из списка доступных (обязательно используй только id из списка!)

ФОРМАТ ОТВЕТА (строго JSON по схеме):
{json.dumps(PASS1_SCHEMA, ensure_ascii=False, indent=2)}

Верни ТОЛЬКО валидный JSON, без комментариев и дополнительного текста.'''

    system_prompt = f'''Ты — профессиональный email-маркетолог. Пиши кратко, по делу, без дутого маркетинга.
Стиль общения: {tone}.
Всегда возвращай валидный JSON строго по предоставленной JSON-схеме.
Никогда не возвращай HTML.'''
    
    messages = [
        {'role': 'system', 'content': system_prompt},
        {'role': 'user', 'content': user_prompt}
    ]
    
    for attempt in range(2):
        try:
            print(f'[PASS1] Attempt {attempt + 1}/2')
            
            response = call_ai_model(
                messages=messages,
                model=model,
                api_key=api_key,
                api_url=api_url,
                temperature=0.5,
                max_tokens=1500
            )
            
            cleaned = clean_json_response(response)
            pass1_data = json.loads(cleaned)
            
            validate(instance=pass1_data, schema=PASS1_SCHEMA)
            
            print(f'[PASS1] Success: {len(pass1_data["subject_variants"])} subjects, {len(pass1_data["ctas"])} CTAs')
            return pass1_data, None
        
        except json.JSONDecodeError as e:
            print(f'[PASS1] JSON parse error: {e}')
            if attempt == 0:
                messages.append({'role': 'assistant', 'content': response})
                messages.append({'role': 'user', 'content': 'Исправь на валидный JSON без дополнительного текста.'})
        
        except ValidationError as e:
            print(f'[PASS1] Schema validation error: {e.message}')
            if attempt == 0:
                messages.append({'role': 'assistant', 'content': response})
                messages.append({'role': 'user', 'content': f'JSON не соответствует схеме. Ошибка: {e.message}. Исправь.'})
        
        except Exception as e:
            print(f'[PASS1] Unexpected error: {e}')
            return None, str(e)
    
    return None, 'Failed to generate valid Pass1 JSON after 2 attempts'

def generate_pass2_slots(
    pass1_data: Dict[str, Any],
    slots_schema: Dict[str, Any],
    event_context: Dict[str, Any],
    tone: str,
    language: str,
    model: str,
    api_key: str,
    api_url: str
) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    '''
    Pass 2: Generate slot texts based on Pass1 plan
    
    Returns:
        (pass2_json, error_message)
    '''
    
    selected_subject = pass1_data['subject_variants'][0]
    
    program_items_text = '\n'.join([
        f"- {item.get('title', '')} ({item.get('speaker', '')}) в {item.get('time', '')}"
        for item in pass1_data.get('selected_program_items', [])
    ])
    
    pain_benefit_text = '\n'.join([
        f"Боль: {pb.get('pain', '')}\nВыгода: {pb.get('benefit', '')}"
        for pb in pass1_data.get('pain_to_benefit', [])
    ])
    
    user_prompt = f'''Ты — профессиональный email-маркетолог. Напиши тексты для слотов письма.

КОНТЕКСТ:
Мероприятие: {event_context.get('name', '')}
Дата: {event_context.get('date', '')}
Тон: {tone}
Локаль: {language}

ПЛАН ПИСЬМА (Pass1):
Subject (выбран): {selected_subject}
Preheader: {pass1_data.get('preheader', '')}
Angle (главная идея): {pass1_data.get('angle', '')}

ВЫБРАННАЯ ПРОГРАММА:
{program_items_text}

БОЛИ → ВЫГОДЫ:
{pain_benefit_text}

ВЫБРАННЫЕ CTA:
{json.dumps(pass1_data.get('ctas', []), ensure_ascii=False)}

СХЕМА СЛОТОВ (лимиты длины):
{json.dumps(slots_schema, ensure_ascii=False, indent=2)}

ЗАДАЧА:
Напиши тексты для каждого обязательного слота из схемы.
- НЕ пиши HTML — только чистый текст
- Соблюдай лимиты по длине (maxLength)
- Используй выбранную программу и боли
- Для CTA используй id из Pass1

ФОРМАТ ОТВЕТА (строго JSON):
{{
  "slots": {{
    "hero_title": "...",
    "intro": "...",
    "benefits_bullets": ["...", "..."],
    "cta_primary": {{"id": "...", "text": "..."}},
    ...
  }}
}}

Верни ТОЛЬКО валидный JSON со слотами, без HTML и комментариев.'''

    system_prompt = f'''Ты — профессиональный email-маркетолог. Стиль: {tone}.
Пиши кратко, по делу.
Возвращай только валидный JSON строго по схеме слотов.
Никогда не возвращай HTML — только тексты.'''
    
    messages = [
        {'role': 'system', 'content': system_prompt},
        {'role': 'user', 'content': user_prompt}
    ]
    
    for attempt in range(2):
        try:
            print(f'[PASS2] Attempt {attempt + 1}/2')
            
            response = call_ai_model(
                messages=messages,
                model=model,
                api_key=api_key,
                api_url=api_url,
                temperature=0.6,
                max_tokens=2200
            )
            
            cleaned = clean_json_response(response)
            pass2_data = json.loads(cleaned)
            
            if 'slots' not in pass2_data:
                raise ValidationError('Missing "slots" key in response')
            
            required_slots = slots_schema.get('required', [])
            missing = [s for s in required_slots if s not in pass2_data['slots']]
            if missing:
                raise ValidationError(f'Missing required slots: {missing}')
            
            print(f'[PASS2] Success: {len(pass2_data["slots"])} slots filled')
            return pass2_data, None
        
        except json.JSONDecodeError as e:
            print(f'[PASS2] JSON parse error: {e}')
            if attempt == 0:
                messages.append({'role': 'assistant', 'content': response})
                messages.append({'role': 'user', 'content': 'Исправь на валидный JSON без дополнительного текста.'})
        
        except (ValidationError, KeyError) as e:
            print(f'[PASS2] Validation error: {e}')
            if attempt == 0:
                messages.append({'role': 'assistant', 'content': response})
                messages.append({'role': 'user', 'content': f'Ошибка: {e}. Исправь JSON.'})
        
        except Exception as e:
            print(f'[PASS2] Unexpected error: {e}')
            return None, str(e)
    
    return None, 'Failed to generate valid Pass2 JSON after 2 attempts'
