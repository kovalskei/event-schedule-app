"""
Business: Deterministic Template Adapter with Knowledge Store integration
Args: event with httpMethod, body containing html/template/data/eventId
Returns: HTTP response with adapted template, render result with auto-filled knowledge
"""

import json
import re
import html as html_escape_module
import os
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass, asdict
from bs4 import BeautifulSoup, Tag, NavigableString
from urllib.parse import urlparse, parse_qs, parse_qsl, urlencode, urlunparse
import psycopg2
from psycopg2.extras import RealDictCursor

@dataclass
class Placeholder:
    name: str
    type: str
    description: str
    default: Optional[str] = None
    required: bool = True

@dataclass
class CTAButton:
    placeholder_url: str
    placeholder_text: str
    position: str
    original_url: str
    original_text: str

@dataclass
class ValidationIssue:
    severity: str
    category: str
    message: str
    details: Optional[Dict] = None

class KnowledgeStore:
    """Load knowledge from database and external sources"""
    
    @staticmethod
    def _get_db_connection():
        db_url = os.environ.get('DATABASE_URL', '')
        if not db_url:
            return None
        return psycopg2.connect(db_url, cursor_factory=RealDictCursor)
    
    @staticmethod
    def get_brand() -> Dict[str, Any]:
        return {
            'support': 'support@example.com',
            'phone': '+7 (999) 123-45-67',
            'company': 'Название компании',
            'address': 'Москва, Россия'
        }
    
    @staticmethod
    def get_defaults() -> Dict[str, Any]:
        return {
            'preheader': 'Не пропустите важное событие',
            'cta_top_text': 'Подробнее',
            'cta_bottom_text': 'Узнать больше',
            'utm': {
                'utm_source': 'newsletter',
                'utm_medium': 'email',
                'utm_campaign': 'event'
            }
        }
    
    @staticmethod
    def get_event(event_id: str) -> Dict[str, Any]:
        """Get event from database by ID"""
        conn = KnowledgeStore._get_db_connection()
        if not conn:
            return {
                'id': event_id,
                'name': f'Event {event_id}',
                'description': '',
                'start_date': '2025-12-01',
                'location': 'Online'
            }
        
        try:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT id, name, description, start_date, end_date, 
                           program_doc_id, pain_doc_id, default_tone, status
                    FROM events 
                    WHERE id = %s
                """, (event_id,))
                
                row = cur.fetchone()
                if row:
                    return dict(row)
                return {'id': event_id, 'name': f'Event {event_id}'}
        except Exception as e:
            print(f'Error fetching event: {e}')
            return {'id': event_id, 'name': f'Event {event_id}'}
        finally:
            conn.close()
    
    @staticmethod
    def get_event_mailing_list(event_id: str, list_id: str = None) -> Dict[str, Any]:
        """Get mailing list config with UTM and branding"""
        conn = KnowledgeStore._get_db_connection()
        if not conn:
            return {}
        
        try:
            with conn.cursor() as cur:
                if list_id:
                    cur.execute("""
                        SELECT eml.*, 
                               ur.utm_source, ur.utm_medium, ur.utm_campaign, ur.utm_term, ur.utm_content
                        FROM event_mailing_lists eml
                        LEFT JOIN utm_rules ur ON ur.mailing_list_id = eml.id
                        WHERE eml.event_id = %s AND eml.id = %s
                        LIMIT 1
                    """, (event_id, list_id))
                else:
                    cur.execute("""
                        SELECT eml.*, 
                               ur.utm_source, ur.utm_medium, ur.utm_campaign, ur.utm_term, ur.utm_content
                        FROM event_mailing_lists eml
                        LEFT JOIN utm_rules ur ON ur.mailing_list_id = eml.id
                        WHERE eml.event_id = %s
                        LIMIT 1
                    """, (event_id,))
                
                row = cur.fetchone()
                if row:
                    result = dict(row)
                    
                    result['utm'] = {
                        'utm_source': result.get('utm_source', 'newsletter'),
                        'utm_medium': result.get('utm_medium', 'email'),
                        'utm_campaign': result.get('utm_campaign', result.get('list_name', 'event')),
                        'utm_term': result.get('utm_term', ''),
                        'utm_content': result.get('utm_content', '')
                    }
                    
                    return result
                return {}
        except Exception as e:
            print(f'Error fetching mailing list: {e}')
            return {}
        finally:
            conn.close()
    
    @staticmethod
    def get_event_content(event_id: str) -> Dict[str, Any]:
        """Get event content from knowledge store"""
        conn = KnowledgeStore._get_db_connection()
        if not conn:
            return {
                'subjects': {'A': 'Приглашаем на мероприятие', 'B': 'Не пропустите событие года'},
                'claims': {'title': 'Главное событие года', 'description': 'Присоединяйтесь'},
                'speakers': []
            }
        
        try:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT doc_type, content, metadata
                    FROM knowledge_store
                    WHERE event_id = %s AND doc_type IN ('program', 'pain', 'speakers')
                    ORDER BY created_at DESC
                """, (event_id,))
                
                rows = cur.fetchall()
                
                content_data = {
                    'subjects': {'A': '', 'B': ''},
                    'claims': {},
                    'speakers': []
                }
                
                for row in rows:
                    doc_type = row['doc_type']
                    content = row['content']
                    metadata = row.get('metadata') or {}
                    
                    if doc_type == 'speakers' and content:
                        lines = content.strip().split('\n')
                        for line in lines[:10]:
                            parts = line.split('\t')
                            if len(parts) >= 3:
                                content_data['speakers'].append({
                                    'name': parts[0].strip(),
                                    'title': parts[1].strip(),
                                    'talk': parts[2].strip()
                                })
                    
                    if doc_type == 'program':
                        if 'title' in metadata:
                            content_data['claims']['title'] = metadata['title']
                        if 'description' in metadata:
                            content_data['claims']['description'] = metadata['description']
                
                cur.execute("""
                    SELECT id, name FROM events WHERE id = %s
                """, (event_id,))
                event_row = cur.fetchone()
                if event_row:
                    event_name = event_row['name']
                    content_data['subjects']['A'] = f'Приглашаем на {event_name}'
                    content_data['subjects']['B'] = f'Не пропустите: {event_name}'
                
                return content_data
        except Exception as e:
            print(f'Error fetching event content: {e}')
            return {
                'subjects': {'A': 'Приглашаем', 'B': 'Не пропустите'},
                'claims': {},
                'speakers': []
            }
        finally:
            conn.close()
    
    @staticmethod
    def list_events() -> List[Dict[str, Any]]:
        """List all active events"""
        conn = KnowledgeStore._get_db_connection()
        if not conn:
            return []
        
        try:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT id, name, description, start_date, status
                    FROM events
                    WHERE status = 'active'
                    ORDER BY start_date DESC
                    LIMIT 50
                """)
                
                rows = cur.fetchall()
                return [dict(row) for row in rows]
        except Exception as e:
            print(f'Error listing events: {e}')
            return []
        finally:
            conn.close()

class HTMLSanitizer:
    """Sanitize HTML for security - remove dangerous tags and attributes"""
    
    @staticmethod
    def sanitize(soup: BeautifulSoup) -> None:
        for tag in soup.find_all(['script']):
            tag.decompose()
        
        for tag in soup.find_all(True):
            attrs_to_remove = []
            for attr in list(tag.attrs):
                if attr.lower().startswith('on'):
                    attrs_to_remove.append(attr)
            for attr in attrs_to_remove:
                del tag[attr]

class PreheaderManager:
    """Manage preheader block"""
    
    @staticmethod
    def ensure_preheader(soup: BeautifulSoup) -> Placeholder:
        body = soup.body or soup
        
        existing = body.find(
            lambda t: isinstance(t, Tag) and 
            t.name in ('div', 'span') and 
            'preheader' in ' '.join(t.get('class', [])).lower()
        )
        
        if existing:
            existing.string = '{{preheader}}'
        else:
            block = soup.new_tag('div')
            block['style'] = 'display:none!important;max-height:0;overflow:hidden;opacity:0;color:transparent;font-size:1px;line-height:1px;'
            block.string = '{{preheader}}'
            
            if body.contents:
                body.insert(0, block)
            else:
                body.append(block)
        
        return Placeholder(
            name='preheader',
            type='text',
            description='Email preheader (preview text)',
            required=False
        )

class ContactDetector:
    """Detect and map brand contacts"""
    
    @staticmethod
    def map_contacts(soup: BeautifulSoup) -> List[Placeholder]:
        placeholders = []
        
        for a in soup.find_all('a', href=True):
            if a['href'].startswith('mailto:'):
                a['href'] = 'mailto:{{brand.support}}'
                if a.string:
                    a.string.replace_with('{{brand.support}}')
                placeholders.append(Placeholder(
                    name='brand.support',
                    type='text',
                    description='Support email',
                    required=False
                ))
                break
        
        phone_pattern = re.compile(r'[\+]?[\d\s\-\(\)]{10,}')
        for tag in soup.find_all(text=phone_pattern):
            if isinstance(tag, NavigableString):
                text = str(tag)
                match = phone_pattern.search(text)
                if match:
                    new_text = text.replace(match.group(0), '{{brand.phone}}', 1)
                    tag.replace_with(new_text)
                    placeholders.append(Placeholder(
                        name='brand.phone',
                        type='text',
                        description='Contact phone',
                        required=False
                    ))
                    break
        
        return placeholders

class TitleDetector:
    """Detect main title"""
    
    @staticmethod
    def detect_title(soup: BeautifulSoup) -> Optional[Placeholder]:
        for selector in ['h1', 'h2']:
            el = soup.find(selector)
            if el and el.get_text(strip=True):
                el.string = '{{title}}'
                return Placeholder(
                    name='title',
                    type='text',
                    description='Main title',
                    required=True
                )
        return None

class CTADetector:
    """Detect CTA buttons with heuristics"""
    
    @staticmethod
    def is_cta_like(a: Tag) -> bool:
        style = (a.get('style') or '').lower()
        cls = ' '.join(a.get('class', [])).lower()
        role = a.get('role', '')
        
        if 'btn' in cls or 'button' in cls or role == 'button':
            return True
        
        style_signs = ['background', 'border-radius', 'padding:']
        if any(s in style for s in style_signs):
            return True
        
        td = a.find_parent('td')
        if td:
            td_style = (td.get('style') or '').lower()
            td_align = td.get('align', '')
            if td_align == 'center' or 'text-align:center' in td_style:
                return True
        
        return False
    
    @staticmethod
    def detect_ctas(soup: BeautifulSoup) -> Tuple[List[CTAButton], List[Placeholder]]:
        ctas_found = []
        placeholders = []
        
        for a in soup.find_all('a', href=True):
            href = a.get('href', '')
            if href.startswith('#') or href.startswith('mailto:') or not href:
                continue
            
            if CTADetector.is_cta_like(a):
                ctas_found.append(a)
        
        if len(ctas_found) >= 1:
            a = ctas_found[0]
            original_text = a.get_text(strip=True)
            original_href = a.get('href', '')
            
            a['href'] = '{{cta_top_url}}'
            if a.string:
                a.string.replace_with('{{cta_top_text}}')
            
            placeholders.extend([
                Placeholder('cta_top_url', 'url', 'Top CTA URL', original_href, True),
                Placeholder('cta_top_text', 'text', 'Top CTA text', original_text, True)
            ])
        
        if len(ctas_found) >= 2:
            a = ctas_found[1]
            original_text = a.get_text(strip=True)
            original_href = a.get('href', '')
            
            a['href'] = '{{cta_bottom_url}}'
            if a.string:
                a.string.replace_with('{{cta_bottom_text}}')
            
            placeholders.extend([
                Placeholder('cta_bottom_url', 'url', 'Bottom CTA URL', original_href, True),
                Placeholder('cta_bottom_text', 'text', 'Bottom CTA text', original_text, True)
            ])
        
        cta_buttons = []
        if len(ctas_found) >= 1:
            cta_buttons.append(CTAButton(
                'cta_top_url', 'cta_top_text', 'top',
                ctas_found[0].get('href', ''), ctas_found[0].get_text(strip=True)
            ))
        if len(ctas_found) >= 2:
            cta_buttons.append(CTAButton(
                'cta_bottom_url', 'cta_bottom_text', 'bottom',
                ctas_found[1].get('href', ''), ctas_found[1].get_text(strip=True)
            ))
        
        return cta_buttons, placeholders

class BlockDetector:
    """Detect repeating blocks like speakers/agenda"""
    
    @staticmethod
    def detect_repeating_blocks(soup: BeautifulSoup) -> Tuple[List[str], List[Placeholder]]:
        blocks = []
        placeholders = []
        
        for container in soup.find_all(['table', 'tbody', 'div']):
            children = [c for c in container.children if isinstance(c, Tag)]
            if len(children) < 3:
                continue
            
            sig = lambda el: (el.name, tuple(sorted(ch.name for ch in el.find_all(recursive=False))))
            sigs = [sig(c) for c in children]
            
            freq = {}
            for s in sigs:
                freq[s] = freq.get(s, 0) + 1
            
            repeated_indices = [i for i, s in enumerate(sigs) if freq[s] >= 2]
            
            if len(repeated_indices) >= 2:
                start = repeated_indices[0]
                end = repeated_indices[-1]
                group = children[start:end+1]
                
                wrapper_start = soup.new_string('{{#each speakers}}')
                wrapper_end = soup.new_string('{{/each}}')
                
                group[0].insert_before(wrapper_start)
                group[-1].insert_after(wrapper_end)
                
                text_nodes = [t for t in group[0].descendants if isinstance(t, NavigableString) and str(t).strip()]
                
                if len(text_nodes) >= 1 and text_nodes[0]:
                    text_nodes[0].replace_with('{{name}}')
                if len(text_nodes) >= 2 and text_nodes[1]:
                    text_nodes[1].replace_with('{{title}}')
                if len(text_nodes) >= 3 and text_nodes[2]:
                    text_nodes[2].replace_with('{{talk}}')
                
                blocks.append('speakers')
                placeholders.extend([
                    Placeholder('speakers', 'collection', 'Speakers list', None, False),
                    Placeholder('speakers[].name', 'text', 'Speaker name', None, False),
                    Placeholder('speakers[].title', 'text', 'Speaker title', None, False),
                    Placeholder('speakers[].talk', 'text', 'Speaker talk', None, False)
                ])
                break
        
        return blocks, placeholders

class PlaceholderValidator:
    """Validate placeholder syntax"""
    
    @staticmethod
    def validate(adapted_html: str) -> List[ValidationIssue]:
        issues = []
        
        opens = adapted_html.count('{{')
        closes = adapted_html.count('}}')
        if opens != closes:
            issues.append(ValidationIssue(
                'error', 'syntax', f'Unbalanced placeholders: {opens} opens vs {closes} closes'
            ))
        
        if_open = len(re.findall(r'{{\s*#(if|each)\s+[\w.-_]+\s*}}', adapted_html))
        if_close = len(re.findall(r'{{\s*/(if|each)\s*}}', adapted_html))
        if if_open != if_close:
            issues.append(ValidationIssue(
                'error', 'syntax', f'Unbalanced blocks: {if_open} opens vs {if_close} closes'
            ))
        
        return issues

def dedupe_placeholders(items: List[Placeholder]) -> List[Placeholder]:
    seen = set()
    out = []
    for i in items:
        key = (i.name, i.type)
        if key not in seen:
            out.append(i)
            seen.add(key)
    return out

def adapt_template(html_content: str, options: Dict[str, Any] = None) -> Dict[str, Any]:
    """Main adaptation logic with deterministic heuristics"""
    options = options or {}
    
    soup = BeautifulSoup(html_content, 'lxml')
    
    HTMLSanitizer.sanitize(soup)
    
    placeholders = []
    
    preheader_ph = PreheaderManager.ensure_preheader(soup)
    placeholders.append(preheader_ph)
    
    contact_phs = ContactDetector.map_contacts(soup)
    placeholders.extend(contact_phs)
    
    title_ph = TitleDetector.detect_title(soup)
    if title_ph:
        placeholders.append(title_ph)
    
    cta_buttons, cta_phs = CTADetector.detect_ctas(soup)
    placeholders.extend(cta_phs)
    
    blocks, block_phs = BlockDetector.detect_repeating_blocks(soup)
    placeholders.extend(block_phs)
    
    adapted_html = str(soup)
    
    validation_issues = PlaceholderValidator.validate(adapted_html)
    
    placeholders = dedupe_placeholders(placeholders)
    
    stats = {
        'total_placeholders': len(placeholders),
        'cta_count': len(cta_buttons),
        'text_placeholders': len([p for p in placeholders if p.type == 'text']),
        'url_placeholders': len([p for p in placeholders if p.type == 'url']),
        'collection_placeholders': len([p for p in placeholders if p.type == 'collection']),
        'conditional_blocks': len(blocks)
    }
    
    return {
        'adapted_html': adapted_html,
        'placeholders': [asdict(p) for p in placeholders],
        'cta_buttons': [asdict(c) for c in cta_buttons],
        'validation_issues': [asdict(i) for i in validation_issues],
        'stats': stats
    }

def add_utm(base_url: str, extra: Dict[str, str]) -> str:
    """Add UTM parameters to URL"""
    parsed = urlparse(base_url)
    query_dict = dict(parse_qsl(parsed.query))
    query_dict.update({k: v for k, v in extra.items() if v})
    new_query = urlencode(query_dict)
    return urlunparse((
        parsed.scheme, parsed.netloc, parsed.path,
        parsed.params, new_query, parsed.fragment
    ))

def add_utm_if_missing(url: str, utm_base: Dict[str, str], utm_content: str) -> str:
    """Add UTM only if not already present"""
    if 'utm_source=' in url:
        return url
    extra = {**utm_base, 'utm_content': utm_content}
    return add_utm(url, extra)

def html_to_text(html_content: str) -> str:
    """Convert HTML to plain text with CTA markers"""
    soup = BeautifulSoup(html_content, 'lxml')
    
    for tag in soup(['style', 'script', 'head']):
        tag.decompose()
    
    for a in soup.find_all('a', href=True):
        text = a.get_text(strip=True)
        href = a.get('href', '')
        if text and href and not href.startswith('#'):
            marker = f'[ {text} ] {href}'
            a.replace_with(marker)
    
    text = soup.get_text('\n', strip=True)
    text = re.sub(r'\n{3,}', '\n\n', text)
    
    return text.strip()

def render_template(template: str, data: Dict[str, Any], defaults: Dict[str, Any]) -> Dict[str, Any]:
    """Render template with data and UTM injection"""
    
    def repl_if(match):
        var = match.group(1)
        body = match.group(2)
        val = data.get(var, False)
        return body if val else ''
    
    template = re.sub(r'{{\s*#if\s+([\w.-_]+)\s*}}([\s\S]*?){{\s*/if\s*}}', repl_if, template)
    
    def repl_each(match):
        var = match.group(1)
        body = match.group(2)
        items = data.get(var, [])
        if not isinstance(items, list):
            return ''
        result = []
        for item in items:
            item_html = body
            for key, value in item.items():
                item_html = item_html.replace(f'{{{{{key}}}}}', str(value))
            result.append(item_html)
        return ''.join(result)
    
    template = re.sub(r'{{\s*#each\s+([\w.-_]+)\s*}}([\s\S]*?){{\s*/each\s*}}', repl_each, template)
    
    for key, value in data.items():
        if isinstance(value, (str, int, float)):
            safe_value = html_escape_module.escape(str(value))
            template = template.replace(f'{{{{{key}}}}}', safe_value)
        elif key.startswith('brand.'):
            brand_data = data.get('brand', {})
            field = key.replace('brand.', '')
            if field in brand_data:
                safe_value = html_escape_module.escape(str(brand_data[field]))
                template = template.replace(f'{{{{{key}}}}}', safe_value)
    
    utm_base = defaults.get('utm', {})
    
    if '{{cta_top_url}}' in template and 'cta_top_url' in data:
        url = data['cta_top_url']
        if url:
            template = template.replace('{{cta_top_url}}', add_utm_if_missing(url, utm_base, 'cta_top'))
    
    if '{{cta_bottom_url}}' in template and 'cta_bottom_url' in data:
        url = data['cta_bottom_url']
        if url:
            template = template.replace('{{cta_bottom_url}}', add_utm_if_missing(url, utm_base, 'cta_bottom'))
    
    plain_text = html_to_text(template)
    
    return {
        'rendered_html': template,
        'plain_text': plain_text
    }

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Business: Template adapter with knowledge store integration
    Args: event with httpMethod and body
    Returns: HTTP response with adapted/rendered template
    """
    method = event.get('httpMethod', 'GET')
    
    cors_headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-User-Id, X-Auth-Token',
        'Access-Control-Max-Age': '86400',
        'Content-Type': 'application/json'
    }
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': cors_headers,
            'body': '',
            'isBase64Encoded': False
        }
    
    if method == 'POST':
        body_data = json.loads(event.get('body', '{}'))
        action = body_data.get('action', 'adapt')
        
        if action == 'adapt':
            html_content = body_data.get('html', '')
            options = body_data.get('options', {})
            
            if not html_content:
                return {
                    'statusCode': 400,
                    'headers': cors_headers,
                    'body': json.dumps({'error': 'html field is required'}),
                    'isBase64Encoded': False
                }
            
            result = adapt_template(html_content, options)
            
            return {
                'statusCode': 200,
                'headers': cors_headers,
                'body': json.dumps(result, ensure_ascii=False),
                'isBase64Encoded': False
            }
        
        elif action == 'render':
            template = body_data.get('template', '')
            user_data = body_data.get('data', {})
            event_id = body_data.get('eventId')
            
            if not template:
                return {
                    'statusCode': 400,
                    'headers': cors_headers,
                    'body': json.dumps({'error': 'template is required'}),
                    'isBase64Encoded': False
                }
            
            brand = KnowledgeStore.get_brand()
            defaults = KnowledgeStore.get_defaults()
            event_info = KnowledgeStore.get_event(event_id) if event_id else {}
            content = KnowledgeStore.get_event_content(event_id) if event_id else {}
            
            context_data = {
                **user_data,
                'brand': brand,
                'event': event_info,
                **content.get('claims', {})
            }
            
            context_data.setdefault('preheader', defaults.get('preheader', ''))
            context_data.setdefault('cta_top_text', defaults.get('cta_top_text', 'Подробнее'))
            context_data.setdefault('cta_bottom_text', defaults.get('cta_bottom_text', 'Узнать больше'))
            
            if 'speakers' in content:
                context_data['speakers'] = content['speakers']
            
            result = render_template(template, context_data, defaults)
            
            result['meta'] = {
                'subjectA': user_data.get('subjectA') or content.get('subjects', {}).get('A'),
                'subjectB': user_data.get('subjectB') or content.get('subjects', {}).get('B'),
                'preheader': context_data['preheader']
            }
            result['validation_issues'] = []
            result['utm_applied'] = True
            
            return {
                'statusCode': 200,
                'headers': cors_headers,
                'body': json.dumps(result, ensure_ascii=False),
                'isBase64Encoded': False
            }
        
        elif action == 'knowledge':
            event_id = body_data.get('eventId')
            list_id = body_data.get('listId')
            
            knowledge = {
                'brand': KnowledgeStore.get_brand(),
                'defaults': KnowledgeStore.get_defaults()
            }
            
            if event_id:
                knowledge['event'] = KnowledgeStore.get_event(event_id)
                knowledge['content'] = KnowledgeStore.get_event_content(event_id)
                
                mailing_list = KnowledgeStore.get_event_mailing_list(event_id, list_id)
                if mailing_list:
                    knowledge['mailing_list'] = mailing_list
                    if 'utm' in mailing_list:
                        knowledge['defaults']['utm'] = mailing_list['utm']
            
            return {
                'statusCode': 200,
                'headers': cors_headers,
                'body': json.dumps(knowledge, ensure_ascii=False),
                'isBase64Encoded': False
            }
        
        elif action == 'list_events':
            events = KnowledgeStore.list_events()
            
            return {
                'statusCode': 200,
                'headers': cors_headers,
                'body': json.dumps({'events': events}, ensure_ascii=False),
                'isBase64Encoded': False
            }
    
    return {
        'statusCode': 405,
        'headers': cors_headers,
        'body': json.dumps({'error': 'Method not allowed'}),
        'isBase64Encoded': False
    }