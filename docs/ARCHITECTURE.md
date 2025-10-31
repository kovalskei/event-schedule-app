# 🏗️ Архитектура проекта Event Schedule App

## 📋 Общее описание
Система управления email-рассылками для мероприятий с автоматической генерацией контента через ИИ. Проект состоит из frontend (React), backend (Cloud Functions на Python), PostgreSQL базы данных и интеграций с UniSender/OpenRouter.

---

## 🗄️ База данных

### Схема: `t_p22819116_event_schedule_app`

#### Основные таблицы

**events** (2 записи)
- `id` - первичный ключ мероприятия
- `name` - название мероприятия
- `start_date`, `end_date` - даты проведения
- `logo_url` - URL логотипа
- `unisender_list_id` - привязка к списку рассылки UniSender
- `primary_cta_text`, `primary_cta_url` - основной призыв к действию
- `location`, `format` - место и формат проведения
- `theme`, `description` - тема и описание
- `status` - статус мероприятия (active/archived)

**content_types** (11 записей)
- `id` - тип контента
- `event_id` - связь с мероприятием
- `name` - название типа (например: "Анонс спикера", "Напоминание")
- `description` - описание
- `scheduling_rules` - JSON с правилами планирования

**email_templates** (30 записей)
- `id` - первичный ключ шаблона
- `event_id` - связь с мероприятием
- `content_type_id` - тип контента
- `name` - название шаблона
- `html_template` - HTML с Mustache переменными `{{intro_heading}}`, `{{cta_url}}`, etc.
- `subject_template` - тема письма с переменными
- `instructions` - инструкции для ИИ по использованию
- `is_example` - флаг эталонного шаблона (для валидации)

**knowledge_store** (18 записей)
- `id` - первичный ключ
- `event_id` - связь с мероприятием
- `content` - текстовое содержимое
- `content_type` - тип (google_doc/manual_text)
- `source_url` - ссылка на источник
- `meta_data` - JSON с метаданными

**generated_emails** (23 записи)
- `id` - первичный ключ черновика
- `event_id`, `content_type_id`, `template_id` - связи
- `subject`, `html_body` - тема и HTML письма
- `status` - draft/sent/scheduled
- `scheduled_at` - дата отправки
- `validation_status` - pending/passed/failed
- `validation_notes` - результат валидации
- `created_at` - дата создания

**Дополнительные таблицы** (пока не используются):
- `campaigns`, `content_plan`, `content_plan_items` - планирование кампаний
- `email_stats`, `email_cta_links` - аналитика кликов
- `utm_rules`, `utm_logs`, `link_rules` - управление UTM метками
- `mailing_lists`, `event_mailing_lists` - управление списками
- `schedule_rules` - правила автоматизации
- `campaign_logs` - логи отправок

---

## ⚙️ Backend Functions

### 1. **events-manager** 
**URL**: `https://functions.poehali.dev/b56e5895-fb22-4d96-b746-b046a9fd2750`
**Язык**: Python
**Назначение**: CRUD операции для мероприятий, типов контента, шаблонов, знаний

**Actions (POST body.action)**:
- `get_events` → список всех мероприятий
- `get_event_settings` (event_id) → полные настройки мероприятия
- `create_event` (name, start_date, ...) → создание мероприятия
- `update_event` (event_id, ...) → обновление мероприятия
- `create_content_type` (event_id, name, ...) → создание типа контента
- `update_content_type` (content_type_id, ...) → обновление типа
- `delete_content_type` (content_type_id) → удаление типа
- `create_email_template` (event_id, content_type_id, html_template, ...) → создание шаблона
- `update_email_template` (template_id, ...) → обновление шаблона
- `delete_email_template` (template_id) → удаление шаблона
- `add_knowledge` (event_id, content, source_url, ...) → добавление знания
- `delete_knowledge` (knowledge_id) → удаление знания

**Особенности**:
- Читает Google Docs/Sheets через `read_google_doc(url, sheet_name)`
- Извлекает метаданные из листа "Meta" в формате A=ключ, B=значение
- Использует `psycopg2` с `RealDictCursor` для работы с PostgreSQL

---

### 2. **template-generator**
**URL**: `https://functions.poehali.dev/616d6890-24c3-49c8-8b29-692dd342933b`
**Язык**: Python
**Назначение**: Преобразует готовый HTML в шаблон с Mustache переменными через OpenRouter (Claude Sonnet 3.5)

**Вход (POST body)**:
```json
{
  "html_content": "<html>...</html>",
  "event_id": 1,
  "content_type_id": 3,
  "name": "Название шаблона"
}
```

**Алгоритм**:
1. Отправляет HTML в OpenRouter API (`https://openrouter.ai/api/v1/chat/completions`)
2. Модель `anthropic/claude-3.5-sonnet` анализирует HTML
3. Возвращает JSON: `{"html_layout": "...", "slots_schema": {...}, "notes": "..."}`
4. Сохраняет **2 шаблона** в БД:
   - Оригинал с `is_example=true` (для валидации)
   - Новый шаблон со слотами `is_example=false`

**Переменные шаблона**:
- `{{intro_heading}}`, `{{intro_text}}` — заголовок и вступление
- `{{subheading}}` — подзаголовок
- `{{cta_text}}`, `{{cta_url}}` — кнопка CTA
- `{{#speakers}}...{{/speakers}}` — цикл по спикерам (если есть)

**Требования к API ключу**: `OPENROUTER_API_KEY` в секретах

---

### 3. **generate-drafts-v2**
**URL**: `https://functions.poehali.dev/90b50454-3ef3-4d5f-add1-e22941c980f4`
**Язык**: Python
**Назначение**: Генерирует черновик письма на основе шаблона и базы знаний через ИИ

**Вход (POST body)**:
```json
{
  "template_id": 5,
  "user_prompt": "Сделай письмо про спикера Ивана"
}
```

**Алгоритм**:
1. Загружает шаблон и базу знаний из БД
2. Формирует промпт для Claude с контекстом
3. Получает заполненные переменные `{{intro_heading}}`, `{{cta_text}}`, etc.
4. Рендерит Mustache шаблон с данными через библиотеку `chevron`
5. Сохраняет результат в `generated_emails` со статусом `draft`

**Требования**: `OPENROUTER_API_KEY`, `DATABASE_URL`

---

### 4. **style-validator**
**URL**: `https://functions.poehali.dev/7fe04096-4a45-4b17-a391-c4b02b1b464a`
**Язык**: Python
**Назначение**: Валидирует сгенерированный черновик по эталонному шаблону

**Вход (POST body)**:
```json
{
  "draft_id": 12
}
```

**Алгоритм**:
1. Загружает черновик и находит эталонный шаблон (`is_example=true`)
2. Отправляет оба HTML в Claude для сравнения стилей
3. Проверяет: структура таблиц, inline CSS, footer, ссылки
4. Возвращает: `validation_status` (passed/failed) и `validation_notes`
5. Обновляет поля в БД `generated_emails`

---

### 5. **index-knowledge**
**URL**: `https://functions.poehali.dev/814ac16e-cb58-4603-b3af-4b6f9215fb05`
**Язык**: Python
**Назначение**: Индексирует всю базу знаний мероприятия (читает Google Docs)

**Вход (POST body)**:
```json
{
  "event_id": 1
}
```

**Алгоритм**:
1. Загружает все записи `knowledge_store` для мероприятия
2. Для каждой с `content_type=google_doc` вызывает `read_google_doc(source_url)`
3. Обновляет `content` в БД свежими данными
4. Возвращает количество проиндексированных элементов

---

### 6. **image-uploader**
**URL**: `https://functions.poehali.dev/61daaad5-eb92-4f21-8104-8760f8d0094e`
**Язык**: Python (предположительно)
**Назначение**: Загрузка изображений (логотипы мероприятий)

---

### 7. **sync-events-unisender**
**URL**: `https://functions.poehali.dev/b7fefc5f-605d-4c44-8830-b5cf0c00ca0e`
**Назначение**: Синхронизация списков рассылки с UniSender API

---

### 8-14. **Другие функции**
- `ai-content-generator`, `ai-content-generator-advanced` — генерация контента
- `campaign-manager` — управление кампаниями
- `unisender-manager` — работа с UniSender
- `google-docs-reader` — чтение Google документов
- `telegram-notifier` — уведомления в Telegram

---

## 🎨 Frontend

### Технологии
- **React** + **TypeScript** + **Vite**
- **Tailwind CSS** + **shadcn/ui** компоненты
- **React Router** для навигации

### Основные компоненты

**src/components/events/EventSettingsDialog.tsx**
- Модальное окно настроек мероприятия
- Вкладки: Общие настройки, Типы контента, Email шаблоны, База знаний
- Функции:
  - Создание/редактирование типов контента
  - Создание шаблонов (обычный + генератор со слотами)
  - Добавление знаний (вручную или Google Docs)
  - Индексация базы знаний

**src/components/events/DraftsViewer.tsx**
- Просмотр сгенерированных черновиков
- Фильтры по типу контента и статусу
- Предпросмотр HTML в iframe
- Валидация через `style-validator`
- Кнопка "Отправить в UniSender"

**src/App.tsx**
- Главная страница со списком мероприятий
- Карточки событий
- Кнопки "Настройки" и "Черновики"

### Переменные окружения
```typescript
const EVENTS_MANAGER_URL = 'https://functions.poehali.dev/...';
const TEMPLATE_GENERATOR_URL = 'https://functions.poehali.dev/...';
const GENERATE_DRAFTS_URL = 'https://functions.poehali.dev/...';
const INDEX_KNOWLEDGE_URL = 'https://functions.poehali.dev/...';
const STYLE_VALIDATOR_URL = 'https://functions.poehali.dev/...';
```

---

## 🔄 Типовые сценарии работы

### 1️⃣ Создание нового мероприятия
```
Frontend → POST events-manager {action: 'create_event', name, dates, ...}
→ DB: INSERT INTO events
→ Frontend: обновляет список мероприятий
```

### 2️⃣ Добавление шаблона через генератор
```
1. Пользователь вставляет готовый HTML в форму
2. Frontend → POST template-generator {html_content, event_id, ...}
3. Backend → OpenRouter API (Claude анализирует HTML)
4. Backend → DB: сохраняет оригинал (is_example=true) + шаблон со слотами
5. Frontend: показывает уведомление "Новый шаблон создан!"
```

### 3️⃣ Генерация черновика письма
```
1. Пользователь выбирает шаблон и пишет промпт
2. Frontend → POST generate-drafts-v2 {template_id, user_prompt}
3. Backend: загружает шаблон + knowledge_store
4. Backend → OpenRouter API (Claude заполняет переменные)
5. Backend: рендерит Mustache шаблон
6. Backend → DB: INSERT INTO generated_emails (status='draft')
7. Frontend: показывает новый черновик в DraftsViewer
```

### 4️⃣ Валидация черновика
```
1. Пользователь нажимает "Валидировать" в черновике
2. Frontend → POST style-validator {draft_id}
3. Backend: находит эталонный шаблон (is_example=true)
4. Backend → OpenRouter API (Claude сравнивает HTML)
5. Backend → DB: UPDATE generated_emails SET validation_status, validation_notes
6. Frontend: показывает результат валидации
```

### 5️⃣ Индексация базы знаний
```
1. Пользователь нажимает "Индексировать базу знаний"
2. Frontend → POST index-knowledge {event_id}
3. Backend: загружает knowledge_store WHERE event_id=X
4. Backend: для каждой записи с content_type='google_doc':
   → читает Google Doc по source_url
   → UPDATE content в БД
5. Frontend: "Проиндексировано N элементов"
```

---

## 🔐 Секреты (Environment Variables)

**Backend функции имеют доступ к**:
- `DATABASE_URL` — DSN для подключения к PostgreSQL
- `OPENROUTER_API_KEY` — ключ для OpenRouter API
- `UNISENDER_API_KEY` — ключ для UniSender API (если используется)

**Frontend НЕ имеет доступа** к секретам напрямую.

---

## 🐛 Отладка

### Логи backend функций
```bash
get_logs(source='backend/template-generator')
get_logs(source='backend/events-manager')
```

### Логи frontend
```bash
get_logs(source='frontend')  # то же самое что консоль F12
```

### Частые проблемы
1. **"html_content слишком большой"** → проверить что frontend отправляет правильное поле
2. **"validation_status=null"** → запустить валидацию через style-validator
3. **"База знаний пустая"** → нажать "Индексировать базу знаний"

---

## 📊 Состояние проекта (на момент создания документа)

- ✅ **Работает**: создание мероприятий, типов контента, шаблонов, генерация черновиков
- ✅ **Работает**: генератор шаблонов со слотами через Claude
- ✅ **Работает**: валидация черновиков по эталонным шаблонам
- ✅ **Работает**: индексация Google Docs в базу знаний
- 🚧 **В разработке**: кампании, UTM правила, автоматизация отправок
- 🚧 **В разработке**: интеграция с UniSender (отправка черновиков)

---

## 🚀 Как начать работу в новом диалоге

Скопируй и отправь в новый чат:

```
Проект: events.poehali.dev  
Читай docs/ARCHITECTURE.md для полного контекста системы.

База: t_p22819116_event_schedule_app  
Основные таблицы: events, email_templates, generated_emails, knowledge_store, content_types

Backend: /backend/events-manager, /backend/template-generator, /backend/generate-drafts-v2, /backend/style-validator

Frontend: src/App.tsx, src/components/events/EventSettingsDialog.tsx, src/components/events/DraftsViewer.tsx
```

И я сразу восстановлю весь контекст! 🎯
