#!/usr/bin/env python3
"""Тест преобразования HTML в Mustache шаблон"""

import json

# Тестовый HTML с градиентами
test_html = """<!DOCTYPE html><html><head><style>.gradient{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);}</style></head><body><table width="600" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);"><tr><td style="padding:40px;text-align:center;"><h1 style="color:#fff;font-size:32px;">Революция в HR</h1><p style="color:#f3f4f6;font-size:18px;">Увеличьте скорость найма на 300%</p></td></tr></table><table width="600" style="margin-top:32px;"><tr><td style="padding:24px;border:2px solid #e5e7eb;border-radius:12px;"><h2 style="color:#1f2937;font-size:48px;">2,500+</h2><p style="color:#6b7280;">HR-менеджеров используют</p></td></tr></table><table width="600"><tr><td style="text-align:center;"><a href="https://example.com/demo" style="background:linear-gradient(90deg,#667eea,#764ba2);color:white;padding:16px 32px;border-radius:8px;text-decoration:none;font-weight:bold;">Начать бесплатно</a></td></tr></table></body></html>"""

print("="*80)
print("ТЕСТ: ПРЕОБРАЗОВАНИЕ HTML → MUSTACHE TEMPLATE")
print("="*80)

print(f"\n📥 ИСХОДНЫЙ HTML ({len(test_html)} символов):")
print("-"*80)
print(test_html[:300] + "...")
print("-"*80)

# Симулируем то что ДОЛЖНО быть в результате
expected_features = {
    "Градиенты должны остаться": ["linear-gradient(135deg,#667eea 0%,#764ba2 100%)", "linear-gradient(90deg,#667eea,#764ba2)"],
    "Inline стили должны остаться": ["style=\"padding:40px", "style=\"color:#fff", "style=\"border:2px solid #e5e7eb"],
    "<style> тег должен остаться": ["<style>", ".gradient{background:linear-gradient"],
    "Цвета должны остаться": ["#667eea", "#764ba2", "#e5e7eb", "#1f2937", "#6b7280"],
    "border-radius должен остаться": ["border-radius:12px", "border-radius:8px"],
    "padding должен остаться": ["padding:40px", "padding:24px", "padding:16px 32px"],
    
    "Текст должен заменен на {{vars}}": "Революция в HR",
    "Числа должны заменены": "2,500+",
    "URL должен заменён": "https://example.com/demo",
    "CTA текст должен заменён": "Начать бесплатно"
}

print("\n✅ ЧТО ДОЛЖНО СОХРАНИТЬСЯ:")
for feature, examples in expected_features.items():
    if isinstance(examples, list):
        print(f"  • {feature}")
        for ex in examples[:2]:
            print(f"    - {ex}")

print("\n❌ ЧТО ДОЛЖНО БЫТЬ ЗАМЕНЕНО:")
for feature, value in expected_features.items():
    if isinstance(value, str):
        print(f"  • {feature}: '{value}' → {{{{variable}}}}")

print("\n" + "="*80)
print("Сейчас протестируем реальный API...")
print("="*80)

# Запрос к API
import requests

url = "https://functions.poehali.dev/616d6890-24c3-49c8-8b29-692dd342933b"
payload = {
    "html_content": test_html,
    "event_id": 1,
    "content_type_id": 1,
    "name": "Test Template"
}

try:
    print("\n⏳ Отправляем запрос к функции...")
    response = requests.post(url, json=payload, timeout=120)
    
    print(f"📊 Статус: {response.status_code}")
    
    if response.status_code == 200:
        result = response.json()
        print(f"✅ Успешно! template_id={result.get('template_id')}, example_id={result.get('example_id')}")
        
        # Теперь получим шаблон из БД чтобы проверить
        print("\n⚠️ Для полной проверки нужно получить html_template из БД")
        print(f"   Запрос: SELECT html_template FROM email_templates WHERE id={result.get('template_id')}")
        
    else:
        print(f"❌ Ошибка {response.status_code}: {response.text}")
        
except Exception as e:
    print(f"❌ ОШИБКА: {e}")
    import traceback
    traceback.print_exc()
