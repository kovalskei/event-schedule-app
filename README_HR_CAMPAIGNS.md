# HR Рассылки - Автоматическая генерация email-кампаний

## Описание системы

Система автоматически создаёт персонализированные email-рассылки на основе:
- 📄 Программы мероприятия (Google Docs)
- 💭 Банка "болей" целевой аудитории (Google Docs)
- 🤖 ИИ-ассистента для генерации контента

## Воркфлоу

```
┌─────────────────────┐
│ 1. Загрузка данных  │ → Чтение Google Docs
│    из документов    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ 2. Генерация        │ → OpenAI GPT-4 создаёт письмо
│    контента         │   (тема + HTML)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ 3. Создание         │ → Шаблон в UniSender
│    шаблона          │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ 4. Тестирование     │ → Отправка тестового письма
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ 5. Уведомление      │ → Telegram-бот уведомляет менеджера
│    менеджера        │
└─────────────────────┘
```

## Необходимые API-ключи

### 1. OpenAI API Key
- Получить на: https://platform.openai.com/api-keys
- Формат: `sk-...`
- Нужен для генерации текста писем

### 2. Google Docs API Key
- Создать проект: https://console.cloud.google.com
- Включить API: Google Docs API
- Создать учётные данные → API ключ
- Нужен для чтения документов

### 3. UniSender API Key
- Войти в UniSender: https://cp.unisender.com
- Настройки → API → Скопировать ключ
- Нужен для создания шаблонов и отправки писем

### 4. Telegram Bot Token
- Написать @BotFather в Telegram
- Команда: `/newbot`
- Скопировать токен (формат: `123456:ABC-DEF...`)

### 5. Telegram Chat ID
- Написать боту любое сообщение
- Открыть: `https://api.telegram.org/bot<ВАШ_ТОКЕН>/getUpdates`
- Найти `"chat":{"id":...}` и скопировать ID

## Архитектура системы

### Backend Functions (Python 3.11)

1. **google-docs-reader** - Читает содержимое Google Docs
   - `GET /?doc_id={id}` → возвращает текст документа

2. **ai-content-generator** - Генерирует письма через OpenAI
   - `POST /` с body: `{program_text, pain_points_text, tone}`
   - Возвращает: `{subject, html}`

3. **unisender-manager** - Управляет шаблонами и отправкой
   - `POST /` с action: `create_template` или `send_test`
   - Создаёт шаблон / отправляет тест

4. **telegram-notifier** - Уведомления в Telegram
   - `POST /` с body: `{template_id, message}`
   - Отправляет сообщение менеджеру

5. **campaign-manager** - Управление кампаниями и логирование
   - `GET /` - список всех кампаний
   - `POST /` с action: `create|save_email|log` - создание/сохранение
   - `PUT /` - обновление статуса кампании

### База данных (PostgreSQL)

**Таблицы:**
- `campaigns` - кампании рассылок
- `generated_emails` - сгенерированные письма
- `email_stats` - статистика отправок
- `campaign_logs` - логи выполнения

### Frontend (React + TypeScript)

Интерфейс на странице `/` с пошаговым процессом:
1. Ввод ID документов Google Docs
2. Генерация контента кнопкой
3. Создание шаблона в UniSender
4. Отправка теста и уведомление

## Использование

### Быстрый старт

1. Добавьте все необходимые API-ключи в настройках проекта
2. Откройте главную страницу приложения
3. Введите ID документов Google Docs:
   - ID программы мероприятия
   - ID банка болей ЦА
4. Нажмите **"Запустить полный цикл"**

Система автоматически:
- Прочитает документы
- Сгенерирует письмо
- Создаст шаблон в UniSender
- Отправит уведомление в Telegram

### Ручной режим

Можно выполнять шаги по отдельности:

**Шаг 1:** Загрузка данных
- Укажите ID документов и выберите тон письма

**Шаг 2:** Генерация контента
- Нажмите "Сгенерировать письмо"
- Проверьте предпросмотр

**Шаг 3:** Создание шаблона
- Задайте название шаблона
- Нажмите "Создать шаблон в UniSender"
- Скопируйте ID шаблона

**Шаг 4:** Тестирование
- Введите email для теста
- Отправьте тестовое письмо
- Уведомите менеджера в Telegram

### Формат ID документа Google Docs

Из URL документа: `https://docs.google.com/document/d/1abc2def3ghi.../edit`

Берём часть: `1abc2def3ghi...`

## Интеграция с n8n

Для автоматизации через n8n используйте прямые HTTP-запросы к функциям:

```javascript
// 1. Чтение документов
const programDoc = await $http.request({
  url: 'https://functions.poehali.dev/4df54bd9-8e52-46a4-a000-7cf55c0fd37d',
  qs: { doc_id: 'YOUR_PROGRAM_DOC_ID' }
});

// 2. Генерация контента
const generated = await $http.request({
  url: 'https://functions.poehali.dev/e3a9e3f7-5973-4c72-827a-c755b5b909c0',
  method: 'POST',
  body: {
    program_text: programDoc.content,
    pain_points_text: painDoc.content,
    tone: 'professional'
  }
});

// 3. Создание шаблона
const template = await $http.request({
  url: 'https://functions.poehali.dev/c6001b4a-b44b-4358-8b02-a4e85f7da1b8',
  method: 'POST',
  body: {
    action: 'create_template',
    subject: generated.subject,
    html: generated.html,
    template_name: 'HR Campaign'
  }
});

// 4. Уведомление
await $http.request({
  url: 'https://functions.poehali.dev/e3024a9f-3935-4618-8f44-14ef29bf5d0a',
  method: 'POST',
  body: {
    template_id: template.template_id,
    unisender_link: 'https://cp.unisender.com'
  }
});
```

## Расширение функционала

### Добавление новых источников данных

Создайте новую backend-функцию для чтения данных из других источников (Notion, Airtable, CRM).

### A/B тестирование

Измените `ai-content-generator` для генерации нескольких вариантов писем с разными тонами/подходами.

### Аналитика и обучение

Используйте таблицу `email_stats` для сбора метрик и улучшения промптов для ИИ.

### Интеграция с Sendsay

Создайте альтернативную версию `unisender-manager` для работы с Sendsay API.

## Поддержка

При возникновении проблем проверьте:
1. ✅ Все API-ключи корректно добавлены
2. ✅ ID документов Google Docs указаны правильно
3. ✅ Документы открыты для чтения (публичные или по ссылке)
4. ✅ В UniSender достаточно средств на балансе

## Лицензия

MIT License
