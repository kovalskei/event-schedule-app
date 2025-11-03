"""
Business: Deterministic Template Adapter with AI assistance
Args: event with httpMethod, body containing html/template/data
Returns: HTTP response with adapted template, render result, or validation
"""

import json
import re
import html
import hashlib
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass, asdict
from bs4 import BeautifulSoup, Tag, NavigableString
from urllib.parse import urlparse, parse_qs, urlencode, urlunparse

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

class HTMLSanitizer:
    """Sanitize HTML for security"""
    
    DANGEROUS_TAGS = ['script', 'iframe', 'object', 'embed', 'applet', 'meta']
    DANGEROUS_ATTRS = ['onload', 'onerror', 'onclick', 'onmouseover', 'onfocus', 'onblur']
    
    @staticmethod
    def sanitize(html_content: str) -> str:
        soup = BeautifulSoup(html_content, 'html.parser')
        
        for tag_name in HTMLSanitizer.DANGEROUS_TAGS:
            for tag in soup.find_all(tag_name):
                tag.decompose()
        
        for tag in soup.find_all():
            attrs_to_remove = []
            for attr in tag.attrs:
                if attr.lower().startswith('on') or attr.lower() in HTMLSanitizer.DANGEROUS_ATTRS:
                    attrs_to_remove.append(attr)
            for attr in attrs_to_remove:
                del tag[attr]
        
        return str(soup)

class PreheaderDetector:
    """Deterministic preheader detection"""
    
    @staticmethod
    def detect(soup: BeautifulSoup) -> Optional[Tag]:
        body = soup.find('body')
        if not body:
            return None
        
        first_elements = list(body.children)[:5]
        
        for elem in first_elements:
            if not isinstance(elem, Tag):
                continue
            
            text = elem.get_text(strip=True)
            if len(text) < 10 or len(text) > 200:
                continue
            
            style = elem.get('style', '')
            
            hidden_checks = [
                'display:none' in style or 'display: none' in style,
                'max-height:0' in style or 'max-height: 0' in style,
                'opacity:0' in style or 'opacity: 0' in style,
                'font-size:0' in style or 'font-size:1px' in style,
                'color:transparent' in style or 'color: transparent' in style
            ]
            
            if any(hidden_checks):
                return elem
        
        return None
    
    @staticmethod
    def inject(soup: BeautifulSoup) -> Tag:
        preheader_div = soup.new_tag('div')
        preheader_div['style'] = 'display:none!important;max-height:0;overflow:hidden;opacity:0;color:transparent;font-size:1px;line-height:1px;'
        preheader_div.string = '{{preheader}}'
        
        body = soup.find('body')
        if body and len(list(body.children)) > 0:
            body.insert(0, preheader_div)
        else:
            soup.append(preheader_div)
        
        return preheader_div

class CTADetector:
    """Deterministic CTA button detection"""
    
    @staticmethod
    def detect(soup: BeautifulSoup) -> List[Dict[str, Any]]:
        ctas = []
        seen = set()
        
        for link in soup.find_all('a', href=True):
            href = link.get('href', '')
            text = link.get_text(strip=True)
            
            if not href or href.startswith('#') or href.startswith('mailto:'):
                continue
            if len(text) < 2 or len(text) > 100:
                continue
            
            key = f"{text}|{href}"
            if key in seen:
                continue
            
            is_cta = CTADetector._is_button(link)
            
            if is_cta:
                seen.add(key)
                ctas.append({
                    'element': link,
                    'text': text,
                    'href': href,
                    'position': len(ctas) + 1
                })
        
        return ctas
    
    @staticmethod
    def _is_button(link: Tag) -> bool:
        style = link.get('style', '')
        classes = ' '.join(link.get('class', []))
        role = link.get('role', '')
        
        style_indicators = [
            'background' in style,
            'border-radius' in style,
            'padding:' in style and 'px' in style,
            'display:inline-block' in style or 'display: inline-block' in style
        ]
        
        class_indicators = re.search(r'\b(btn|button|cta|action|link-button)\b', classes, re.I)
        
        table_button = CTADetector._is_table_button(link)
        
        return any(style_indicators) or bool(class_indicators) or role == 'button' or table_button
    
    @staticmethod
    def _is_table_button(link: Tag) -> bool:
        parent = link.parent
        depth = 0
        
        while parent and depth < 3:
            if parent.name in ['td', 'th']:
                style = parent.get('style', '')
                if 'background' in style or 'border-radius' in style:
                    return True
            parent = parent.parent
            depth += 1
        
        return False

class DOMValidator:
    """Validate DOM structure before/after adaptation"""
    
    @staticmethod
    def get_structure(soup: BeautifulSoup) -> Dict[str, int]:
        return {
            'tables': len(soup.find_all('table')),
            'rows': len(soup.find_all('tr')),
            'cells': len(soup.find_all(['td', 'th'])),
            'images': len(soup.find_all('img')),
            'links': len(soup.find_all('a')),
            'divs': len(soup.find_all('div'))
        }
    
    @staticmethod
    def compare(before: Dict[str, int], after: Dict[str, int], tolerance: float = 0.1) -> List[str]:
        issues = []
        
        for key in before:
            if key not in after:
                continue
            
            before_val = before[key]
            after_val = after[key]
            
            if before_val == 0:
                continue
            
            diff = abs(after_val - before_val) / before_val
            
            if diff > tolerance:
                issues.append(f"{key}: changed from {before_val} to {after_val} ({diff*100:.1f}% diff)")
        
        return issues

class PlainTextGenerator:
    """Generate readable plain text from HTML"""
    
    @staticmethod
    def convert(html_content: str) -> str:
        soup = BeautifulSoup(html_content, 'html.parser')
        
        for tag in soup.find_all(['style', 'script', 'head']):
            tag.decompose()
        
        for tag in soup.find_all(['h1', 'h2', 'h3']):
            tag.insert_before('\n\n')
            tag.insert_after('\n\n')
        
        for tag in soup.find_all('li'):
            tag.string = f"• {tag.get_text(strip=True)}"
        
        for tag in soup.find_all('a', href=True):
            text = tag.get_text(strip=True)
            href = tag.get('href', '')
            if text and href and not href.startswith('#'):
                tag.string = f"{text} ({href})"
        
        for tag in soup.find_all('br'):
            tag.replace_with('\n')
        
        text = soup.get_text(separator='\n')
        
        lines = [line.strip() for line in text.split('\n')]
        lines = [line for line in lines if line]
        
        result = []
        empty_count = 0
        for line in lines:
            if not line:
                empty_count += 1
                if empty_count <= 2:
                    result.append(line)
            else:
                empty_count = 0
                result.append(line)
        
        return '\n'.join(result)

class UTMManager:
    """Manage UTM parameters for links"""
    
    @staticmethod
    def add_utm(url: str, utm_params: Dict[str, str], position: str = '') -> str:
        if not url or url.startswith('#') or url.startswith('mailto:'):
            return url
        
        parsed = urlparse(url)
        query_params = parse_qs(parsed.query)
        
        default_utm = {
            'utm_source': utm_params.get('utm_source', 'email'),
            'utm_medium': utm_params.get('utm_medium', 'email'),
            'utm_campaign': utm_params.get('utm_campaign', 'newsletter'),
        }
        
        if position:
            default_utm['utm_content'] = f"cta_{position}"
        
        for key, value in default_utm.items():
            if key not in query_params:
                query_params[key] = [value]
        
        new_query = urlencode(query_params, doseq=True)
        
        return urlunparse((
            parsed.scheme,
            parsed.netloc,
            parsed.path,
            parsed.params,
            new_query,
            parsed.fragment
        ))

class ContentValidator:
    """Validate email content"""
    
    SPAM_TRIGGERS = [
        r'100%\s+(free|бесплатно)',
        r'!!{3,}',
        r'[A-ZА-Я]{10,}',
        r'click here|нажми здесь',
        r'\$\$\$',
        r'viagra|cialis'
    ]
    
    @staticmethod
    def validate(data: Dict[str, Any]) -> List[ValidationIssue]:
        issues = []
        
        subject = data.get('subject', '')
        if subject and len(subject) > 60:
            issues.append(ValidationIssue(
                severity='warning',
                category='subject',
                message=f'Subject too long ({len(subject)} chars, recommended ≤60)'
            ))
        
        preheader = data.get('preheader', '')
        if preheader and len(preheader) > 110:
            issues.append(ValidationIssue(
                severity='warning',
                category='preheader',
                message=f'Preheader too long ({len(preheader)} chars, recommended ≤110)'
            ))
        
        for key, value in data.items():
            if not isinstance(value, str):
                continue
            
            for pattern in ContentValidator.SPAM_TRIGGERS:
                if re.search(pattern, value, re.I):
                    issues.append(ValidationIssue(
                        severity='error',
                        category='spam',
                        message=f'Spam trigger detected in {key}',
                        details={'pattern': pattern, 'field': key}
                    ))
        
        return issues

class TemplateAdapter:
    """Main adapter with deterministic logic"""
    
    def __init__(self, html_content: str, options: Dict[str, Any] = None):
        self.options = options or {}
        self.original_html = html_content
        self.sanitized_html = HTMLSanitizer.sanitize(html_content)
        self.soup = BeautifulSoup(self.sanitized_html, 'html.parser')
        self.placeholders: List[Placeholder] = []
        self.cta_buttons: List[CTAButton] = []
        self.validation_issues: List[ValidationIssue] = []
    
    def adapt(self) -> Dict[str, Any]:
        original_structure = DOMValidator.get_structure(self.soup)
        
        self._handle_preheader()
        self._handle_title()
        self._handle_ctas()
        self._handle_images()
        self._handle_footer()
        
        adapted_html = str(self.soup)
        
        adapted_structure = DOMValidator.get_structure(
            BeautifulSoup(adapted_html, 'html.parser')
        )
        
        structure_issues = DOMValidator.compare(original_structure, adapted_structure)
        
        if structure_issues:
            for issue in structure_issues:
                self.validation_issues.append(ValidationIssue(
                    severity='warning',
                    category='structure',
                    message=f'DOM structure changed: {issue}'
                ))
        
        return {
            'adapted_html': adapted_html,
            'placeholders': [asdict(p) for p in self.placeholders],
            'cta_buttons': [asdict(c) for c in self.cta_buttons],
            'validation_issues': [asdict(i) for i in self.validation_issues],
            'stats': {
                'total_placeholders': len(self.placeholders),
                'cta_count': len(self.cta_buttons),
                'text_placeholders': len([p for p in self.placeholders if p.type == 'text']),
                'url_placeholders': len([p for p in self.placeholders if p.type == 'url']),
                'image_placeholders': len([p for p in self.placeholders if p.type == 'image'])
            }
        }
    
    def _handle_preheader(self):
        preheader_elem = PreheaderDetector.detect(self.soup)
        
        if preheader_elem:
            preheader_elem.string = '{{preheader}}'
            self.placeholders.append(Placeholder(
                name='preheader',
                type='text',
                description='Email preheader (preview text)',
                default='',
                required=False
            ))
        elif self.options.get('inject_preheader', True):
            PreheaderDetector.inject(self.soup)
            self.placeholders.append(Placeholder(
                name='preheader',
                type='text',
                description='Email preheader (auto-injected)',
                default='',
                required=False
            ))
    
    def _handle_title(self):
        title_selectors = ['h1', 'h2[class*="title"]', 'h2[class*="heading"]']
        
        for selector in title_selectors:
            title_elem = self.soup.select_one(selector)
            if title_elem and title_elem.get_text(strip=True):
                title_elem.string = '{{title}}'
                self.placeholders.append(Placeholder(
                    name='title',
                    type='text',
                    description=f'Main title ({title_elem.name})',
                    required=True
                ))
                break
    
    def _handle_ctas(self):
        ctas = CTADetector.detect(self.soup)
        
        strategy = self.options.get('cta_strategy', 'auto')
        
        if strategy == 'top_bottom' and len(ctas) >= 2:
            selected = [ctas[0], ctas[-1]]
            positions = ['top', 'bottom']
        elif strategy == 'all':
            selected = ctas
            positions = [str(i+1) for i in range(len(ctas))]
        else:
            selected = ctas[:3]
            positions = [str(i+1) for i in range(len(selected))]
        
        for cta, pos in zip(selected, positions):
            url_placeholder = f'cta_{pos}_url'
            text_placeholder = f'cta_{pos}_text'
            
            cta['element'].string = f"{{{{{text_placeholder}}}}}"
            cta['element']['href'] = f"{{{{{url_placeholder}}}}}"
            
            self.placeholders.append(Placeholder(
                name=text_placeholder,
                type='text',
                description=f'CTA button text (position: {pos})',
                default=cta['text']
            ))
            
            self.placeholders.append(Placeholder(
                name=url_placeholder,
                type='url',
                description=f'CTA button URL (position: {pos})',
                default=cta['href']
            ))
            
            self.cta_buttons.append(CTAButton(
                placeholder_url=url_placeholder,
                placeholder_text=text_placeholder,
                position=pos,
                original_url=cta['href'],
                original_text=cta['text']
            ))
    
    def _handle_images(self):
        for i, img in enumerate(self.soup.find_all('img', src=True), 1):
            alt = img.get('alt', '')
            if not alt or len(alt) < 3:
                self.validation_issues.append(ValidationIssue(
                    severity='warning',
                    category='accessibility',
                    message=f'Image {i} missing alt text'
                ))
            
            if 'logo' in str(img.get('class', [])).lower() or 'logo' in img.get('alt', '').lower():
                img['src'] = '{{logo_url}}'
                if 'logo_url' not in [p.name for p in self.placeholders]:
                    self.placeholders.append(Placeholder(
                        name='logo_url',
                        type='image',
                        description='Company logo URL',
                        required=True
                    ))
    
    def _handle_footer(self):
        footer_keywords = ['unsubscribe', 'отписаться', 'privacy', 'конфиденциальность']
        
        for elem in self.soup.find_all(['footer', 'div', 'table']):
            text = elem.get_text(strip=True).lower()
            if any(kw in text for kw in footer_keywords):
                elem['data-block'] = 'footer'
                break

class TemplateRenderer:
    """Render template with data and UTM"""
    
    def __init__(self, template: str, data: Dict[str, Any], utm_params: Dict[str, str] = None):
        self.template = template
        self.data = data
        self.utm_params = utm_params or {}
    
    def render(self) -> Dict[str, Any]:
        validation_issues = ContentValidator.validate(self.data)
        
        rendered = self.template
        
        for key, value in self.data.items():
            if key.startswith('show_'):
                continue
            
            if key.endswith('_url') and isinstance(value, str):
                position = key.replace('cta_', '').replace('_url', '')
                value = UTMManager.add_utm(value, self.utm_params, position)
            
            safe_value = html.escape(str(value)) if isinstance(value, str) else str(value)
            rendered = rendered.replace(f"{{{{{key}}}}}", safe_value)
        
        plain_text = PlainTextGenerator.convert(rendered)
        
        return {
            'rendered_html': rendered,
            'plain_text': plain_text,
            'validation_issues': [asdict(i) for i in validation_issues],
            'utm_applied': bool(self.utm_params)
        }

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Business: Template adapter with deterministic logic and AI assistance
    Args: event with httpMethod and body
    Returns: HTTP response
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
        path = event.get('path', '')
        
        if path.endswith('/adapt') or body_data.get('action') == 'adapt':
            html_content = body_data.get('html', '')
            options = body_data.get('options', {})
            
            if not html_content:
                return {
                    'statusCode': 400,
                    'headers': cors_headers,
                    'body': json.dumps({'error': 'html field is required'}),
                    'isBase64Encoded': False
                }
            
            adapter = TemplateAdapter(html_content, options)
            result = adapter.adapt()
            
            return {
                'statusCode': 200,
                'headers': cors_headers,
                'body': json.dumps(result, ensure_ascii=False),
                'isBase64Encoded': False
            }
        
        elif path.endswith('/render') or body_data.get('action') == 'render':
            template = body_data.get('template', '')
            data = body_data.get('data', {})
            utm_params = body_data.get('utm_params', {})
            
            if not template or not data:
                return {
                    'statusCode': 400,
                    'headers': cors_headers,
                    'body': json.dumps({'error': 'template and data are required'}),
                    'isBase64Encoded': False
                }
            
            renderer = TemplateRenderer(template, data, utm_params)
            result = renderer.render()
            
            return {
                'statusCode': 200,
                'headers': cors_headers,
                'body': json.dumps(result, ensure_ascii=False),
                'isBase64Encoded': False
            }
        
        elif path.endswith('/validate') or body_data.get('action') == 'validate':
            data = body_data.get('data', {})
            issues = ContentValidator.validate(data)
            
            return {
                'statusCode': 200,
                'headers': cors_headers,
                'body': json.dumps({
                    'valid': len([i for i in issues if i.severity == 'error']) == 0,
                    'issues': [asdict(i) for i in issues]
                }, ensure_ascii=False),
                'isBase64Encoded': False
            }
    
    return {
        'statusCode': 405,
        'headers': cors_headers,
        'body': json.dumps({'error': 'Method not allowed'}),
        'isBase64Encoded': False
    }
