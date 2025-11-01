# 📧 Email Marketing Automation System - Полная Документация

## 🎯 Назначение системы

Система для автоматической генерации email-рассылок для HR-мероприятий на основе:
- Программы мероприятия (Google Sheets)
- Болей целевой аудитории (Google Docs)
- AI-генерации контента (OpenAI/OpenRouter)
- Шаблонов писем с слотами

---

## 📐 Архитектура системы

### Уровень 1: Frontend (React + TypeScript + Vite)

**Технологии:**
- React 18
- TypeScript
- Vite (сборщик)
- TailwindCSS + shadcn/ui
- React Router v6

**Структура frontend:**
```
src/
├── App.tsx                          # Главный роутер приложения
├── pages/
│   ├── EventsManager.tsx            # Страница управления мероприятиями
│   └── EmailGenerator.tsx           # Страница генерации писем
└── components/
    └── events/
        ├── ContentPlanDialog.tsx     # Диалог импорта контент-плана
        └── ContentPlanImport.tsx     # Компонент загрузки Google Sheets
```

**Основные страницы:**

1. **EventsManager** (`/events`)
   - Список мероприятий
   - CRUD операции над событиями
   - Настройки списков рассылки
   - Управление типами контента

2. **EmailGenerator** (через диалоги)
   - Импорт контент-плана из Google Sheets
   - Генерация писем через AI
   - Просмотр черновиков

---

### Уровень 2: Backend Functions (Cloud Functions)

**Язык:** Python 3.11 (для работы с БД и AI)

**Структура backend:**
```
backend/
├── func2url.json                    # Маппинг функций → URLs (автоген)
├── events-manager/                  # Главная функция управления
│   ├── index.py
│   ├── tests.json
│   └── requirements.txt
├── generate-email/                  # Старая генерация (V1)
│   ├── index.py
│   └── requirements.txt
├── generate-drafts-v2/              # Новая генерация через слоты (V2)
│   ├── index.py
│   └── requirements.txt
├── template-generator/              # Рендеринг шаблонов
│   ├── index.py
│   └── requirements.txt
├── index-knowledge/                 # Индексация базы знаний
│   ├── index.py
│   └── requirements.txt
└── google-docs-reader/              # Чтение Google Docs
    ├── index.py
    └── requirements.txt
```

---

### Уровень 3: База данных (PostgreSQL)

**Схема:** `t_p22819116_event_schedule_app`

**Основные таблицы:**

#### 1. `events` - Мероприятия
```sql
CREATE TABLE events (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,                    -- Название события
    program_doc_id VARCHAR(255),                   -- ID Google Sheets с программой
    pain_doc_id VARCHAR(255),                      -- ID Google Doc с болями ЦА
    default_tone VARCHAR(50) DEFAULT 'professional', -- Тон письма
    email_template_examples TEXT,                  -- Примеры стиля писем
    logo_url TEXT,                                 -- URL логотипа
    cta_base_url TEXT,                             -- Базовая CTA ссылка
    use_v2_pipeline BOOLEAN DEFAULT false,         -- Флаг новой системы V2
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 2. `event_mailing_lists` - Списки рассылки
```sql
CREATE TABLE event_mailing_lists (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES events(id),
    unisender_list_id VARCHAR(255),                -- ID списка в UniSender
    unisender_list_name VARCHAR(255),
    content_type_ids INTEGER[],                    -- ID типов контента для списка
    content_type_order JSONB DEFAULT '[]',         -- Порядок типов
    ai_provider VARCHAR(50) DEFAULT 'openai',      -- openai | openrouter
    ai_model VARCHAR(100) DEFAULT 'gpt-4o-mini',
    demo_mode BOOLEAN DEFAULT false,
    schedule_type VARCHAR(50) DEFAULT 'manual',
    sender_email VARCHAR(255),
    sender_name VARCHAR(255) DEFAULT 'HR Team',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 3. `content_types` - Типы контента писем
```sql
CREATE TABLE content_types (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES events(id),
    name VARCHAR(255) NOT NULL,                    -- Название типа (Анонс, Напоминание)
    description TEXT,                              -- Описание для AI
    cta_urls JSONB DEFAULT '[]',                   -- [{label, url}]
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 4. `email_templates` - Шаблоны писем
```sql
CREATE TABLE email_templates (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES events(id),
    content_type_id INTEGER REFERENCES content_types(id),
    name VARCHAR(255) NOT NULL,
    html_template TEXT,                            -- HTML с {переменными} для V1
    html_layout TEXT,                              -- HTML макет для V2
    slots_schema JSONB,                            -- Схема слотов для V2
    subject_template VARCHAR(500),
    instructions TEXT,                             -- Инструкции для AI
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 5. `generated_emails` - Сгенерированные письма
```sql
CREATE TABLE generated_emails (
    id SERIAL PRIMARY KEY,
    event_list_id INTEGER REFERENCES event_mailing_lists(id),
    content_type_id INTEGER REFERENCES content_types(id),
    subject VARCHAR(500) NOT NULL,                 -- Тема письма
    html_content TEXT NOT NULL,                    -- HTML письма
    status VARCHAR(50) DEFAULT 'draft',            -- draft | sent | scheduled
    unisender_campaign_id VARCHAR(255),
    sent_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 6. `knowledge_store` - База знаний
```sql
CREATE TABLE knowledge_store (
    id SERIAL PRIMARY KEY,
    event_id INTEGER REFERENCES events(id),
    item_type VARCHAR(100),                        -- program_item | pain_point | style_snippet
    content TEXT NOT NULL,                         -- Текст записи
    metadata JSONB,                                -- Доп. данные
    embedding VECTOR(1536),                        -- Векторное представление (опционально)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 🔄 Workflow системы

### 1️⃣ Подготовка данных (Администратор)

```
1. Создать мероприятие (EventsManager)
   ↓
2. Указать Google Sheets с программой
   ↓
3. Указать Google Doc с болями ЦА
   ↓
4. Создать типы контента (Анонс, Напоминание, Итоги)
   ↓
5. Создать шаблоны для каждого типа
   ↓
6. Настроить список рассылки + выбрать типы контента
```

### 2️⃣ Генерация писем (Маркетолог)

```
1. Открыть диалог "Загрузить контент-план"
   ↓
2. Вставить ссылку на Google Sheets с темами писем
   ↓
3. Выбрать список рассылки
   ↓
4. Нажать "Загрузить превью" → система парсит таблицу
   ↓
5. Нажать "Сгенерировать все" → для каждой строки:
      ├─ Вызов backend/events-manager (action=generate_single_email)
      ├─ AI читает программу + боли + шаблон
      ├─ Генерирует HTML письмо
      └─ Сохраняет в generated_emails
   ↓
6. Просмотр черновиков → редактирование → отправка
```

---

## 🤖 Backend Functions - Детальное описание

### **events-manager** (главная функция)

**URL:** `https://functions.poehali.dev/b56e5895-fb22-4d96-b746-b046a9fd2750`

**Методы:**

#### GET `/?action=list_events`
Возвращает список всех мероприятий
```json
{
  "events": [
    {"id": 1, "name": "HR Conference 2024", ...}
  ]
}
```

#### POST `/?action=create_event`
Создаёт новое мероприятие
```json
{
  "action": "create_event",
  "name": "Conference Name",
  "program_doc_id": "1abc...",
  "pain_doc_id": "2def...",
  "default_tone": "professional"
}
```

#### POST `/?action=create_content_types`
Создаёт типы контента автоматически
```json
{
  "action": "create_content_types",
  "event_id": 1,
  "type_names": ["Анонс", "Напоминание", "Итоги"]
}
```

#### POST `/?action=generate_single_email`
**КЛЮЧЕВОЙ МЕТОД** - Генерирует одно письмо из контент-плана

**Request:**
```json
{
  "action": "generate_single_email",
  "event_id": 1,
  "event_list_id": 5,
  "title": "Тема письма из контент-плана",
  "content_type": "Анонс"
}
```

**Response:**
```json
{
  "success": true,
  "email_id": 42,
  "subject": "Сгенерированная тема письма",
  "message": "Email created successfully"
}
```

**Логика работы:**
```python
1. Получить event_id, event_list_id, title, content_type
2. Проверить существование мероприятия
3. Прочитать program_doc_id → парсинг программы
4. Прочитать pain_doc_id → парсинг болей ЦА
5. Найти content_type_id по имени
6. Проверить дубликаты (subject уже существует?)
7. Если дубликат → return {skipped: true}
8. Получить шаблон (html_template, instructions)
9. Сформировать промпт для AI:
   - Контекст мероприятия (название, дата, место)
   - Программа (первые 3000 символов)
   - Боли ЦА (первые 2000 символов)
   - Тема письма (title)
   - Инструкции из типа контента
10. Вызвать OpenAI/OpenRouter API
11. Парсинг JSON ответа: {subject, html}
12. Подстановка UTM-меток в CTA ссылки
13. Вставка в таблицу generated_emails
14. Return {success: true, email_id: X}
```

---

### **generate-drafts-v2** (новая система)

**URL:** `https://functions.poehali.dev/90b50454-3ef3-4d5f-add1-e22941c980f4`

**Отличие от V1:**
- V1: AI заполняет плейсхолдеры {pain_points}, {program_topics}
- V2: AI заполняет структурированные слоты (intro, speakers, cta)

**Request:**
```json
{
  "event_id": 1,
  "content_type_id": 3,
  "content_plan_item_id": null
}
```

**Работает только если:**
```sql
SELECT use_v2_pipeline FROM events WHERE id = 1;
-- Должно вернуть true
```

**Схема слотов (slots_schema):**
```json
{
  "intro": {
    "type": "text",
    "max_length": 300,
    "instruction": "Напиши вступление с крючком"
  },
  "speakers": {
    "type": "array",
    "max_items": 3,
    "item_schema": {
      "name": "string",
      "job": "string",
      "company": "string",
      "topic": "string"
    }
  },
  "cta": {
    "type": "object",
    "fields": {
      "text": "string",
      "url": "string"
    }
  }
}
```

---

### **template-generator** (рендеринг)

**URL:** `https://functions.poehali.dev/616d6890-24c3-49c8-8b29-692dd342933b`

**Request:**
```json
{
  "template_html": "<html>{{intro}}<ul>{{#speakers}}<li>{{name}}</li>{{/speakers}}</ul></html>",
  "data": {
    "intro": "Текст вступления",
    "speakers": [
      {"name": "Иван Иванов", "job": "CTO", "company": "Компания"}
    ]
  },
  "test_mode": true
}
```

**Response:**
```json
{
  "rendered_html": "<html>Текст вступления<ul><li>Иван Иванов</li></ul></html>"
}
```

---

### **index-knowledge** (индексация)

**URL:** `https://functions.poehali.dev/814ac16e-cb58-4603-b3af-4b6f9215fb05`

**Задача:** Парсит Google Sheets и сохраняет в knowledge_store

**Request:**
```json
{
  "event_id": 1,
  "program_doc_id": "1abc...",
  "pain_doc_id": "2def..."
}
```

**Логика:**
```python
1. Прочитать Google Sheets (программа)
2. Парсинг спикеров:
   "Светлана Бойко, HRD IT, Кворум {ОЦЕНКА ПЕРСОНАЛА}"
   → Извлечь: name, job, company, topic
3. Сохранить как item_type='program_item'
4. Прочитать Google Doc (боли ЦА)
5. Разбить на абзацы
6. Сохранить как item_type='pain_point'
7. Вернуть статистику: {indexed_items: 27}
```

---

## 🎨 Frontend Components

### ContentPlanDialog.tsx

**Назначение:** Диалоговое окно для импорта контент-плана

**Props:**
```typescript
interface ContentPlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: Event;
  mailingLists: MailingList[];
  contentTypes: ContentType[];
  onUpdate: () => void;
}
```

**Состояние:**
```typescript
const [contentPlanUrl, setContentPlanUrl] = useState(''); // Ссылка на Google Sheets
const [selectedListId, setSelectedListId] = useState<string>(''); // Список рассылки
const [preview, setPreview] = useState<ContentPlanRow[]>([]); // Превью писем
const [showPreview, setShowPreview] = useState(false);
const [generatingProgress, setGeneratingProgress] = useState<{
  current: number, 
  total: number, 
  status: string
} | null>(null);
```

**Методы:**

1. **handleLoadPreview()**
```typescript
// Загружает превью контент-плана
const extractDocId = (url: string) => {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
};

const response = await fetch(
  `${EVENTS_MANAGER_URL}?action=preview_content_plan&doc_id=${docId}`
);
const data = await response.json();
setPreview(data.rows); // [{title: "...", content_type: "Анонс"}]
```

2. **handleGenerateAll()**
```typescript
// Генерирует все письма последовательно
for (let i = 0; i < preview.length; i++) {
  const item = preview[i];
  
  setGeneratingProgress({ 
    current: i, 
    total: preview.length, 
    status: `Генерируем: ${item.title}` 
  });
  
  const response = await fetch(EVENTS_MANAGER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'generate_single_email',
      event_id: event.id,
      event_list_id: parseInt(selectedListId),
      title: item.title,
      content_type: item.content_type
    })
  });
  
  const data = await response.json();
  
  if (data.error === 'missing_content_type') {
    // Создать тип контента автоматически
    await handleCreateMissingTypes([item.content_type]);
  } else if (data.skipped) {
    skippedCount++;
  } else {
    successCount++;
  }
}

toast.success(`Создано ${successCount} писем`);
```

---

## 🔐 Secrets (Переменные окружения)

**Для backend functions:**

| Секрет | Описание | Формат |
|--------|----------|--------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `OPENAI_API_KEY` | OpenAI API ключ | `sk-...` |
| `OPENROUTER_API_KEY` | OpenRouter API ключ | `sk-or-v1-...` |
| `GOOGLE_API_KEY` | Google Docs API ключ (опционально) | `AIza...` |
| `UNISENDER_API_KEY` | UniSender API ключ (опционально) | `abc123...` |
| `TELEGRAM_BOT_TOKEN` | Telegram бот токен (опционально) | `123456:ABC-DEF...` |

**Где используются:**
```python
# backend/events-manager/index.py
db_url = os.environ.get('DATABASE_URL')
openai_key = os.environ.get('OPENAI_API_KEY')
openrouter_key = os.environ.get('OPENROUTER_API_KEY')

if openrouter_key:
    api_url = 'https://openrouter.ai/api/v1/chat/completions'
    api_key = openrouter_key
elif openai_key:
    api_url = 'https://api.openai.com/v1/chat/completions'
    api_key = openai_key
```

---

## 📝 Формат контент-плана (Google Sheets)

**Ожидаемая структура таблицы:**

| Заголовок письма | Тип контента | Дата отправки (опционально) |
|------------------|--------------|----------------------------|
| 5 трендов в HR 2024 | Анонс | 2024-03-15 |
| Напоминание: осталось 3 дня | Напоминание | 2024-03-20 |
| Итоги конференции | Итоги | 2024-03-25 |

**Парсинг:**
```python
for line in content_plan_text.split('\n'):
    parts = line.split('\t')
    if len(parts) >= 2:
        title = parts[0].strip()
        content_type_name = parts[1].strip()
        
        rows.append({
            'title': title,
            'content_type': content_type_name
        })
```

---

## 🚀 Деплой и запуск

### 1. Установка зависимостей

**Frontend:**
```bash
npm install
# или
bun install
```

**Backend (автоматически при deploy):**
```bash
cd backend/events-manager
pip install -r requirements.txt
```

### 2. Настройка секретов

```bash
# Добавить через UI poehali.dev или через CLI
put_secret(name='DATABASE_URL', description='PostgreSQL connection string')
put_secret(name='OPENAI_API_KEY', description='OpenAI API key for content generation')
put_secret(name='OPENROUTER_API_KEY', description='OpenRouter API key (alternative to OpenAI)')
```

### 3. Создание таблиц БД

**Выполнить миграции:**
```sql
-- См. секцию "База данных" выше
-- Создать все таблицы через migrate_db() или напрямую в PostgreSQL
```

### 4. Деплой backend functions

```bash
# Автоматически через poehali.dev
sync_backend()

# Результат:
# events-manager → https://functions.poehali.dev/b56e5895-fb22-4d96-b746-b046a9fd2750
# generate-drafts-v2 → https://functions.poehali.dev/90b50454-3ef3-4d5f-add1-e22941c980f4
# ...
```

### 5. Запуск frontend

```bash
npm run dev
# → http://localhost:5173
```

---

## 🧪 Тестирование

### Backend тесты (tests.json)

**events-manager/tests.json:**
```json
{
  "tests": [
    {
      "name": "OPTIONS request for CORS",
      "method": "OPTIONS",
      "path": "/",
      "expectedStatus": 200
    },
    {
      "name": "Get events list",
      "method": "GET",
      "path": "/?action=list_events",
      "expectedStatus": 200
    }
  ]
}
```

**Запуск:**
```bash
# Автоматически при sync_backend()
# Результат в консоли: ✅ 2/2 tests passed
```

### Frontend тесты

```typescript
// Пример unit теста для ContentPlanDialog
import { render, screen, fireEvent } from '@testing-library/react';
import ContentPlanDialog from './ContentPlanDialog';

test('loads preview when valid URL provided', async () => {
  render(<ContentPlanDialog {...props} />);
  
  const input = screen.getByPlaceholderText('Ссылка на Google Sheets');
  fireEvent.change(input, { value: 'https://docs.google.com/spreadsheets/d/1abc...' });
  
  const button = screen.getByText('Загрузить превью');
  fireEvent.click(button);
  
  await screen.findByText(/Загружено \d+ писем/);
});
```

---

## 🐛 Debugging

### Логи backend

```python
# В любой функции
print(f'[DEBUG] Variable value: {variable}')

# Просмотр логов
get_logs(source='backend/events-manager', limit=100)
```

### Логи frontend

```typescript
console.log('[ContentPlan] Generating emails:', preview);

// Просмотр логов
get_logs(source='frontend', limit=100)
```

### Частые проблемы

**1. Ошибка: "missing_content_type"**
```
Решение: Создать тип контента через action=create_content_types
или автоматически в handleCreateMissingTypes()
```

**2. Ошибка: "OPENAI_API_KEY not configured"**
```
Решение: Добавить секрет через put_secret()
```

**3. Ошибка: "Template not found"**
```
Решение: Создать шаблон для content_type_id через 
action=create_email_template
```

**4. Дубликаты писем (skipped: true)**
```
Это нормально! Система не создаёт письма с одинаковым subject
для одного списка рассылки
```

---

## 📚 Примеры использования

### Создание мероприятия с нуля

```typescript
// 1. Создать событие
const response = await fetch(EVENTS_MANAGER_URL, {
  method: 'POST',
  body: JSON.stringify({
    action: 'create_event',
    name: 'HR Conference 2024',
    program_doc_id: '1abc...',
    pain_doc_id: '2def...',
    default_tone: 'professional'
  })
});

// 2. Создать типы контента
await fetch(EVENTS_MANAGER_URL, {
  method: 'POST',
  body: JSON.stringify({
    action: 'create_content_types',
    event_id: 1,
    type_names: ['Анонс', 'Напоминание', 'Итоги']
  })
});

// 3. Создать шаблоны (для каждого типа)
await fetch(EVENTS_MANAGER_URL, {
  method: 'POST',
  body: JSON.stringify({
    action: 'create_email_template',
    event_id: 1,
    content_type_id: 1,
    name: 'Шаблон анонса',
    html_template: '<html>...<body>{intro}</body></html>',
    subject_template: '{subject}',
    instructions: 'Создай анонс мероприятия с акцентом на пользу для участников'
  })
});

// 4. Создать список рассылки
await fetch(EVENTS_MANAGER_URL, {
  method: 'POST',
  body: JSON.stringify({
    action: 'create_mailing_list',
    event_id: 1,
    unisender_list_id: '12345',
    unisender_list_name: 'HR Подписчики',
    content_type_ids: [1, 2, 3]
  })
});

// 5. Загрузить контент-план и сгенерировать
// (через ContentPlanDialog UI)
```

---

## 🔄 Миграция на новую V2 систему

**Когда использовать V2:**
- Нужна более гибкая структура письма
- Требуется раздельное редактирование блоков
- Важна консистентность стиля

**Миграция:**
```sql
-- 1. Включить V2 для мероприятия
UPDATE events SET use_v2_pipeline = true WHERE id = 1;

-- 2. Обновить шаблоны: добавить html_layout и slots_schema
UPDATE email_templates 
SET 
  html_layout = '<html>...<div data-slot="intro"></div>...</html>',
  slots_schema = '{"intro": {"type": "text", "max_length": 300}}'
WHERE event_id = 1;

-- 3. Использовать generate-drafts-v2 вместо generate-email
```

---

## 📊 Метрики и аналитика

**Отслеживание:**
- Количество сгенерированных писем
- Время генерации (в логах)
- Успешность отправок (email_stats)
- UTM-метки для трекинга переходов

**Пример запроса:**
```sql
SELECT 
  ct.name as content_type,
  COUNT(*) as total_emails,
  COUNT(CASE WHEN ge.status = 'sent' THEN 1 END) as sent,
  COUNT(CASE WHEN ge.status = 'draft' THEN 1 END) as drafts
FROM generated_emails ge
JOIN content_types ct ON ct.id = ge.content_type_id
WHERE ge.event_list_id = 5
GROUP BY ct.name;
```

---

## 🎓 Best Practices

### 1. Структура промптов для AI

**Хороший промпт:**
```python
prompt = f"""
КОНТЕКСТ: {event_name}, {event_date}
ЦЕЛЕВАЯ АУДИТОРИЯ: {pain_points[:2000]}
ПРОГРАММА: {program_text[:3000]}
ЗАДАЧА: Создай письмо на тему "{title}"
ТОН: {tone_description}

ТРЕБОВАНИЯ:
1. Крючок в первых 2 строках
2. Конкретные спикеры из программы
3. CTA кнопка с действием
4. Длина: 400-600 слов

ФОРМАТ ОТВЕТА (JSON):
{{"subject": "...", "html": "..."}}
"""
```

### 2. Оптимизация производительности

```python
# Использовать connection pooling
conn = psycopg2.connect(db_url)

# Batch inserts вместоループов
cur.executemany('''
  INSERT INTO generated_emails (subject, html_content) 
  VALUES (%s, %s)
''', [(s, h) for s, h in emails])

# Кэширование программы/болей между запросами
```

### 3. Обработка ошибок

```python
try:
    email_data = json.loads(content)
except json.JSONDecodeError:
    # Fallback: очистка от markdown
    import re
    content = re.sub(r'```json\s*', '', content)
    content = re.sub(r'```\s*$', '', content)
    email_data = json.loads(content)
```

---

## 📖 Дополнительные ресурсы

- **API документация OpenAI:** https://platform.openai.com/docs
- **PostgreSQL Simple Query Protocol:** https://www.postgresql.org/docs/current/protocol-flow.html
- **React Router v6:** https://reactrouter.com/en/main
- **shadcn/ui components:** https://ui.shadcn.com

---

## 📞 Поддержка

При возникновении вопросов:
1. Проверить логи backend: `get_logs(source='backend/events-manager')`
2. Проверить логи frontend: `get_logs(source='frontend')`
3. Проверить схему БД: `get_db_info(level='table', table_name='...')`
4. Создать issue с описанием проблемы + логами

---

---

## 🆕 V2 System Upgrade (2025-11-02)

### Новые возможности:

**1. RAG (Retrieval-Augmented Generation)**
- Векторный поиск по базе знаний через pgvector
- Автоматический подбор релевантного контента по теме письма
- Embeddings через `text-embedding-3-small` (1536 dim)

**2. Идемпотентность генерации**
- Таблица `content_plan_items` — единый источник истины
- Уникальный индекс `(event_list_id, content_plan_item_id)` предотвращает дубли
- Hash-based проверка изменений контента

**3. Система аппрувов**
- Таблица `approvals` для согласования писем
- Токены для approve/reject через Telegram/Web
- Отслеживание статусов: pending → approved → sent

**4. Email Events Tracking**
- Таблица `email_events` для webhooks ESP
- Отслеживание: delivered, open, click, bounce, spam, unsubscribe
- Метрики для A/B тестирования

**5. Брендирование списков рассылки**
- `accent_color` — акцентный цвет кнопок (default: #BB35E0)
- `footer_text` — кастомный футер
- `logo_url_override` — переопределение логотипа

### Как применить миграцию:

```sql
-- Выполнить вручную в PostgreSQL:
-- 1. Включить расширения
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Применить SQL из db_migrations/V1__add_v2_columns_2025_11_02.sql
```

### JSON Schemas для V2:

Смотри `/backend/v2_schemas/`:
- `v2_slots_schema.json` — структура слотов письма
- `v2_model_output_schema.json` — формат ответа AI
- `README.md` — примеры использования

---

**Дата последнего обновления:** 2025-11-02  
**Версия системы:** 2.1 (V2 с RAG, идемпотентностью и аппрувами)