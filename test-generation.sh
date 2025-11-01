#!/bin/bash

echo "🧪 Тест генерации письма с валидацией стилей"
echo "=============================================="
echo ""

URL="https://functions.poehali.dev/90b50454-3ef3-4d5f-add1-e22941c980f4"

echo "📝 Генерирую письмо типа 'Продажа через боль' (content_type_id=1)"
echo "Инструкция: Напиши про боль HR-ов которые теряют лучших кандидатов"
echo ""

curl -X POST "$URL" \
  -H "Content-Type: application/json" \
  -d '{
    "event_id": 1,
    "content_type_id": 1,
    "instructions": "Напиши письмо про боль HR-специалистов, которые теряют лучших кандидатов из-за долгого процесса найма. Упомяни 3 спикеров конференции."
  }' \
  | jq -r '
    if .success then
      "✅ ГЕНЕРАЦИЯ УСПЕШНА\n" +
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
      "📧 Тема: " + .subject + "\n" +
      "📋 Шаблон: " + .template_name + "\n" +
      "📚 Контекст из RAG: " + (.rag_context_items | tostring) + " элементов\n\n" +
      
      (if .validation then
        "🎨 ВАЛИДАЦИЯ СТИЛЕЙ:\n" +
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
        "Общий балл: " + (.validation.overall_score | tostring) + " / 10\n" +
        "Статус: " + (if .validation.passed then "✅ PASSED" else "❌ FAILED" end) + "\n\n" +
        
        (if (.validation.issues | length) > 0 then
          "⚠️  Проблемы:\n" +
          (.validation.issues | map("   • " + .) | join("\n")) + "\n\n"
        else "" end) +
        
        (if (.validation.suggestions | length) > 0 then
          "💡 Рекомендации:\n" +
          (.validation.suggestions | map("   • " + .) | join("\n")) + "\n"
        else "" end)
      else
        "⚠️  Валидация не выполнена\n"
      end) +
      
      "\n📄 HTML размер: " + (.html | length | tostring) + " символов"
    else
      "❌ ОШИБКА: " + (.error // "Unknown error")
    end
  '

echo ""
echo "=============================================="
echo "Тест завершён"
