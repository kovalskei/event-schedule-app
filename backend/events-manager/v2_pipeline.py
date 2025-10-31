'''
V2 Pipeline Orchestrator: Full workflow from content_plan to final HTML
'''

import json
import os
from typing import Dict, Any, List, Optional
import psycopg2
import psycopg2.extras

from rag_module import search_knowledge
from v2_generation import generate_pass1_plan, generate_pass2_slots
from utm_utils import normalize_utm_params, map_cta_to_url, replace_cta_placeholders
from template_assembler import assemble_html_from_slots, generate_plain_text, qa_validate_email

def resolve_ai_model(
    content_plan_row: Optional[Dict[str, Any]],
    mailing_list_row: Optional[Dict[str, Any]],
    event_row: Dict[str, Any]
) -> str:
    '''
    Resolve AI model with hierarchy: content_plan > mailing_list > event > default
    '''
    
    if content_plan_row and content_plan_row.get('ai_model_override'):
        return content_plan_row['ai_model_override']
    
    if mailing_list_row and mailing_list_row.get('ai_model_override'):
        return mailing_list_row['ai_model_override']
    
    return event_row.get('default_ai_model') or event_row.get('ai_model') or 'gpt-4o-mini'

def resolve_tone(
    content_plan_row: Optional[Dict[str, Any]],
    event_row: Dict[str, Any]
) -> str:
    '''
    Resolve tone with hierarchy: content_plan > event > default
    '''
    
    if content_plan_row and content_plan_row.get('tone_override'):
        return content_plan_row['tone_override']
    
    return event_row.get('default_tone') or 'professional'

def get_api_credentials() -> tuple:
    '''
    Get OpenRouter or OpenAI API credentials
    '''
    
    openrouter_key = os.environ.get('OPENROUTER_API_KEY')
    openai_key = os.environ.get('OPENAI_API_KEY')
    
    if openrouter_key:
        return openrouter_key, 'https://openrouter.ai/api/v1/chat/completions', 'openrouter'
    elif openai_key:
        return openai_key, 'https://api.openai.com/v1/chat/completions', 'openai'
    else:
        raise ValueError('No API key configured (OPENROUTER_API_KEY or OPENAI_API_KEY)')

def generate_email_v2(
    conn,
    content_plan_id: int,
    variant_index: int = 0
) -> Dict[str, Any]:
    '''
    V2 Pipeline: Generate email from content_plan using two-pass generation
    
    Args:
        conn: psycopg2 connection
        content_plan_id: content_plan table ID
        variant_index: A/B variant index (0 for first subject)
    
    Returns:
        {
            'success': bool,
            'email_id': int or None,
            'subject': str,
            'html': str,
            'plain_text': str,
            'pass1_json': dict,
            'pass2_json': dict,
            'qa_report': dict,
            'error': str or None
        }
    '''
    
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    
    cur.execute('''
        SELECT cp.*, e.*, eml.utm_source, eml.utm_medium, eml.utm_campaign,
               eml.ai_model_override as list_ai_model, eml.unsubscribe_url,
               eml.from_name, eml.from_email, eml.reply_to
        FROM t_p22819116_event_schedule_app.content_plan cp
        JOIN t_p22819116_event_schedule_app.events e ON e.id = cp.event_id
        LEFT JOIN t_p22819116_event_schedule_app.event_mailing_lists eml ON eml.id = cp.list_id
        WHERE cp.id = %s
    ''', (content_plan_id,))
    
    row = cur.fetchone()
    
    if not row:
        return {'success': False, 'error': f'Content plan {content_plan_id} not found'}
    
    event_id = row['event_id']
    list_id = row.get('list_id')
    content_type_id = row.get('content_type_id')
    
    title = row.get('title', '')
    segment = row.get('segment', '')
    language = row.get('language', 'ru-RU')
    
    ai_model = resolve_ai_model(row, row if list_id else None, row)
    tone = resolve_tone(row, row)
    
    api_key, api_url, provider = get_api_credentials()
    
    print(f'[V2] Starting generation for content_plan={content_plan_id}, model={ai_model}, tone={tone}')
    
    rag_context = {
        'program_items': search_knowledge(conn, event_id, title, 'program_item', top_k=6, api_key=api_key),
        'pain_points': search_knowledge(conn, event_id, title + ' ' + segment, 'pain_point', top_k=4, api_key=api_key),
        'style_snippets': search_knowledge(conn, event_id, tone, 'style_snippet', top_k=2, api_key=api_key)
    }
    
    print(f'[V2] RAG retrieved: {len(rag_context["program_items"])} programs, {len(rag_context["pain_points"])} pains, {len(rag_context["style_snippets"])} styles')
    
    cur.execute('''
        SELECT allowed_ctas, default_cta_primary, default_cta_secondary
        FROM t_p22819116_event_schedule_app.content_types
        WHERE id = %s
    ''', (content_type_id,))
    
    ct_row = cur.fetchone()
    allowed_ctas = ct_row.get('allowed_ctas') if ct_row else []
    if not allowed_ctas:
        allowed_ctas = []
    
    event_context = {
        'name': row.get('name', ''),
        'date': str(row.get('start_date', '')) if row.get('start_date') else '',
        'venue': ''
    }
    
    pass1_data, pass1_error = generate_pass1_plan(
        event_context=event_context,
        rag_context=rag_context,
        allowed_ctas=allowed_ctas,
        title=title,
        segment=segment,
        language=language,
        tone=tone,
        model=ai_model,
        api_key=api_key,
        api_url=api_url
    )
    
    if pass1_error:
        return {'success': False, 'error': f'Pass1 failed: {pass1_error}'}
    
    cur.execute('''
        SELECT html_layout, slots_schema
        FROM t_p22819116_event_schedule_app.email_templates
        WHERE event_id = %s AND content_type_id = %s
        LIMIT 1
    ''', (event_id, content_type_id))
    
    template_row = cur.fetchone()
    
    if not template_row:
        return {'success': False, 'error': f'No template found for event={event_id}, content_type={content_type_id}'}
    
    html_layout = template_row.get('html_layout', '')
    slots_schema = template_row.get('slots_schema', {})
    
    pass2_data, pass2_error = generate_pass2_slots(
        pass1_data=pass1_data,
        slots_schema=slots_schema,
        event_context=event_context,
        tone=tone,
        language=language,
        model=ai_model,
        api_key=api_key,
        api_url=api_url
    )
    
    if pass2_error:
        return {'success': False, 'error': f'Pass2 failed: {pass2_error}'}
    
    subject_variants = pass1_data.get('subject_variants', [])
    selected_subject = subject_variants[min(variant_index, len(subject_variants) - 1)] if subject_variants else ''
    preheader = pass1_data.get('preheader', '')
    
    slots = pass2_data.get('slots', {})
    
    cta_primary_data = slots.get('cta_primary')
    cta_secondary_data = slots.get('cta_secondary')
    
    cta_primary = map_cta_to_url(
        cta_id=cta_primary_data.get('id') if cta_primary_data else '',
        allowed_ctas=allowed_ctas,
        default_primary=ct_row.get('default_cta_primary') if ct_row else None,
        is_primary=True
    ) if cta_primary_data else None
    
    cta_secondary = map_cta_to_url(
        cta_id=cta_secondary_data.get('id') if cta_secondary_data else '',
        allowed_ctas=allowed_ctas,
        default_secondary=ct_row.get('default_cta_secondary') if ct_row else None,
        is_primary=False
    ) if cta_secondary_data else None
    
    if cta_primary and cta_primary_data.get('text'):
        cta_primary['label'] = cta_primary_data['text']
    if cta_secondary and cta_secondary_data.get('text'):
        cta_secondary['label'] = cta_secondary_data['text']
    
    logo_url = row.get('logo_url', '')
    unsubscribe_url = row.get('unsubscribe_url', '')
    
    html = assemble_html_from_slots(
        html_layout=html_layout,
        slots=slots,
        logo_url=logo_url,
        event_name=event_context['name'],
        event_date=event_context['date'],
        event_venue=event_context.get('venue', ''),
        preheader=preheader,
        unsubscribe_url=unsubscribe_url
    )
    
    utm_params = {
        'utm_source': row.get('utm_source', ''),
        'utm_medium': row.get('utm_medium', ''),
        'utm_campaign': row.get('utm_campaign', ''),
        'utm_content': str(content_type_id),
        'utm_term': selected_subject
    }
    
    html = replace_cta_placeholders(html, cta_primary, cta_secondary, utm_params)
    
    plain_text = generate_plain_text(html)
    
    qa_report = qa_validate_email(
        subject=selected_subject,
        preheader=preheader,
        html=html,
        plain_text=plain_text,
        slots=slots,
        slots_schema=slots_schema,
        unsubscribe_url=unsubscribe_url
    )
    
    print(f'[V2] QA: passed={qa_report["passed"]}, errors={len(qa_report["errors"])}, warnings={len(qa_report["warnings"])}')
    
    rag_source_ids = {
        'program_items': [item['id'] for item in rag_context['program_items']],
        'pain_points': [item['id'] for item in rag_context['pain_points']],
        'style_snippets': [item['id'] for item in rag_context['style_snippets']]
    }
    
    cur.execute('''
        INSERT INTO t_p22819116_event_schedule_app.generated_emails
        (event_list_id, content_type_id, subject, html_content, plain_text,
         pipeline_version, pass1_json, pass2_json, rag_sources, qa_metrics,
         input_params, status, created_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
        RETURNING id
    ''', (
        list_id,
        content_type_id,
        selected_subject,
        html,
        plain_text,
        'v2',
        json.dumps(pass1_data),
        json.dumps(pass2_data),
        json.dumps(rag_source_ids),
        json.dumps(qa_report['metrics']),
        json.dumps({
            'title': title,
            'segment': segment,
            'language': language,
            'tone': tone,
            'model': ai_model,
            'variant_index': variant_index
        }),
        'generated' if qa_report['passed'] else 'requires_review'
    ))
    
    email_id = cur.fetchone()['id']
    conn.commit()
    
    print(f'[V2] Email saved: id={email_id}, status={"generated" if qa_report["passed"] else "requires_review"}')
    
    return {
        'success': True,
        'email_id': email_id,
        'subject': selected_subject,
        'preheader': preheader,
        'html': html,
        'plain_text': plain_text,
        'pass1_json': pass1_data,
        'pass2_json': pass2_data,
        'qa_report': qa_report,
        'error': None
    }
