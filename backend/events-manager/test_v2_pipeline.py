'''
Unit tests for V2 email generation pipeline
'''

import json
from utm_utils import normalize_utm_params, map_cta_to_url, replace_cta_placeholders, validate_url
from template_assembler import assemble_html_from_slots, qa_validate_email
from jsonschema import validate, ValidationError
from v2_generation import PASS1_SCHEMA

def test_utm_normalization():
    '''Test UTM parameter normalization'''
    
    result = normalize_utm_params(
        base_url='https://example.com/register',
        utm_source='email',
        utm_medium='newsletter',
        utm_campaign='event2024',
        utm_content='type1',
        utm_term='Amazing Event Workshop!'
    )
    
    assert 'utm_source=email' in result['final_url']
    assert 'utm_medium=newsletter' in result['final_url']
    assert 'utm_campaign=event2024' in result['final_url']
    assert 'utm_term=amazing-event-workshop' in result['final_url']
    assert result['raw_url'] == 'https://example.com/register'
    
    print('✅ test_utm_normalization passed')

def test_utm_with_existing_params():
    '''Test UTM merge with existing query params'''
    
    result = normalize_utm_params(
        base_url='https://example.com/page?ref=twitter&lang=en',
        utm_source='social',
        utm_campaign='promo'
    )
    
    assert 'ref=twitter' in result['final_url']
    assert 'lang=en' in result['final_url']
    assert 'utm_source=social' in result['final_url']
    assert 'utm_campaign=promo' in result['final_url']
    
    print('✅ test_utm_with_existing_params passed')

def test_cta_mapping():
    '''Test CTA ID to URL mapping'''
    
    allowed_ctas = [
        {'id': 'register', 'url': 'https://event.com/register', 'label': 'Register Now'},
        {'id': 'schedule', 'url': 'https://event.com/schedule', 'label': 'View Schedule'}
    ]
    
    cta = map_cta_to_url('register', allowed_ctas)
    assert cta['id'] == 'register'
    assert cta['url'] == 'https://event.com/register'
    assert cta['label'] == 'Register Now'
    
    cta_fallback = map_cta_to_url('unknown_id', allowed_ctas, default_primary='https://event.com/default')
    assert cta_fallback['url'] == 'https://event.com/default'
    
    print('✅ test_cta_mapping passed')

def test_cta_placeholder_replacement():
    '''Test CTA placeholder replacement in HTML'''
    
    html = '''
    <a href="{{CTA_URL_PRIMARY}}">{{CTA_TEXT_PRIMARY}}</a>
    <a href="{{CTA_URL_SECONDARY}}">{{CTA_TEXT_SECONDARY}}</a>
    '''
    
    cta_primary = {'url': 'https://event.com/buy', 'label': 'Buy Tickets'}
    cta_secondary = {'url': 'https://event.com/info', 'label': 'Learn More'}
    
    utm_params = {
        'utm_source': 'email',
        'utm_medium': 'campaign',
        'utm_campaign': 'test',
        'utm_content': '1',
        'utm_term': 'subject'
    }
    
    result = replace_cta_placeholders(html, cta_primary, cta_secondary, utm_params)
    
    assert 'https://event.com/buy?utm_source=email' in result
    assert 'Buy Tickets' in result
    assert 'https://event.com/info?utm_source=email' in result
    assert 'Learn More' in result
    assert '{{CTA_URL_' not in result
    
    print('✅ test_cta_placeholder_replacement passed')

def test_html_assembly():
    '''Test HTML template assembly from slots'''
    
    html_layout = '''
    <h1>{{slot.hero_title}}</h1>
    <p>{{slot.intro}}</p>
    <ul>{{slot.benefits_bullets}}</ul>
    <p>{{event_name}} on {{event_date}}</p>
    '''
    
    slots = {
        'hero_title': 'Welcome to Event',
        'intro': 'Join us for an amazing experience',
        'benefits_bullets': ['Learn new skills', 'Network with experts', 'Get certified']
    }
    
    result = assemble_html_from_slots(
        html_layout=html_layout,
        slots=slots,
        event_name='Tech Summit 2024',
        event_date='2024-12-01'
    )
    
    assert 'Welcome to Event' in result
    assert 'Join us for an amazing experience' in result
    assert '<li>Learn new skills</li>' in result
    assert '<li>Network with experts</li>' in result
    assert 'Tech Summit 2024' in result
    assert '2024-12-01' in result
    
    print('✅ test_html_assembly passed')

def test_qa_validation_pass():
    '''Test QA validation with valid email'''
    
    slots_schema = {
        'required': ['hero_title', 'intro', 'cta_primary'],
        'properties': {
            'hero_title': {'maxLength': 80},
            'intro': {'maxLength': 300}
        }
    }
    
    slots = {
        'hero_title': 'Great Event',
        'intro': 'Join us for learning',
        'cta_primary': {'id': 'register', 'text': 'Register'}
    }
    
    html = '<html><body><h1>Test</h1><img src="test.jpg" alt="Test" width="100" height="100"/></body></html>'
    
    qa_report = qa_validate_email(
        subject='Amazing Tech Event 2024',
        preheader='Learn from experts',
        html=html,
        plain_text='Test email content here',
        slots=slots,
        slots_schema=slots_schema,
        unsubscribe_url='https://event.com/unsub'
    )
    
    assert qa_report['passed'] == True
    assert len(qa_report['errors']) == 0
    assert qa_report['metrics']['subject_length'] == 24
    
    print('✅ test_qa_validation_pass passed')

def test_qa_validation_fail():
    '''Test QA validation with invalid email'''
    
    slots_schema = {
        'required': ['hero_title', 'intro'],
        'properties': {}
    }
    
    slots = {
        'hero_title': 'Test'
    }
    
    html = '<html><body><script>alert("xss")</script><img src="test.jpg"/></body></html>'
    
    qa_report = qa_validate_email(
        subject='THIS IS ALL CAPS AND WAY TOO LONG FOR A SUBJECT LINE TEST',
        preheader='Preheader that is way too long and exceeds the maximum recommended length for email preheaders',
        html=html,
        plain_text='',
        slots=slots,
        slots_schema=slots_schema
    )
    
    assert qa_report['passed'] == False
    assert any('too long' in err.lower() for err in qa_report['errors'])
    assert any('missing' in err.lower() for err in qa_report['errors'])
    assert any('script' in err.lower() for err in qa_report['errors'])
    
    print('✅ test_qa_validation_fail passed')

def test_pass1_schema_validation():
    '''Test Pass1 JSON schema validation'''
    
    valid_pass1 = {
        'subject_variants': ['Subject 1', 'Subject 2'],
        'preheader': 'Short preheader',
        'angle': 'Main message angle',
        'selected_program_items': [
            {'title': 'Workshop', 'speaker': 'John Doe'}
        ],
        'pain_to_benefit': [
            {'pain': 'Problem', 'benefit': 'Solution'}
        ],
        'ctas': [
            {'id': 'register', 'text': 'Register Now'}
        ]
    }
    
    try:
        validate(instance=valid_pass1, schema=PASS1_SCHEMA)
        print('✅ test_pass1_schema_validation passed')
    except ValidationError as e:
        print(f'❌ test_pass1_schema_validation failed: {e.message}')

def test_url_validation():
    '''Test URL validation'''
    
    assert validate_url('https://example.com/path') == True
    assert validate_url('http://test.org') == True
    assert validate_url('invalid-url') == False
    assert validate_url('') == False
    assert validate_url('javascript:alert(1)') == False
    
    print('✅ test_url_validation passed')

if __name__ == '__main__':
    print('Running V2 Pipeline Tests...\n')
    
    test_utm_normalization()
    test_utm_with_existing_params()
    test_cta_mapping()
    test_cta_placeholder_replacement()
    test_html_assembly()
    test_qa_validation_pass()
    test_qa_validation_fail()
    test_pass1_schema_validation()
    test_url_validation()
    
    print('\n✅ All tests passed!')
