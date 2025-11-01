# 🚀 Migration Guide: V1 → V2 System Upgrade

## Что нового в V2?

### 1️⃣ RAG (Retrieval-Augmented Generation)
**Было:** AI получает всю программу + боли целиком (до 5000 символов)  
**Стало:** Векторный поиск выбирает только релевантные куски под тему письма

**Преимущества:**
- Точнее подбор спикеров под тему
- Уменьшение токенов → дешевле
- Быстрее генерация

### 2️⃣ Идемпотентность
**Было:** Дубли проверялись по `subject` — одна опечатка = новое письмо  
**Стало:** Уникальный constraint на `(event_list_id, content_plan_item_id)`

**Преимущества:**
- Невозможно создать дубли
- Перезапуск генерации безопасен
- Hash-трекинг изменений контента

### 3️⃣ Approval Flow
**Было:** Письма сразу `draft` → `sent`  
**Стало:** `draft` → `pending approval` → `approved` → `sent`

**Преимущества:**
- Контроль качества перед отправкой
- Telegram/Web кнопки approve/reject
- История согласований

### 4️⃣ Email Events Tracking
**Было:** Только `sent_at` timestamp  
**Стало:** Полный трекинг через webhooks ESP

**Метрики:**
- delivered, open, click, bounce, spam, unsubscribe
- Время события + метаданные
- Связь с `message_id` от UniSender

### 5️⃣ Брендирование
**Было:** Логотип + CTA URL на уровне события  
**Стало:** Настройки на уровне списка рассылки

**Новые поля:**
- `accent_color` — цвет кнопок (#BB35E0 default)
- `footer_text` — кастомный футер
- `logo_url_override` — переопределить логотип события

---

## 📋 Checklist миграции

### Шаг 1: Backup базы данных
```bash
pg_dump -h your-host -U your-user your-db > backup_before_v2.sql
```

### Шаг 2: Применить SQL миграцию
```sql
-- Подключиться к PostgreSQL
psql -h your-host -U your-user your-db

-- Выполнить миграцию
\i db_migrations/V1__add_v2_columns_2025_11_02.sql
```

**Что добавится:**
- 3 новые таблицы: `content_plan_items`, `approvals`, `email_events`
- 10 новых колонок в существующих таблицах
- 5 новых индексов
- 7 триггеров для `updated_at`

### Шаг 3: Включить pgvector (опционально)
Для RAG нужно расширение pgvector:
```sql
-- На managed PostgreSQL (Яндекс Cloud, AWS RDS, etc.)
CREATE EXTENSION IF NOT EXISTS vector;

-- Проверить
SELECT * FROM pg_extension WHERE extname = 'vector';
```

Если расширение недоступно:
- RAG работать не будет
- Система fallback на старую логику (весь контент целиком)

### Шаг 4: Обновить secrets
Добавить новые переменные окружения:
```bash
# OpenRouter для обхода региональных ограничений
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_BASE=https://openrouter.ai/api/v1

# Модели для embeddings и chat
EMBED_MODEL=text-embedding-3-small  # 1536 dim
CHAT_MODEL=gpt-4o-mini
```

### Шаг 5: Индексация базы знаний
Для существующих событий нужно проиндексировать knowledge_store:
```sql
-- Проверить текущее состояние
SELECT 
  event_id, 
  COUNT(*) as total,
  COUNT(embedding) as with_embeddings
FROM knowledge_store 
GROUP BY event_id;

-- Если embeddings нет, вызвать index-knowledge
POST /backend/index-knowledge
{
  "event_id": 1,
  "force_reindex": true
}
```

### Шаг 6: Обновить backend функции
```bash
# Деплой обновлённых функций
sync_backend()

# Проверить версии
GET /backend/events-manager?action=version
```

### Шаг 7: Тестирование
```sql
-- 1. Создать тестовый content_plan_item
INSERT INTO content_plan_items (event_id, sheet_id, row_idx, title, content_type, hash_input)
VALUES (1, 'test', 1, 'Test Email', 'Анонс', 'hash123');

-- 2. Сгенерировать письмо
POST /backend/events-manager
{
  "action": "generate_single_email",
  "event_id": 1,
  "event_list_id": 5,
  "title": "Test Email",
  "content_type": "Анонс",
  "sheet_id": "test",
  "row_idx": 1
}

-- 3. Проверить результат
SELECT * FROM generated_emails WHERE content_plan_item_id IS NOT NULL;

-- 4. Попробовать повторно (должен вернуть skipped: true)
POST /backend/events-manager {...}  -- Same request
```

---

## 🔄 Обратная совместимость

**V1 функции продолжают работать:**
- `generate-email` — старая генерация без RAG
- `generate-drafts-v2` — генерация через slots (без идемпотентности)
- Все старые письма остаются в `generated_emails`

**Новые функции V2:**
- `events-manager` с `action=generate_single_email` — RAG + идемпотентность
- Автоматическая привязка к `content_plan_items`

**Можно работать параллельно:**
- Старые события используют V1
- Новые события используют V2
- Флаг `use_v2_pipeline` в таблице `events`

---

## 📊 Новые таблицы

### content_plan_items
**Назначение:** Единый источник истины для контент-плана

| Колонка | Тип | Описание |
|---------|-----|----------|
| id | BIGSERIAL | Primary key |
| event_id | BIGINT | FK на events |
| sheet_id | TEXT | ID Google Sheets |
| row_idx | INTEGER | Номер строки в таблице |
| title | TEXT | Тема письма |
| content_type | TEXT | Тип контента (Анонс, Напоминание) |
| planned_send_at | TIMESTAMP | Плановая дата отправки |
| hash_input | TEXT | Hash для отслеживания изменений |
| created_at | TIMESTAMP | Дата создания |
| updated_at | TIMESTAMP | Дата обновления |

**Unique constraint:** `(event_id, sheet_id, row_idx)`

### approvals
**Назначение:** Система согласования писем

| Колонка | Тип | Описание |
|---------|-----|----------|
| id | UUID | Primary key |
| email_id | BIGINT | FK на generated_emails |
| token | TEXT | Уникальный токен для approve/reject |
| state | TEXT | pending / approved / rejected |
| actor | TEXT | Кто согласовал |
| reason | TEXT | Комментарий при reject |
| created_at | TIMESTAMP | Дата создания |
| updated_at | TIMESTAMP | Дата обновления |

### email_events
**Назначение:** Трекинг событий ESP (webhooks)

| Колонка | Тип | Описание |
|---------|-----|----------|
| id | BIGSERIAL | Primary key |
| email_id | BIGINT | FK на generated_emails |
| message_id | TEXT | ID сообщения от ESP |
| event_type | TEXT | delivered / open / click / bounce / spam / unsubscribe |
| event_time | TIMESTAMP | Время события |
| meta | JSONB | Дополнительные данные (IP, user-agent, etc.) |

---

## 🔧 Новые колонки в существующих таблицах

### event_mailing_lists
```sql
accent_color VARCHAR(9) DEFAULT '#BB35E0'   -- Цвет кнопок
footer_text TEXT                             -- Кастомный футер
logo_url_override TEXT                       -- Переопределить логотип
```

### generated_emails
```sql
content_plan_item_id BIGINT                  -- FK на content_plan_items
unisender_message_id TEXT                    -- ID сообщения от UniSender
scheduled_at TIMESTAMP                       -- Плановая дата отправки
approved_by TEXT                             -- Кто одобрил
approved_at TIMESTAMP                        -- Когда одобрили
meta JSONB                                   -- Метаданные (slots, preheader, etc.)
hash_input TEXT                              -- Hash входных данных
```

### knowledge_store
```sql
embedding_model TEXT DEFAULT 'text-embedding-3-small'  -- Модель для embeddings
embedding_dim INT DEFAULT 1536                         -- Размерность вектора
```

---

## 🎯 Best Practices V2

### 1. Используйте content_plan_items
```python
# ❌ Плохо: генерация без привязки
generate_single_email(title="Test", content_type="Анонс")

# ✅ Хорошо: привязка к content_plan_item
generate_single_email(
    title="Test", 
    content_type="Анонс",
    sheet_id="1abc...",
    row_idx=5
)
```

### 2. Включайте RAG для больших мероприятий
```python
# Если программа > 10 спикеров — обязательно индексируйте
if len(speakers) > 10:
    index_knowledge(event_id, force_reindex=True)
```

### 3. Настройте брендирование списка
```sql
UPDATE event_mailing_lists 
SET 
  accent_color = '#FF5733',  -- Ваш бренд-цвет
  footer_text = 'Компания © 2025. Отписаться: {unsubscribe_url}'
WHERE id = 5;
```

### 4. Используйте approval flow для важных писем
```python
# Создать approval токен
approval = create_approval(email_id=42)

# Отправить в Telegram
send_telegram(f"Согласуй письмо: /approve {approval['token']}")
```

---

## 🐛 Troubleshooting

### Ошибка: "relation content_plan_items does not exist"
**Решение:** Применить миграцию из Step 2

### Ошибка: "extension vector is not available"
**Решение:** 
1. Проверить managed PostgreSQL поддерживает pgvector
2. Или отключить RAG (система работает без него)

### Duplicate key violation на uniq_generated_per_plan
**Это нормально!** Значит идемпотентность работает — письмо уже было создано.

### RAG возвращает нерелевантные результаты
**Решение:**
1. Переиндексировать knowledge_store
2. Проверить `embedding` не NULL
3. Увеличить `top_k` в rag_retrieve()

---

## 📞 Rollback Plan

Если что-то пошло не так:

```sql
-- 1. Восстановить из backup
psql your-db < backup_before_v2.sql

-- 2. Удалить V2 таблицы (если нужно)
DROP TABLE IF EXISTS content_plan_items CASCADE;
DROP TABLE IF EXISTS approvals CASCADE;
DROP TABLE IF EXISTS email_events CASCADE;

-- 3. Удалить V2 колонки
ALTER TABLE event_mailing_lists 
  DROP COLUMN IF EXISTS accent_color,
  DROP COLUMN IF EXISTS footer_text,
  DROP COLUMN IF EXISTS logo_url_override;

ALTER TABLE generated_emails
  DROP COLUMN IF EXISTS content_plan_item_id,
  DROP COLUMN IF EXISTS unisender_message_id,
  DROP COLUMN IF EXISTS scheduled_at,
  DROP COLUMN IF EXISTS approved_by,
  DROP COLUMN IF EXISTS approved_at,
  DROP COLUMN IF EXISTS meta,
  DROP COLUMN IF EXISTS hash_input;

ALTER TABLE knowledge_store
  DROP COLUMN IF EXISTS embedding_model,
  DROP COLUMN IF EXISTS embedding_dim;
```

---

**Поддержка:** Если возникли вопросы — проверь логи:
```python
get_logs(source='backend/events-manager', limit=100)
```
