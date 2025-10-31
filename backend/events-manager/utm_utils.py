'''
UTM parameter normalization and CTA URL mapping
'''

import json
import re
from urllib.parse import urlparse, parse_qs, urlencode, urlunparse
from typing import Dict, Any, List, Optional

def normalize_utm_params(
    base_url: str,
    utm_source: str = '',
    utm_medium: str = '',
    utm_campaign: str = '',
    utm_content: str = '',
    utm_term: str = ''
) -> Dict[str, Any]:
    '''
    Normalize and merge UTM parameters into URL
    
    Args:
        base_url: base URL
        utm_*: UTM parameters
    
    Returns:
        {'raw_url': original, 'final_url': with UTMs, 'utm_params': dict}
    '''
    
    if not base_url:
        return {'raw_url': '', 'final_url': '', 'utm_params': {}}
    
    parsed = urlparse(base_url)
    query_params = parse_qs(parsed.query, keep_blank_values=True)
    
    utm_params = {}
    
    if utm_source:
        utm_params['utm_source'] = utm_source
    if utm_medium:
        utm_params['utm_medium'] = utm_medium
    if utm_campaign:
        utm_params['utm_campaign'] = utm_campaign
    if utm_content:
        utm_params['utm_content'] = utm_content
    if utm_term:
        utm_term_slug = re.sub(r'[^\w\s-]', '', utm_term)
        utm_term_slug = re.sub(r'[\s_]+', '-', utm_term_slug).strip('-').lower()[:50]
        utm_params['utm_term'] = utm_term_slug
    
    for key, value in utm_params.items():
        query_params[key] = [value]
    
    new_query = urlencode(query_params, doseq=True)
    
    final_url = urlunparse((
        parsed.scheme,
        parsed.netloc,
        parsed.path,
        parsed.params,
        new_query,
        parsed.fragment
    ))
    
    return {
        'raw_url': base_url,
        'final_url': final_url,
        'utm_params': utm_params
    }

def map_cta_to_url(
    cta_id: str,
    allowed_ctas: List[Dict[str, str]],
    default_primary: Optional[str] = None,
    default_secondary: Optional[str] = None,
    is_primary: bool = True
) -> Optional[Dict[str, str]]:
    '''
    Map CTA ID to URL from allowed_ctas list
    
    Args:
        cta_id: CTA identifier from AI response
        allowed_ctas: list of {id, url, label}
        default_primary: fallback URL for primary CTA
        default_secondary: fallback URL for secondary CTA
        is_primary: whether this is primary CTA
    
    Returns:
        {'id': str, 'url': str, 'label': str} or None
    '''
    
    for cta in allowed_ctas:
        if cta.get('id') == cta_id:
            return {
                'id': cta['id'],
                'url': cta.get('url', ''),
                'label': cta.get('label', cta['id'])
            }
    
    print(f'[CTA] ID "{cta_id}" not found in allowed_ctas, using default')
    
    if is_primary and default_primary:
        return {'id': 'default_primary', 'url': default_primary, 'label': 'Зарегистрироваться'}
    elif not is_primary and default_secondary:
        return {'id': 'default_secondary', 'url': default_secondary, 'label': 'Узнать больше'}
    
    return None

def replace_cta_placeholders(
    html: str,
    cta_primary: Optional[Dict[str, str]],
    cta_secondary: Optional[Dict[str, str]],
    utm_params: Dict[str, str]
) -> str:
    '''
    Replace {{CTA_URL_*}} placeholders with actual URLs + UTM
    
    Args:
        html: HTML template with placeholders
        cta_primary: primary CTA dict
        cta_secondary: secondary CTA dict
        utm_params: UTM parameters
    
    Returns:
        HTML with replaced URLs
    '''
    
    result = html
    
    if cta_primary:
        utm_data = normalize_utm_params(
            cta_primary['url'],
            **utm_params
        )
        result = result.replace('{{CTA_URL_PRIMARY}}', utm_data['final_url'])
        result = result.replace('{{CTA_URL_0}}', utm_data['final_url'])
        result = result.replace('{{CTA_TEXT_PRIMARY}}', cta_primary.get('label', ''))
    
    if cta_secondary:
        utm_data = normalize_utm_params(
            cta_secondary['url'],
            **utm_params
        )
        result = result.replace('{{CTA_URL_SECONDARY}}', utm_data['final_url'])
        result = result.replace('{{CTA_URL_1}}', utm_data['final_url'])
        result = result.replace('{{CTA_TEXT_SECONDARY}}', cta_secondary.get('label', ''))
    
    result = re.sub(r'\{\{CTA_URL_\d+\}\}', '#', result)
    result = re.sub(r'\{\{CTA_TEXT_\w+\}\}', '', result)
    
    return result

def validate_url(url: str) -> bool:
    '''
    Basic URL validation
    '''
    if not url:
        return False
    
    parsed = urlparse(url)
    return bool(parsed.scheme and parsed.netloc)
