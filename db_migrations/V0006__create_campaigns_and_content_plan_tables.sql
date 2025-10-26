-- Таблица кампаний
CREATE TABLE IF NOT EXISTS campaigns (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES events(id),
    name VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'draft',
    demo_mode BOOLEAN DEFAULT false,
    scheduled_start TIMESTAMP,
    actual_start TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица контент-плана (строки из Google Sheets)
CREATE TABLE IF NOT EXISTS content_plan_items (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER NOT NULL REFERENCES campaigns(id),
    content_type_id INTEGER NOT NULL REFERENCES content_types(id),
    scheduled_date TIMESTAMP NOT NULL,
    subject VARCHAR(500),
    key_message TEXT,
    cta_text VARCHAR(255),
    status VARCHAR(50) DEFAULT 'pending',
    generated_html TEXT,
    unisender_campaign_id VARCHAR(100),
    sent_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_campaigns_event ON campaigns(event_id);
CREATE INDEX IF NOT EXISTS idx_content_plan_campaign ON content_plan_items(campaign_id);
CREATE INDEX IF NOT EXISTS idx_content_plan_status ON content_plan_items(status);