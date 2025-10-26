-- Таблица правил расписания для рассылок
CREATE TABLE IF NOT EXISTS schedule_rules (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES events(id),
    mailing_list_id INTEGER NOT NULL REFERENCES event_mailing_lists(id),
    content_plan_item_id INTEGER NOT NULL REFERENCES content_plan_items(id),
    ai_provider VARCHAR(50) DEFAULT 'demo',
    ai_model VARCHAR(100),
    assistant_id VARCHAR(255),
    status VARCHAR(50) DEFAULT 'pending',
    generated_template_id VARCHAR(100),
    sent_at TIMESTAMP,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_schedule_rules_event ON schedule_rules(event_id);
CREATE INDEX IF NOT EXISTS idx_schedule_rules_status ON schedule_rules(status);
CREATE INDEX IF NOT EXISTS idx_schedule_rules_content_item ON schedule_rules(content_plan_item_id);