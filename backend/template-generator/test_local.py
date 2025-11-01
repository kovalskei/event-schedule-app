#!/usr/bin/env python3
"""
Локальный тест функции преобразования HTML в Mustache
Проверяем что стили сохраняются, а контент заменяется на переменные
"""

import os
import sys
import json
import re

# Тестовый HTML с градиентами, таблицами, inline-стилями
TEST_HTML = """
<!DOCTYPE html>
<html>
<head>
<style>
.gradient-header {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    padding: 40px;
}
.stats-card {
    border: 2px solid #e5e7eb;
    border-radius: 12px;
    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
}
</style>
</head>
<body>
<table width="600" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
  <tr>
    <td style="padding: 40px; text-align: center;">
      <h1 style="color: #ffffff; font-size: 32px; margin: 0;">Революция в HR-подборе</h1>
      <p style="color: #f3f4f6; font-size: 18px; margin-top: 16px;">
        Увеличьте скорость найма на 300% с помощью ИИ-ассистента
      </p>
    </td>
  </tr>
</table>

<table width="600" style="margin-top: 32px;">
  <tr>
    <td class="stats-card" style="padding: 24px; border: 2px solid #e5e7eb; border-radius: 12px;">
      <h2 style="color: #1f2937; font-size: 48px; margin: 0;">2,500+</h2>
      <p style="color: #6b7280; font-size: 16px;">HR-менеджеров уже используют</p>
    </td>
  </tr>
</table>

<table width="600" style="margin-top: 24px;">
  <tr>
    <td style="text-align: center; padding: 16px;">
      <a href="https://example.com/demo" style="background: linear-gradient(90deg, #667eea, #764ba2); color: white; padding: 16px 32px; border-radius: 8px; text-decoration: none; display: inline-block; font-weight: bold;">
        Начать использовать бесплатно
      </a>
    </td>
  </tr>
</table>
</body>
</html>
"""

def check_styles_preserved(original: str, converted: str) -> dict:
    """Проверяем что стили остались на месте"""
    checks = {
        'gradient_preserved': 'linear-gradient' in converted,
        'inline_styles': 'style=' in converted,
        'style_tag': '<style>' in converted,
        'padding_preserved': 'padding:' in converted or 'padding=' in converted,
        'colors_preserved': '#667eea' in converted or '#764ba2' in converted,
        'box_shadow': 'box-shadow' in converted,
        'border_radius': 'border-radius' in converted
    }
    return checks

def check_content_replaced(converted: str) -> dict:
    """Проверяем что контент заменён на переменные"""
    checks = {
        'has_mustache_vars': '{{' in converted and '}}' in converted,
        'no_hardcoded_text': 'Революция в HR-подборе' not in converted,
        'no_hardcoded_numbers': '2,500+' not in converted,
        'no_hardcoded_url': 'https://example.com/demo' not in converted,
        'no_hardcoded_cta': 'Начать использовать бесплатно' not in converted
    }
    return checks

def analyze_conversion(original: str, converted: str):
    """Полный анализ преобразования"""
    print("\n" + "="*80)
    print("ТЕСТ ПРЕОБРАЗОВАНИЯ HTML → MUSTACHE")
    print("="*80)
    
    print(f"\n📊 Размер: {len(original)} → {len(converted)} символов")
    
    print("\n✅ ПРОВЕРКА СТИЛЕЙ (должны сохраниться):")
    style_checks = check_styles_preserved(original, converted)
    for check, passed in style_checks.items():
        status = "✅" if passed else "❌"
        print(f"  {status} {check}: {passed}")
    
    print("\n🔄 ПРОВЕРКА ЗАМЕНЫ КОНТЕНТА (должен быть заменён):")
    content_checks = check_content_replaced(converted)
    for check, passed in content_checks.items():
        status = "✅" if passed else "❌"
        print(f"  {status} {check}: {passed}")
    
    # Итоговая оценка
    all_style_ok = all(style_checks.values())
    all_content_ok = all(content_checks.values())
    
    print("\n" + "="*80)
    if all_style_ok and all_content_ok:
        print("✅ ТЕСТ ПРОЙДЕН: Стили сохранены, контент заменён на переменные")
        return True
    else:
        print("❌ ТЕСТ НЕ ПРОЙДЕН:")
        if not all_style_ok:
            print("   - Стили потеряны или изменены")
        if not all_content_ok:
            print("   - Контент не полностью заменён на переменные")
        return False

def main():
    # Проверяем наличие API ключа
    api_key = os.environ.get('OPENROUTER_API_KEY')
    if not api_key:
        print("❌ Ошибка: OPENROUTER_API_KEY не установлен")
        print("Используйте: export OPENROUTER_API_KEY=your_key")
        sys.exit(1)
    
    print("🚀 Запуск локального теста...")
    print(f"📝 Тестовый HTML: {len(TEST_HTML)} символов")
    
    # Импортируем функцию конвертации
    from index import convert_to_template_ai
    
    try:
        print("\n⏳ Отправляем запрос к OpenAI o1...")
        result = convert_to_template_ai(TEST_HTML, api_key)
        
        print("\n📄 РЕЗУЛЬТАТ ПРЕОБРАЗОВАНИЯ:")
        print("-" * 80)
        print(result[:500] + "..." if len(result) > 500 else result)
        print("-" * 80)
        
        # Анализируем результат
        success = analyze_conversion(TEST_HTML, result)
        
        # Сохраняем результат в файл
        with open('/tmp/converted_template.html', 'w') as f:
            f.write(result)
        print(f"\n💾 Результат сохранён в /tmp/converted_template.html")
        
        sys.exit(0 if success else 1)
        
    except Exception as e:
        print(f"\n❌ ОШИБКА: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    main()
