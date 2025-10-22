-- Создание таблиц для управления мероприятиями и списками рассылок

-- Таблица мероприятий
CREATE TABLE IF NOT EXISTS events (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    start_date DATE,
    end_date DATE,
    program_doc_id VARCHAR(255),
    pain_doc_id VARCHAR(255),
    default_tone VARCHAR(50) DEFAULT 'professional',
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица списков рассылки для мероприятий
CREATE TABLE IF NOT EXISTS mailing_lists (
    id SERIAL PRIMARY KEY,
    event_id INTEGER REFERENCES events(id),
    name VARCHAR(255) NOT NULL,
    unisender_list_id VARCHAR(100),
    segment_rules JSONB,
    subscriber_count INTEGER DEFAULT 0,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица UTM правил для списков
CREATE TABLE IF NOT EXISTS utm_rules (
    id SERIAL PRIMARY KEY,
    mailing_list_id INTEGER REFERENCES mailing_lists(id),
    utm_source VARCHAR(100),
    utm_medium VARCHAR(100),
    utm_campaign VARCHAR(255),
    utm_term VARCHAR(255),
    utm_content VARCHAR(255),
    custom_params JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица правил подстановки ссылок
CREATE TABLE IF NOT EXISTS link_rules (
    id SERIAL PRIMARY KEY,
    mailing_list_id INTEGER REFERENCES mailing_lists(id),
    link_type VARCHAR(100),
    base_url TEXT NOT NULL,
    apply_utm BOOLEAN DEFAULT true,
    custom_params JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Обновляем таблицу campaigns для связи с мероприятиями
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS event_id INTEGER REFERENCES events(id);
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS mailing_list_id INTEGER REFERENCES mailing_lists(id);

-- Индексы
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_mailing_lists_event ON mailing_lists(event_id);
CREATE INDEX IF NOT EXISTS idx_utm_rules_list ON utm_rules(mailing_list_id);
CREATE INDEX IF NOT EXISTS idx_link_rules_list ON link_rules(mailing_list_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_event ON campaigns(event_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_mailing_list ON campaigns(mailing_list_id);
