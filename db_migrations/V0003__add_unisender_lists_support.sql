-- Создаём таблицу для хранения UTM правил для списков UniSender, привязанных к событиям
CREATE TABLE IF NOT EXISTS event_mailing_lists (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES events(id),
    unisender_list_id VARCHAR(255) NOT NULL,
    unisender_list_name VARCHAR(500),
    utm_source VARCHAR(255),
    utm_medium VARCHAR(255),
    utm_campaign VARCHAR(255),
    utm_term VARCHAR(255),
    utm_content VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_mailing_lists_event ON event_mailing_lists(event_id);

-- Добавляем в campaigns колонку для ссылки на правила UTM из UniSender списков
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS event_list_id INTEGER REFERENCES event_mailing_lists(id);