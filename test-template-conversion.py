import requests
import json

# Читаем HTML шаблон
with open('test-complex-template.html', 'r', encoding='utf-8') as f:
    html_content = f.read()

print(f"📄 HTML размер: {len(html_content)} символов")
print(f"📊 Текстовый контент: ~{len(html_content) - html_content.count('<')*20} символов (без тегов)")

# Отправляем на преобразование
url = "https://functions.poehali.dev/616d6890-24c3-49c8-8b29-692dd342933b"
payload = {
    "html_content": html_content,
    "event_id": 1,
    "content_type_id": 13,  # Тестовый лонгрид
    "name": "Тестовый лонгрид со стилями"
}

print("\n🚀 Отправляю на преобразование...")
response = requests.post(url, json=payload, headers={'Content-Type': 'application/json'})

if response.status_code == 200:
    result = response.json()
    print("\n✅ Преобразование успешно!")
    print(f"📝 ID оригинала: {result.get('example_id')}")
    print(f"📝 ID шаблона со слотами: {result.get('template_id')}")
    
    # Сохраняем результат
    with open('template-conversion-result.json', 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    print("\n💾 Результат сохранён в template-conversion-result.json")
else:
    print(f"\n❌ Ошибка: {response.status_code}")
    print(response.text)
