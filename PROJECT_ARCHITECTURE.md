# Event Marketing Automation Platform - Архитектура

> **ВАЖНО ДЛЯ РАЗРАБОТКИ:** Этот документ описывает критичную логику проекта.  
> Всегда обращайся к нему перед изменениями в генерации писем или работе с AI.

## 📋 Оглавление

- [Архитектура проекта](#архитектура-проекта)
- [База данных](#база-данных)
- [Backend функции](#backend-функции)
- [Критичная логика](#критичная-логика)
- [Workflow генерации писем](#workflow-генерации-писем)
- [Частые кейсы](#частые-кейсы)

---

## 🏗 Архитектура проекта

### Stack
- **Frontend**: React + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **Backend**: Cloud Functions (Python 3.11)
- **Database**: PostgreSQL (Simple Query Protocol only)
- **AI**: OpenAI GPT-4o-mini / OpenRouter

### Структура
```
event-schedule-app/
├── src/                    # Frontend React приложение
│   ├── pages/             # Страницы приложения
│   │   ├── EventsManager.tsx      # Управление мероприятиями
│   │   ├── CampaignManager.tsx    # Управление рассылками
│   │   ├── CampaignHistory.tsx    # История отправок
│   │   └── AISettings.tsx         # Настройки AI
│   └── components/        # React компоненты
├── backend/               # Cloud Functions
│   ├── events-manager/    # API для управления событиями и генерации писем
│   ├── campaign-manager/  # Управление кампаниями
│   ├── google-docs-reader/# Чтение данных из Google Docs
│   ├── unisender-manager/ # Интеграция с UniSender
│   └── sync-events-unisender/ # Синхронизация с UniSender
└── db_migrations/         # SQL миграции базы данных
```

---

## 🗄 База данных

### Основные таблицы

#### `events` - Мероприятия
```sql
- id, name, description
- start_date, end_date
- program_doc_id       # URL Google Sheets с программой
- pain_doc_id          # URL Google Doc с болями аудитории
- default_tone         # Тон писем (friendly/professional/etc)
- logo_url
- email_template_examples
```

#### `content_types` - Типы контента писем
```sql
- id, event_id, name
- description
Примеры: "Анонс", "Продажа через боль", "Полезный контент"
```

#### `email_templates` - Шаблоны писем
```sql
- id, event_id, content_type_id
- name                 # Название шаблона
- html_template        # HTML с плейсхолдерами {pain_points}, {program_topics}
- subject_template     # Шаблон темы письма
- instructions         # ⚠️ КРИТИЧНО: Промпт для AI (что и как генерировать)
```

**⚠️ ВАЖНО про `instructions`:**
Это НЕ просто описание. Это полноценный промпт для AI-ассистента:
- Какой тон использовать (дружелюбный/профессиональный)
- Какую структуру письма создать
- Сколько спикеров выбрать (1-3 / 2-4)
- Какие боли релевантны для этого типа контента
- Примеры хороших/плохих тем письма

#### `event_mailing_lists` - Списки рассылки
```sql
- id, event_id, name
- content_type_ids     # Массив ID типов контента для автогенерации
- content_plan_doc_id  # URL Google Doc с контент-планом
- ai_provider, ai_model, ai_assistant_id
- unisender_list_id
```

#### `generated_emails` - Сгенерированные письма
```sql
- id, event_list_id, content_type_id
- subject, html_content
- title                # Заголовок из контент-плана (для проверки дублей)
- status              # draft / approved / sent
- campaign_id         # ID кампании в UniSender (после отправки)
```

#### `email_campaigns` - История кампаний
```sql
- id, event_list_id, generated_email_id
- unisender_campaign_id, status
- sent_at, recipients_count
- opens_count, clicks_count
```

---

## ⚙️ Backend функции

### `events-manager` (Python)
**Основная функция управления событиями и генерацией писем**

URL: https://functions.poehali.dev/b56e5895-fb22-4d96-b746-b046a9fd2750

#### Endpoints:

**GET ?action=list_events**
- Получить список всех мероприятий

**GET ?action=get_event&event_id=1**
- Получить детали мероприятия

**POST action=generate_drafts**
```json
{
  "list_id": 1
}
```
- ⚠️ ГЕНЕРАЦИЯ ЧЕРНОВИКОВ через AI
- **НЕ проверяет дубли** (можно генерировать бесконечно)
- Для каждого типа контента из `content_type_ids`:
  1. Читает `instructions` из `email_templates`
  2. AI выбирает релевантный контент (боли + спикеры)
  3. Вставляет в готовый `html_template`

**POST action=generate_from_content_plan**
```json
{
  "event_list_id": 1
}
```
- Генерация из контент-плана (фиксированные заголовки)
- ✅ **ПРОВЕРЯЕТ ДУБЛИ** по полю `title`
- Пропускает письма с одинаковыми заголовками
- Возвращает: `{generated_count, skipped_count, message}`

**GET ?action=get_drafts&list_id=1**
- Получить все черновики для списка

**POST action=create_content_types**
- Создать типы контента

---

## 🚨 Критичная логика

### ⚠️ ВАЖНО: Две разные логики генерации

#### 1. **generate_drafts** - AI генерация БЕЗ проверки дублей
```python
# ❌ НЕ проверяет дубли!
# ✅ AI создаёт уникальный контент каждый раз
# ✅ Можно генерировать сколько угодно раз

for content_type_id in content_type_ids:
    # Получаем промпт из настроек
    instructions = email_templates[content_type_id]['instructions']
    
    # AI получает:
    # - instructions (промпт из настроек: что генерировать, какой тон)
    # - program_text (Google Sheets с программой мероприятия)
    # - pain_points_text (Google Doc с болями и запросами аудитории)
    
    # AI анализирует и выбирает релевантный контент
    ai_result = call_openai({
        "subject": "Цепляющая тема письма",
        "pain_points": "1-2 релевантных боли с реальными цитатами",
        "program_topics": "2-4 спикера с описанием их тем"
    })
    
    # Подставляем AI-контент в готовый HTML-шаблон
    html = html_template.replace('{pain_points}', ai_result['pain_points'])
    html = html.replace('{program_topics}', ai_result['program_topics'])
    
    INSERT INTO generated_emails (subject, html_content, status='draft')
```

**Повторный запуск:** создаст новые письма с другим контентом

#### 2. **generate_from_content_plan** - Генерация из плана С проверкой дублей
```python
# ✅ ПРОВЕРЯЕТ дубли по заголовку!
# ✅ Пропускает письма с одинаковыми заголовками
# ✅ Идемпотентная операция

content_plan = read_google_doc(content_plan_doc_id)
# Формат: "Заголовок\tТип контента"
# Пример: "1. ООО НИЦ ФАРМОБОРОНА, Светлана М: Хотела узнать...\tАнонс"

generated_count = 0
skipped_count = 0

for row in content_plan:
    title = row['title']  # "1. ООО НИЦ ФАРМОБОРОНА, Светлана М: ..."
    content_type = row['content_type']  # "Анонс"
    
    # ⚠️ Проверка дубля по заголовку
    existing = SELECT * FROM generated_emails 
               WHERE event_list_id = ? AND title = ?
    
    if existing:
        skipped_count += 1
        continue  # Пропускаем
    
    # AI генерирует на основе этого конкретного заголовка
    ai_result = call_openai(title, content_type, instructions)
    
    INSERT INTO generated_emails (
        title,           # ← Сохраняем для проверки дублей
        subject, 
        html_content
    )
    generated_count += 1

return {
    'generated_count': generated_count,
    'skipped_count': skipped_count,
    'message': f'Создано {generated_count} писем, пропущено дублей: {skipped_count}'
}
```

**Повторный запуск:** пропустит существующие, создаст только новые

---

### ⚠️ ВАЖНО: Как работает AI

**AI НЕ генерирует HTML с нуля!**

AI выполняет роль **контент-редактора**:
1. Читает `instructions` (что нужно создать)
2. Анализирует программу (1500+ строк)
3. Анализирует боли аудитории (500+ цитат)
4. **Выбирает релевантный контент**
5. Возвращает JSON с подготовленными фрагментами
6. Фрагменты вставляются в готовый `html_template`

**Промпт для AI:**
```python
user_prompt = f"""Ты — email-маркетолог конференции. 
Твоя задача — выбрать подходящий контент для письма.

ИНСТРУКЦИИ:
{instructions}  # Из email_templates - полный промпт!

ПРОГРАММА МЕРОПРИЯТИЯ (спикеры, темы, время):
{program_text[:20000]}

БОЛИ И ЗАПРОСЫ АУДИТОРИИ:
{pain_points_text[:20000]}

ЗАДАЧА:
1. Прочитай ИНСТРУКЦИИ — там описано, какой тип письма нужен
2. Выбери из ПРОГРАММЫ 2-4 релевантных спикера/темы
3. Выбери из БОЛЕЙ 1-3 реальных цитаты (конкретные фразы людей!)
4. Придумай цепляющую тему письма

ВЕРНИ СТРОГО JSON:
{{
  "subject": "Тема письма (живая, без клише)",
  "pain_points": "1-2 параграфа с болями аудитории",
  "program_topics": "Список из 2-4 спикеров с кратким описанием"
}}

НЕ пиши HTML, НЕ добавляй лишнего — только JSON.
"""
```

**Ответ AI (пример):**
```json
{
  "subject": "Как удерживать сотрудников, когда денег на премии нет",
  "pain_points": "Светлана из ООО НИЦ ФАРМОБОРОНА: \"Вот программу вы посмотрели, но на что глаз упал? Какие задачи решаете по обучению в компании?\" Карина Кузина, HR BP: \"Вот, что вам из этих всех тематик наиболее близко? В обучении, может быть, что больше всего понравилось?\"",
  "program_topics": "🎯 Юлия Бугинова (Ozon) — Как создать обучение за 2 часа с помощью AI\n🎯 Мария Иванова (Яндекс) — Геймификация в процессе найма\n🎯 Дмитрий Сидоров (Сбер) — Адаптация поколения Z без премий"
}
```

**Далее:**
```python
html = html_template.replace('{pain_points}', ai_result['pain_points'])
html = html.replace('{program_topics}', ai_result['program_topics'])
```

---

### ⚠️ ВАЖНО: HTML шаблоны

В `email_templates.html_template` используются плейсхолдеры:
- `{pain_points}` - AI выбирает 1-3 боли из документа
- `{program_topics}` - AI выбирает 2-4 спикера из программы

**Пример шаблона:**
```html
<table width="600" cellpadding="0" cellspacing="0">
  <tr>
    <td style="padding: 30px 40px; font-size: 16px;">
      Здравствуйте,<br><br>
      {pain_points}
    </td>
  </tr>
  
  <tr>
    <td style="padding: 20px 40px; font-weight: bold;">
      На конференции Human говорим о решениях этих задач:
    </td>
  </tr>
  
  <tr>
    <td style="padding: 20px 40px;">
      {program_topics}
    </td>
  </tr>
  
  <tr>
    <td align="center" style="padding: 30px 40px;">
      <a href="#" style="background-color: #AE32E3; color: #fff; padding: 12px 28px;">
        Посмотреть программу
      </a>
    </td>
  </tr>
</table>
```

**❌ НЕПРАВИЛЬНО:**
```python
# Вставка ВСЕГО текста болей
html = html_template.replace('{pain_points}', pain_points_text)
# Результат: 50000 символов болей в одном письме!
```

**✅ ПРАВИЛЬНО:**
```python
# AI выбирает 1-3 боли
ai_result = call_openai(instructions, program_text, pain_points_text)
html = html_template.replace('{pain_points}', ai_result['pain_points'])
# Результат: 2-3 параграфа релевантного контента
```

---

## 🔄 Workflow генерации писем

### Сценарий 1: Генерация черновиков (множественная)

```
1. Пользователь открывает список рассылки (ID=3)
2. В настройках списка выбраны типы: [1:"Анонс", 3:"Продажа через боль"]
3. Нажимает "Сгенерировать черновики"

4. Frontend → POST /events-manager
   {
     "action": "generate_drafts",
     "list_id": 3
   }

5. Backend:
   ✓ Читает event_mailing_lists (ID=3)
   ✓ Получает content_type_ids = [1, 3]
   ✓ Читает program_doc_id и pain_doc_id
   ✓ Загружает программу из Google Sheets
   ✓ Загружает боли из Google Doc
   
   Для content_type_id = 1:
     ✓ SELECT instructions FROM email_templates WHERE content_type_id=1
     ✓ Вызов AI с промптом (instructions + программа + боли)
     ✓ AI возвращает: {subject, pain_points, program_topics}
     ✓ Подстановка в html_template
     ✓ INSERT в generated_emails (status='draft')
   
   Для content_type_id = 3:
     ✓ Аналогично...

6. Возвращает: {count: 2, message: "Создано 2 письма"}

7. Пользователь может снова нажать "Сгенерировать"
   → Создастся ещё 2 письма с ДРУГИМ контентом
```

**Можно генерировать бесконечно** → AI каждый раз выбирает разный контент.

### Сценарий 2: Генерация из контент-плана (разовая)

```
1. Пользователь создаёт Google Doc с контент-планом:
   
   Заголовок	Тип контента
   1. ООО НИЦ ФАРМОБОРОНА, Светлана М: Хотела узнать...	Анонс
   2. Карина Кузина, HR BP: Вот, что вам из этих тематик...	Продажа через боль
   3. Ксения, PreventAge: Если честно, наверное...	Полезный контент

2. Указывает URL в content_plan_doc_id списка рассылки

3. Нажимает "Запустить генерацию из плана"

4. Frontend → POST /events-manager
   {
     "action": "generate_from_content_plan",
     "event_list_id": 3
   }

5. Backend:
   ✓ Читает content_plan_doc_id
   ✓ Парсит строки (заголовок\tтип)
   
   Для каждой строки:
     ✓ title = "1. ООО НИЦ ФАРМОБОРОНА, Светлана М: Хотела узнать..."
     ✓ content_type = "Анонс"
     
     ✓ SELECT * FROM generated_emails 
       WHERE event_list_id=3 AND title='{title}'
     
     Если НЕ найдено:
       ✓ AI генерация на основе этого заголовка
       ✓ INSERT в generated_emails (title, subject, html_content)
       ✓ generated_count++
     
     Если найдено:
       ✓ skipped_count++
       ✓ continue

6. Возвращает: 
   {
     generated_count: 3, 
     skipped_count: 0,
     message: "Создано 3 писем"
   }

7. Повторный запуск:
   → {generated_count: 0, skipped_count: 3, message: "Создано 0 писем, пропущено дублей: 3"}
```

---

## 📝 Частые кейсы

### ❓ Как добавить новый тип контента?

1. **Добавить в content_types:**
```sql
INSERT INTO content_types (event_id, name, description)
VALUES (1, 'Продажа через боль', 'Письмо с акцентом на боли клиентов');
```

2. **Создать шаблон в email_templates:**
```sql
INSERT INTO email_templates (
    event_id, 
    content_type_id, 
    name,
    html_template,  -- HTML с {pain_points} и {program_topics}
    subject_template,
    instructions    -- ⚠️ КРИТИЧНО! Полный промпт для AI
)
VALUES (
    1,
    5,
    'Продажа через боль',
    '<html>...</html>',
    '{pain_points} - Конференция Human',
    'Промт для AI-ассистента: «Сгенерируй email-письмо...»
    
    Инструкция:
    Ты — email-маркетолог в команде конференции Human.
    
    1. Цель письма: Привлечь переходы на лендинг
    2. Формат: Цепляющий инсайт (одна боль + 1-2 решения)
    3. Тема письма: Живо, без клише
       ✅ "Как удерживать сотрудников без денег"
       ❌ "Новая конференция по HR"
    4. Структура:
       - Вступление: Говорим на языке боли
       - Решение: Покажи спикера/трек
       - 1-3 спикера с кейсами
       - CTA: "Посмотреть программу"
    5. Тон: Дружелюбный, как от HR для HR'
);
```

3. **Добавить в список рассылки:**
```sql
UPDATE event_mailing_lists
SET content_type_ids = array_append(content_type_ids, 5)
WHERE id = 3;
```

### ❓ Как изменить логику генерации?

**Файл:** `backend/events-manager/index.py`

**Черновики (БЕЗ дублей):**
- Функция: `generate_drafts` (строка ~567)
- Что менять: промпт для AI, логика выбора контента

**Контент-план (С дублями):**
- Функция: `generate_from_content_plan` (строка ~750)
- Что менять: проверку дублей, парсинг контент-плана

### ❓ Почему AI вставляет все боли целиком?

**Проблема:** В коде написано
```python
html = html_template.replace('{pain_points}', pain_points_text)
```

**Решение:** AI должен **выбирать** контент:
```python
ai_result = call_openai(instructions, program_text, pain_points_text)
html = html_template.replace('{pain_points}', ai_result['pain_points'])
```

**Текущая реализация:** ✅ Исправлено (строка ~674 в events-manager/index.py)

### ❓ Как работают дубли?

**generate_drafts:**
- ❌ НЕ проверяет дубли
- Можно генерировать сколько угодно раз
- Каждый раз новый контент

**generate_from_content_plan:**
- ✅ Проверяет по полю `title`
- Повторный запуск → пропустит существующие
- `skipped_count` показывает количество дублей

---

## 🐛 Debugging

### Логи Backend

```bash
# Через get_logs tool в poehali.dev
source: "backend/events-manager"
limit: 100
```

**Ключевые сообщения:**
```
[AI_DRAFT] Generating draft using AI for content_type=1
  → Начало AI генерации

[SKIP] Draft already exists for list_id=3, content_type=1
  → Пропуск дубля (ТОЛЬКО в generate_from_content_plan!)

[ERROR] AI generation failed: JSONDecodeError - ...
  → Ошибка парсинга ответа AI

[CONTENT_PLAN] Generated 5 emails, skipped 3 duplicates
  → Результат generate_from_content_plan
```

### Frontend логи

```bash
source: "frontend"
```

### Проверка БД

```sql
-- Сколько черновиков создано?
SELECT COUNT(*) FROM generated_emails 
WHERE event_list_id = 3 AND status = 'draft';

-- Есть ли дубли по title?
SELECT title, COUNT(*) 
FROM generated_emails 
WHERE event_list_id = 3 
GROUP BY title 
HAVING COUNT(*) > 1;

-- Последние 5 писем
SELECT id, subject, status, created_at 
FROM generated_emails 
ORDER BY created_at DESC 
LIMIT 5;
```

---

## 🎯 Ключевые принципы (КРИТИЧНО!)

1. **AI - это редактор контента**, а не генератор HTML
   - AI выбирает 2-4 спикера из 200
   - AI выбирает 1-3 боли из 500
   - AI не пишет HTML с нуля

2. **HTML-шаблоны** живут в БД (`email_templates.html_template`)
   - Готовая вёрстка с плейсхолдерами
   - AI только заполняет `{pain_points}` и `{program_topics}`

3. **Instructions** - это промпт для AI
   - Обязательное поле в `email_templates`
   - Полное описание: цель, формат, тон, структура
   - Примеры хороших/плохих тем

4. **Дубли:**
   - `generate_drafts` - НЕ проверяет
   - `generate_from_content_plan` - проверяет по `title`

5. **Simple Query Protocol:**
   - PostgreSQL в проекте упрощённый
   - Используй только простые SQL-запросы
   - ❌ НЕ используй `$1`, `$2`, `%s` параметры
   - ✅ Используй прямую подстановку (с экранированием)

---

## 📚 Связанные файлы

- `backend/events-manager/index.py` - Основная логика генерации
- `backend/google-docs-reader/index.py` - Чтение Google Docs
- `src/pages/CampaignManager.tsx` - UI управления рассылками
- `db_migrations/V*.sql` - Структура БД

---

**Последнее обновление:** 2025-10-29  
**Версия документа:** 1.0
