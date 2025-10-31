'''
HTML template assembly from slots + QA validation
'''

import re
import html
from typing import Dict, Any, List, Optional
from bs4 import BeautifulSoup

def escape_html(text: str) -> str:
    '''
    Escape HTML special characters (except for allowed tags)
    '''
    return html.escape(text)

def assemble_html_from_slots(
    html_layout: str,
    slots: Dict[str, Any],
    logo_url: str = '',
    event_name: str = '',
    event_date: str = '',
    event_venue: str = '',
    preheader: str = '',
    unsubscribe_url: str = ''
) -> str:
    '''
    Assemble final HTML from template + slots data
    
    Args:
        html_layout: HTML template with {{slot.*}} placeholders
        slots: slot data from Pass2 JSON
        logo_url: event logo URL
        event_name: event name
        event_date: event date
        event_venue: event venue
        preheader: email preheader
        unsubscribe_url: unsubscribe link
    
    Returns:
        Assembled HTML
    '''
    
    result = html_layout
    
    result = result.replace('{{logo_url}}', logo_url or '')
    result = result.replace('{{event_name}}', escape_html(event_name))
    result = result.replace('{{event_date}}', escape_html(event_date))
    result = result.replace('{{event_venue}}', escape_html(event_venue))
    result = result.replace('{{preheader}}', escape_html(preheader))
    result = result.replace('{{unsubscribe_url}}', unsubscribe_url or '#')
    
    for key, value in slots.items():
        placeholder = f'{{{{slot.{key}}}}}'
        
        if isinstance(value, str):
            result = result.replace(placeholder, escape_html(value))
        
        elif isinstance(value, list):
            if '{{slot.' + key + '}}' in result:
                bullets_html = '\n'.join([f'<li>{escape_html(item)}</li>' for item in value if item])
                result = result.replace(placeholder, bullets_html)
        
        elif isinstance(value, dict):
            for sub_key, sub_value in value.items():
                sub_placeholder = f'{{{{slot.{key}.{sub_key}}}}}'
                if isinstance(sub_value, str):
                    result = result.replace(sub_placeholder, escape_html(sub_value))
    
    result = re.sub(r'\{\{slot\.\w+(\.\w+)?\}\}', '', result)
    
    return result

def generate_plain_text(html: str) -> str:
    '''
    Generate plain text version from HTML
    '''
    
    try:
        soup = BeautifulSoup(html, 'html.parser')
        
        for script in soup(['script', 'style']):
            script.decompose()
        
        text = soup.get_text(separator='\n')
        
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        
        return '\n\n'.join(lines)
    
    except Exception as e:
        print(f'[PLAIN_TEXT] Error: {e}')
        return ''

def qa_validate_email(
    subject: str,
    preheader: str,
    html: str,
    plain_text: str,
    slots: Dict[str, Any],
    slots_schema: Dict[str, Any],
    unsubscribe_url: str = ''
) -> Dict[str, Any]:
    '''
    QA validation checklist for generated email
    
    Returns:
        {
            'passed': bool,
            'errors': [str],
            'warnings': [str],
            'metrics': {
                'subject_length': int,
                'preheader_length': int,
                'html_size_kb': float,
                'emoji_count': int,
                'caps_percentage': float,
                'missing_slots': [str],
                'images_without_alt': int,
                'invalid_links': [str]
            }
        }
    '''
    
    errors = []
    warnings = []
    metrics = {}
    
    metrics['subject_length'] = len(subject)
    if metrics['subject_length'] > 60:
        errors.append(f'Subject too long: {metrics["subject_length"]} chars (max 60)')
    elif metrics['subject_length'] == 0:
        errors.append('Subject is empty')
    
    metrics['preheader_length'] = len(preheader)
    if metrics['preheader_length'] > 90:
        warnings.append(f'Preheader too long: {metrics["preheader_length"]} chars (max 90)')
    
    emoji_pattern = re.compile(r'[\U0001F600-\U0001F64F\U0001F300-\U0001F5FF\U0001F680-\U0001F6FF\U0001F700-\U0001F77F\U0001F780-\U0001F7FF\U0001F800-\U0001F8FF\U0001F900-\U0001F9FF\U0001FA00-\U0001FA6F\U0001FA70-\U0001FAFF\U00002702-\U000027B0\U000024C2-\U0001F251]+')
    metrics['emoji_count'] = len(emoji_pattern.findall(subject + preheader))
    if metrics['emoji_count'] > 1:
        warnings.append(f'Too many emojis: {metrics["emoji_count"]} (max 1)')
    
    caps_chars = sum(1 for c in subject if c.isupper())
    total_alpha = sum(1 for c in subject if c.isalpha())
    metrics['caps_percentage'] = (caps_chars / total_alpha * 100) if total_alpha > 0 else 0
    if metrics['caps_percentage'] > 30:
        warnings.append(f'Too many CAPS: {metrics["caps_percentage"]:.1f}% (max 30%)')
    
    metrics['html_size_kb'] = len(html.encode('utf-8')) / 1024
    if metrics['html_size_kb'] > 100:
        errors.append(f'HTML too large: {metrics["html_size_kb"]:.1f}KB (max 100KB)')
    
    required_slots = slots_schema.get('required', [])
    metrics['missing_slots'] = []
    for slot_name in required_slots:
        if slot_name not in slots or not slots[slot_name]:
            metrics['missing_slots'].append(slot_name)
            errors.append(f'Required slot missing: {slot_name}')
    
    try:
        soup = BeautifulSoup(html, 'html.parser')
        
        if soup.find('script') or soup.find('style'):
            errors.append('HTML contains <script> or <style> tags')
        
        if 'javascript:' in html.lower():
            errors.append('HTML contains javascript: protocol')
        
        images_without_alt = []
        for img in soup.find_all('img'):
            if not img.get('alt'):
                images_without_alt.append(img.get('src', 'unknown'))
        
        metrics['images_without_alt'] = len(images_without_alt)
        if images_without_alt:
            warnings.append(f'{len(images_without_alt)} images without alt attribute')
        
        invalid_links = []
        for a in soup.find_all('a'):
            href = a.get('href', '')
            if not href or href == '#' or href.startswith('{{'):
                invalid_links.append(href or 'empty')
        
        metrics['invalid_links'] = invalid_links
        if invalid_links and len(invalid_links) > 2:
            warnings.append(f'{len(invalid_links)} invalid/placeholder links')
        
    except Exception as e:
        errors.append(f'HTML parsing error: {str(e)}')
    
    if not unsubscribe_url or unsubscribe_url == '#':
        warnings.append('No unsubscribe URL provided')
    
    if not plain_text or len(plain_text) < 50:
        warnings.append('Plain text version is empty or too short')
    
    passed = len(errors) == 0
    
    return {
        'passed': passed,
        'errors': errors,
        'warnings': warnings,
        'metrics': metrics
    }
