# 🏗️ Архитектура проекта Event Schedule App

## 📋 Общее описание
Система управления email-рассылками для мероприятий с автоматической генерацией контента через ИИ. Проект состоит из frontend (React), backend (Cloud Functions на Python), PostgreSQL базы данных и интеграций с UniSender/OpenRouter.

---

## 🗄️ База данных

### Схема: `t_p22819116_event_schedule_app`

#### Основные таблицы

**events** - Мероприятия
- `id` - первичный ключ мероприятия
- `name` - название мероприятия
- `start_date`, `end_date` - даты проведения
- `logo_url` - URL логотипа
- `unisender_list_id` - привязка к списку рассылки UniSender
- `primary_cta_text`, `primary_cta_url` - основной призыв к действию
- `location`, `format` - место и формат проведения
- `theme`, `description` - тема и описание
- `status` - статус мероприятия (active/archived)

**content_types** - Типы контента писем
- `id` - тип контента
- `event_id` - связь с мероприятием
- `name` - название типа (например: "Анонс спикера", "Напоминание", "Продажа через боль")
- `description` - описание типа контента
- `scheduling_rules` - JSON с правилами планирования

**email_templates** - Шаблоны писем с Mustache переменными
- `id` - первичный ключ шаблона
- `event_id` - связь с мероприятием
- `content_type_id` - тип контента
- `name` - название шаблона
- `html_layout` - HTML с Mustache переменными `{{intro_heading}}`, `{{cta_url}}`, `{{#speakers}}...{{/speakers}}`
- `slots_schema` - JSONB схема переменных для генерации
- `subject_template` - тема письма с переменными
- `instructions` - инструкции для ИИ (промпт для заполнения переменных)
- `is_example` - флаг эталонного шаблона (для валидации стилей)
- `rag_sources` - JSON массив источников для RAG (например: `["program", "pain_points"]`)
- `html_template` - (устаревшее) старый формат с `{pain_points}`, `{program_topics}`

**knowledge_store** - База знаний для RAG
- `id` - первичный ключ
- `event_id` - связь с мероприятием
- `content` - текстовое содержимое (программа мероприятия, боли аудитории, кейсы)
- `content_type` - тип (google_doc/manual_text/program/pain_points)
- `source_url` - ссылка на источник (Google Docs URL)
- `meta_data` - JSON с метаданными
- `indexed_at` - timestamp последней индексации

**generated_emails** - Сгенерированные письма (черновики и отправленные)
- `id` - первичный ключ черновика
- `event_id`, `content_type_id`, `template_id` - связи
- `subject`, `html_body` - тема и HTML письма
- `status` - draft/sent/scheduled
- `scheduled_at` - дата отправки
- `validation_status` - pending/passed/failed (результат проверки стилей)
- `validation_notes` - текстовое описание результата валидации
- `created_at` - дата создания

**Дополнительные таблицы** (для расширения функционала):
- `campaigns`, `content_plan`, `content_plan_items` - планирование кампаний
- `email_stats`, `email_cta_links` - аналитика кликов
- `utm_rules`, `utm_logs`, `link_rules` - управление UTM метками
- `mailing_lists`, `event_mailing_lists` - управление списками рассылки
- `schedule_rules` - правила автоматизации
- `campaign_logs` - логи отправок

---

## ⚙️ Backend Functions

### 1. **events-manager** 
**URL**: `https://functions.poehali.dev/b56e5895-fb22-4d96-b746-b046a9fd2750`  
**Язык**: Python 3.11  
**Назначение**: CRUD операции для мероприятий, типов контента, шаблонов, базы знаний

**Actions (POST body.action)**:
- `get_events` → список всех мероприятий
- `get_event_settings` (event_id) → полные настройки мероприятия (типы контента, шаблоны, знания)
- `create_event` (name, start_date, ...) → создание мероприятия
- `update_event` (event_id, ...) → обновление мероприятия
- `create_content_type` (event_id, name, description) → создание типа контента
- `update_content_type` (content_type_id, ...) → обновление типа
- `delete_content_type` (content_type_id) → удаление типа
- `create_email_template` (event_id, content_type_id, html_template, ...) → создание шаблона
- `update_email_template` (template_id, ...) → обновление шаблона
- `delete_email_template` (template_id) → удаление шаблона
- `add_knowledge` (event_id, content, source_url, content_type) → добавление знания в базу
- `delete_knowledge` (knowledge_id) → удаление знания

**Особенности**:
- Читает Google Docs/Sheets через `read_google_doc(url, sheet_name)`
- Извлекает метаданные из листа "Meta" в формате A=ключ, B=значение
- Использует `psycopg2` с `RealDictCursor` для работы с PostgreSQL (Simple Query Protocol)

---

### 2. **template-generator**
**URL**: `https://functions.poehali.dev/616d6890-24c3-49c8-8b29-692dd342933b`  
**Язык**: Python 3.11  
**Назначение**: Преобразует готовый HTML в Mustache-шаблон с переменными

**Методы**:
- **POST (использует AI)**: Преобразование через Claude 3.5 Sonnet
- **POST с `use_regex=true`**: ⚡ Быстрое преобразование через regex (миллисекунды)

**Вход (POST body)**:
```json
{
  "html_content": "<html>...</html>",
  "use_ai": false  // true = Claude AI (медленнее, умнее), false = regex (быстрее)
}
```

**Режим Regex (по умолчанию)**:
- Заменяет текст: `>текст<` → `{{ text_1 }}`, `{{ text_2 }}`
- Заменяет ссылки: `href="url"` → `href="{{ url_1 }}"`
- Заменяет картинки: `src="img.jpg"` → `src="{{ image_1 }}"`
- ⚡ Работает за 50-200ms
- ✅ Сохраняет 100% стилей (градиенты, CSS)

**Режим AI (опционально)**:
- Анализирует структуру через Claude
- Распознаёт повторяющиеся блоки → создаёт циклы `{{#speakers}}...{{/speakers}}`
- Генерирует `slots_schema` (JSONB) для базы данных
- 🐌 Работает 3-10 секунд

**Выход**:
```json
{
  "template": "HTML с переменными {{ text_1 }}, {{ url_1 }}",
  "variables": {
    "text_1": "Исходный текст",
    "url_1": "https://example.com",
    "image_1": "logo.png"
  }
}
```

**Требования**: `OPENROUTER_API_KEY` (только для AI режима)

---

### 3. **generate-drafts-v2**
**URL**: `https://functions.poehali.dev/90b50454-3ef3-4d5f-add1-e22941c980f4`  
**Язык**: Python 3.11  
**Назначение**: Генерирует черновик письма на основе Mustache-шаблона и базы знаний через ИИ

**Вход (POST body)**:
```json
{
  "template_id": 5,
  "user_prompt": "Сделай письмо про спикера Ивана Петрова"
}
```

**Алгоритм**:
1. Загружает шаблон (`html_layout`, `slots_schema`, `instructions`, `rag_sources`)
2. Загружает релевантный контент из `knowledge_store` по `rag_sources`
3. Формирует промпт для Claude:
   - System: инструкция как заполнять переменные
   - User: `instructions` + база знаний + пользовательский запрос
4. Claude возвращает JSON с заполненными переменными:
   ```json
   {
     "subject": "Тема письма",
     "intro_heading": "Заголовок",
     "speakers": [
       {"name": "Иван Петров", "topic": "AI в HR", "photo": "url"}
     ],
     "cta_text": "Зарегистрироваться",
     "cta_url": "https://..."
   }
   ```
5. Рендерит Mustache шаблон через библиотеку `chevron`:
   ```python
   final_html = chevron.render(html_layout, ai_variables)
   ```
6. Сохраняет в `generated_emails` (status=draft)

**Требования**: `OPENROUTER_API_KEY`, `DATABASE_URL`

---

### 4. **style-validator**
**URL**: `https://functions.poehali.dev/7fe04096-4a45-4b17-a391-c4b02b1b464a`  
**Язык**: Python 3.11  
**Назначение**: Валидирует сгенерированный черновик по эталонному шаблону

**Вход (POST body)**:
```json
{
  "draft_id": 12
}
```

**Алгоритм**:
1. Загружает черновик (HTML из `generated_emails`)
2. Находит эталонный шаблон (`is_example=true` с тем же `content_type_id`)
3. Отправляет оба HTML в Claude для сравнения:
   - Проверяет: структура таблиц, inline CSS, цвета, шрифты, footer
   - Игнорирует: текстовое содержимое, переменные значения
4. Возвращает: `validation_status` (passed/failed) + `validation_notes`
5. Обновляет поля в `generated_emails`:
   ```sql
   UPDATE generated_emails 
   SET validation_status = 'passed', 
       validation_notes = 'Стили соответствуют...'
   WHERE id = 12
   ```

**Требования**: `OPENROUTER_API_KEY`, `DATABASE_URL`

---

### 5. **index-knowledge**
**URL**: `https://functions.poehali.dev/814ac16e-cb58-4603-b3af-4b6f9215fb05`  
**Язык**: Python 3.11  
**Назначение**: Индексирует всю базу знаний мероприятия (читает Google Docs)

**Вход (POST body)**:
```json
{
  "event_id": 1
}
```

**Алгоритм**:
1. Загружает все записи `knowledge_store` для мероприятия
2. Для каждой с `content_type=google_doc`:
   - Вызывает `read_google_doc(source_url)`
   - Парсит содержимое (текст, таблицы)
   - Обновляет поле `content` свежими данными
   - Ставит `indexed_at = NOW()`
3. Возвращает количество проиндексированных элементов

**Использование**: Кнопка "Обновить базу знаний" в настройках мероприятия

---

### 6. **image-uploader**
**URL**: `https://functions.poehali.dev/61daaad5-eb92-4f21-8104-8760f8d0094e`  
**Назначение**: Загрузка изображений (логотипы мероприятий, фото спикеров)

---

### 7. **sync-events-unisender**
**URL**: `https://functions.poehali.dev/b7fefc5f-605d-4c44-8830-b5cf0c00ca0e`  
**Назначение**: Синхронизация списков рассылки с UniSender API

---

### 8-14. **Другие функции**
- `ai-content-generator`, `ai-content-generator-advanced` — устаревшие генераторы контента
- `campaign-manager` — управление кампаниями UniSender
- `unisender-manager` — работа с API UniSender (создание кампаний, отправка)
- `google-docs-reader` — standalone читалка Google Docs
- `telegram-notifier` — уведомления в Telegram
- `execute-request` — универсальный HTTP клиент для интеграций

---

## 🎨 Frontend

### Технологии
- **React 18** + **TypeScript** + **Vite**
- **Tailwind CSS** + **shadcn/ui** компоненты
- **React Router** для навигации
- **Recharts** для графиков аналитики

### Основные страницы

**src/App.tsx**
- Главная страница со списком мероприятий
- Карточки событий с датами, логотипами
- Кнопки: "Настройки", "Черновики", "Аналитика"

**src/pages/TemplateTest.tsx** (путь в коде: `/src/pages/TemplateTest.tsx`)  
**⚡ Преобразователь HTML → Mustache**
- Загрузка HTML файла или вставка кода
- Загрузка демо-шаблонов из `/public/` (test-simple-template.html, test-complex-template.html)
- Checkbox "🤖 AI (медленнее)" для переключения режимов:
  - ❌ Без галочки: **⚡ Regex режим** (50-200ms, сохраняет 100% стилей)
  - ✅ С галочкой: **🤖 AI режим** (3-10s, распознаёт циклы)
- Две колонки с превью через `<iframe srcDoc={html}>`:
  - **Слева**: "Оригинальный HTML" + превью в iframe
  - **Справа**: "Преобразованный Mustache" + превью с переменными в iframe
- Кнопка "⚡ Преобразовать (Regex)" / "🤖 Преобразовать (AI)"
- Таблица переменных: название → исходное значение
- **Безопасность**: iframe с `srcDoc` изолирует HTML от основного DOM

**src/components/events/EventSettingsDialog.tsx**
- Модальное окно настроек мероприятия
- Вкладки:
  1. **Общие настройки**: название, даты, CTA, логотип
  2. **Типы контента**: создание/редактирование типов писем
  3. **Email шаблоны**: 
     - Обычное создание (вставка HTML вручную)
     - Генератор со слотами (через template-generator)
  4. **База знаний**: 
     - Добавление контента вручную
     - Добавление Google Docs URL
     - Кнопка "Индексировать базу знаний"

**src/components/events/DraftsViewer.tsx**
- Просмотр сгенерированных черновиков
- Фильтры: по типу контента, по статусу (draft/sent)
- Карточки черновиков:
  - Предпросмотр HTML через `dangerouslySetInnerHTML` (⚠️ рендерится напрямую в DOM)
  - Кнопка "Валидировать стили" → вызов `style-validator`
  - Индикатор валидации (passed/failed)
  - Кнопка "Отправить в UniSender"
  - Интеграция с UniSender API для создания кампаний

**src/pages/CampaignManager.tsx**
- Управление email-кампаниями
- Генерация контента через AI (OpenAI/Claude)
- Интеграция с Google Docs для загрузки программы и болей
- Предпросмотр HTML через `dangerouslySetInnerHTML`
- Создание шаблонов в UniSender
- Отправка тестовых и массовых рассылок

### Архитектура взаимодействия Frontend ↔ Backend

**Прямые API вызовы без прокси:**
- Frontend делает прямые `fetch()` запросы к backend функциям
- Все функции развёрнуты на `https://functions.poehali.dev/`
- CORS включён на всех backend функциях (`Access-Control-Allow-Origin: *`)
- **Нет Vite proxy** - не требуется, так как backend публичный

**CORS конфигурация в backend функциях:**
```python
# Все backend функции обрабатывают OPTIONS для CORS
if method == 'OPTIONS':
    return {
        'statusCode': 200,
        'headers': {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Max-Age': '86400'
        },
        'body': ''
    }
```

### Методы рендеринга HTML в интерфейсе

**1. Iframe с srcDoc (безопасный метод)**
- Используется в: `src/pages/TemplateTest.tsx`
- Преимущества: полная изоляция HTML от основного DOM
- Код:
  ```tsx
  <iframe 
    srcDoc={htmlContent} 
    className="w-full h-[600px] border-0"
    sandbox="allow-same-origin"
  />
  ```
- Применение: превью шаблонов при преобразовании

**2. dangerouslySetInnerHTML (быстрый метод)**
- Используется в: `src/components/events/DraftsViewer.tsx`, `src/pages/CampaignManager.tsx`
- Преимущества: быстрая отрисовка, нет iframe overhead
- Недостатки: ⚠️ HTML встраивается напрямую в DOM (возможны конфликты стилей)
- Код:
  ```tsx
  <div dangerouslySetInnerHTML={{ __html: emailHTML }} />
  ```
- Применение: предпросмотр готовых email-черновиков

### Константы API endpoints

```typescript
// src/App.tsx и компоненты
const EVENTS_MANAGER_URL = 'https://functions.poehali.dev/b56e5895-fb22-4d96-b746-b046a9fd2750';
const TEMPLATE_GENERATOR_URL = 'https://functions.poehali.dev/616d6890-24c3-49c8-8b29-692dd342933b';
const GENERATE_DRAFTS_URL = 'https://functions.poehali.dev/90b50454-3ef3-4d5f-add1-e22941c980f4';
const STYLE_VALIDATOR_URL = 'https://functions.poehali.dev/7fe04096-4a45-4b17-a391-c4b02b1b464a';
const INDEX_KNOWLEDGE_URL = 'https://functions.poehali.dev/814ac16e-cb58-4603-b3af-4b6f9215fb05';
```

---

## 🔄 Workflow генерации писем

### Сценарий 1: Создание Mustache-шаблона

```
1. Пользователь открывает "Преобразователь HTML → Mustache"
2. Загружает готовый HTML (или использует демо)
3. Выбирает режим:
   - Regex (быстро, для типовых писем)
   - AI (медленно, для сложных структур с циклами)

4. Frontend → POST /template-generator
   {
     "html_content": "<html>...",
     "use_ai": false
   }

5. Backend (режим Regex):
   ✓ Regex заменяет текст → {{ text_1 }}, {{ text_2 }}
   ✓ Regex заменяет ссылки → {{ url_1 }}
   ✓ Regex заменяет картинки → {{ image_1 }}
   ✓ Возвращает: {template, variables}

   Backend (режим AI):
   ✓ Отправляет HTML в Claude
   ✓ Claude анализирует структуру
   ✓ Создаёт переменные + циклы {{#speakers}}
   ✓ Генерирует slots_schema
   ✓ Возвращает: {html_layout, slots_schema, variables}

6. Frontend отображает:
   - Оригинальный HTML слева
   - Mustache шаблон справа
   - Таблица переменных с их значениями

7. Пользователь копирует результат или сохраняет в базу
```

### Сценарий 2: Генерация письма из шаблона

```
1. Пользователь открывает "Черновики"
2. Нажимает "Создать новое письмо"
3. Выбирает шаблон (с Mustache переменными)
4. Вводит запрос: "Письмо про спикера Ивана Петрова"

5. Frontend → POST /generate-drafts-v2
   {
     "template_id": 5,
     "user_prompt": "Письмо про спикера Ивана Петрова"
   }

6. Backend:
   ✓ SELECT html_layout, slots_schema, instructions FROM email_templates WHERE id=5
   ✓ SELECT content FROM knowledge_store WHERE event_id=... AND content_type='program'
   ✓ Формирует промпт для Claude:
     - System: "Заполни переменные по схеме slots_schema"
     - User: instructions + база знаний + "Письмо про спикера Ивана"
   
   ✓ Claude возвращает JSON:
     {
       "subject": "Иван Петров о трансформации HR через AI",
       "intro_heading": "Как AI меняет подход к подбору персонала",
       "intro_text": "...",
       "speakers": [
         {"name": "Иван Петров", "topic": "AI-рекрутинг", "photo": "url"}
       ],
       "cta_text": "Зарегистрироваться",
       "cta_url": "https://event.ru/register"
     }
   
   ✓ Рендерит через chevron:
     final_html = chevron.render(html_layout, claude_variables)
   
   ✓ INSERT INTO generated_emails (subject, html_body, status='draft')

7. Возвращает: {draft_id: 123, subject: "...", html_preview: "..."}

8. Frontend отображает новый черновик в списке
```

### Сценарий 3: Валидация стилей

```
1. Пользователь видит черновик в списке
2. Нажимает "Валидировать стили"

3. Frontend → POST /style-validator
   {
     "draft_id": 123
   }

4. Backend:
   ✓ SELECT html_body FROM generated_emails WHERE id=123
   ✓ SELECT template_id, content_type_id FROM generated_emails WHERE id=123
   ✓ SELECT html_layout FROM email_templates 
     WHERE content_type_id=... AND is_example=true LIMIT 1
   
   ✓ Отправляет оба HTML в Claude:
     "Сравни стили reference_html и generated_html.
      Игнорируй текст. Проверь: цвета, шрифты, отступы, структуру таблиц."
   
   ✓ Claude возвращает:
     {
       "status": "passed",
       "notes": "Все стили совпадают: цвета (#AE32E3), шрифты (Segoe UI), структура таблиц."
     }
   
   ✓ UPDATE generated_emails 
     SET validation_status='passed', validation_notes='...'
     WHERE id=123

5. Frontend отображает зелёную галочку ✅ "Стили проверены"
```

---

## 🧠 Логика работы с Mustache и AI

### Почему Mustache, а не просто AI генерация?

**❌ Проблема с чистым AI:**
```python
# AI генерирует весь HTML → риск сломать вёрстку
ai_html = claude.generate("Создай письмо про Ивана")
# Результат: несовместимые стили, сломанные таблицы, мусор
```

**✅ Решение: HTML + Mustache слоты + AI заполняет переменные**
```python
# Шаблон (фиксированная вёрстка):
html_layout = """
<table style="...фиксированные стили...">
  <tr><td>{{ intro_heading }}</td></tr>
  {{#speakers}}
    <tr><td>{{ name }} — {{ topic }}</td></tr>
  {{/speakers}}
</table>
"""

# AI заполняет только переменные (не трогает HTML):
variables = claude.fill_variables({
  "intro_heading": "Заголовок",
  "speakers": [{"name": "Иван", "topic": "AI"}]
})

# Рендеринг через Mustache:
final_html = chevron.render(html_layout, variables)
# Результат: ✅ Стили сохранены, контент релевантный
```

### Структура slots_schema (JSONB в БД)

```json
{
  "subject": {
    "type": "string",
    "description": "Тема письма"
  },
  "intro_heading": {
    "type": "string",
    "description": "Заголовок вступления"
  },
  "intro_text": {
    "type": "string",
    "description": "Текст вступления"
  },
  "speakers": {
    "type": "array",
    "description": "Список спикеров (2-4 штуки)",
    "items": {
      "name": "string",
      "topic": "string",
      "photo": "string",
      "company": "string"
    }
  },
  "cta_text": {
    "type": "string",
    "description": "Текст кнопки"
  },
  "cta_url": {
    "type": "string",
    "description": "Ссылка кнопки"
  }
}
```

Claude получает эту схему и заполняет переменные по ней.

---

## 🔍 RAG (Retrieval-Augmented Generation)

### Как работает база знаний

1. **Хранение знаний**: `knowledge_store` таблица
   - Программа мероприятия (Google Sheets)
   - Боли аудитории (Google Docs)
   - Кейсы спикеров (manual_text)

2. **Индексация**: кнопка "Обновить базу знаний"
   - Вызывает `/index-knowledge`
   - Читает Google Docs, обновляет `content`

3. **Использование в генерации**:
   ```python
   # В email_templates.rag_sources:
   rag_sources = ["program", "pain_points"]
   
   # Backend загружает релевантный контент:
   program = SELECT content FROM knowledge_store 
             WHERE event_id=1 AND content_type='program'
   pains = SELECT content FROM knowledge_store 
           WHERE event_id=1 AND content_type='pain_points'
   
   # Промпт для Claude:
   f"""
   ПРОГРАММА МЕРОПРИЯТИЯ:
   {program[:20000]}
   
   БОЛИ АУДИТОРИИ:
   {pains[:20000]}
   
   Заполни переменные шаблона, выбрав релевантный контент.
   """
   ```

---

## 📊 Аналитика и UniSender

### Интеграция с UniSender

1. **Создание кампании**:
   - Черновик (status=draft) → кнопка "Отправить"
   - Вызов `/unisender-manager`:
     ```json
     {
       "action": "create_campaign",
       "draft_id": 123
     }
     ```
   - UniSender API создаёт кампанию
   - Сохраняет `unisender_campaign_id` в `email_campaigns`

2. **Отправка**:
   - UniSender рассылает по списку `unisender_list_id`
   - Обновляет статус: `sent_at = NOW()`, `status = 'sent'`

3. **Аналитика**:
   - Синхронизация статистики через `/sync-events-unisender`
   - Обновляет `email_stats`: opens_count, clicks_count
   - Frontend отображает графики (Recharts)

---

## 🛠 Технические детали

### Google Docs Integration

**Функция `read_google_doc(url, sheet_name=None)`:**
- Парсит Google Docs через публичный API
- Для Google Sheets: читает конкретный лист (sheet_name)
- Возвращает текст или массив строк

**Метаданные из Google Sheets:**
```
Лист "Meta":
A           B
event_name  Human Подбор 2024
event_date  2024-05-15
cta_url     https://event.ru/register
```

Парсится как: `{"event_name": "Human Подбор 2024", ...}`

### PostgreSQL Simple Query Protocol

⚠️ **КРИТИЧНО**: База поддерживает только Simple Query Protocol!

**❌ НЕ работает:**
```python
cursor.execute("SELECT * FROM events WHERE id = %s", (event_id,))
# Ошибка: Extended Query Protocol not supported
```

**✅ Работает:**
```python
cursor.execute(f"SELECT * FROM events WHERE id = {event_id}")
# Simple Query с прямой подстановкой
```

**Для строк:**
```python
name = name.replace("'", "''")  # Экранирование
cursor.execute(f"INSERT INTO events (name) VALUES ('{name}')")
```

### OpenRouter API

**Используется в**:
- `template-generator` (режим AI)
- `generate-drafts-v2`
- `style-validator`

**Конфигурация:**
```python
headers = {
    "Authorization": f"Bearer {OPENROUTER_API_KEY}",
    "Content-Type": "application/json"
}

data = {
    "model": "anthropic/claude-3.5-sonnet",
    "messages": [
        {"role": "system", "content": "Ты — email-маркетолог..."},
        {"role": "user", "content": "Заполни переменные..."}
    ],
    "temperature": 0.7,
    "max_tokens": 4000
}

response = requests.post(
    "https://openrouter.ai/api/v1/chat/completions",
    headers=headers,
    json=data
)
```

---

## 📝 Частые кейсы и решения

### Как добавить новый тип контента?

1. Настройки мероприятия → Типы контента → "Создать"
2. Заполнить: название, описание
3. Создать шаблон для этого типа:
   - Вкладка "Email шаблоны" → "Создать через генератор"
   - Загрузить готовый HTML
   - Преобразовать в Mustache (Regex или AI)
4. Написать `instructions` (промпт для AI):
   ```
   Создай письмо типа "Продажа через боль".
   Выбери 1-2 боли из базы знаний.
   Выбери 2-3 спикера, которые решают эти боли.
   Тон: дружелюбный, без клише.
   ```

### Как обновить базу знаний?

1. Добавить Google Docs URL в "База знаний"
2. Нажать "Индексировать базу знаний"
3. Backend прочитает Google Docs, обновит `knowledge_store`

### Как исправить сломанные стили в черновике?

1. Открыть черновик → "Валидировать стили"
2. Если `failed` → смотреть `validation_notes`
3. Проблема обычно в:
   - Эталонный шаблон (`is_example=true`) устарел → обновить
   - AI сгенерировал лишние стили → переделать промпт `instructions`
   - HTML layout сломан → пересоздать шаблон через `template-generator`

---

## 🚀 Развитие системы

### Текущие задачи

1. **Преобразователь HTML → Mustache**:
   - ✅ Regex режим (быстро, без AI)
   - 🔄 AI режим с циклами `{{#speakers}}`
   - ⏳ Автогенерация slots_schema
   - ⏳ Визуальный редактор переменных (переименование `text_1` → `intro_heading`)

2. **Генерация писем**:
   - ✅ RAG из knowledge_store
   - ✅ Chevron рендеринг
   - ⏳ Поддержка вложенных циклов `{{#events}}{{#speakers}}...{{/speakers}}{{/events}}`

3. **Валидация**:
   - ✅ Сравнение стилей через Claude
   - ⏳ Автоматическая валидация после генерации
   - ⏳ Diff-превью (что изменилось в стилях)

### Будущие фичи

- **A/B тестирование**: сохранение вариантов шаблонов, сравнение метрик
- **Автоматизация**: rules для генерации писем по расписанию
- **Персонализация**: переменные из UniSender (имя подписчика, компания)
- **Мультиязычность**: поддержка переводов шаблонов

---

## 🔗 Полезные ссылки

- **Mustache документация**: https://mustache.github.io/
- **Chevron (Python Mustache)**: https://github.com/noahmorrison/chevron
- **OpenRouter API**: https://openrouter.ai/docs
- **UniSender API**: https://www.unisender.com/ru/support/api/

---

Последнее обновление: 2024-11-01