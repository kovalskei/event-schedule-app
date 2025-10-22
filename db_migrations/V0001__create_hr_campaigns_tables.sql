-- Создание таблиц для системы HR-рассылок

-- Таблица кампаний
CREATE TABLE IF NOT EXISTS campaigns (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    program_doc_id VARCHAR(255) NOT NULL,
    pain_doc_id VARCHAR(255) NOT NULL,
    tone VARCHAR(50) DEFAULT 'professional',
    status VARCHAR(50) DEFAULT 'draft',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица сгенерированных писем
CREATE TABLE IF NOT EXISTS generated_emails (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER REFERENCES campaigns(id),
    subject TEXT NOT NULL,
    html_content TEXT NOT NULL,
    template_id VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица статистики отправок
CREATE TABLE IF NOT EXISTS email_stats (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER REFERENCES campaigns(id),
    template_id VARCHAR(100),
    sent_count INTEGER DEFAULT 0,
    opened_count INTEGER DEFAULT 0,
    clicked_count INTEGER DEFAULT 0,
    bounced_count INTEGER DEFAULT 0,
    sent_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица логов процесса
CREATE TABLE IF NOT EXISTS campaign_logs (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER REFERENCES campaigns(id),
    step VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL,
    message TEXT,
    error_details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Индексы для оптимизации запросов
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_generated_emails_campaign ON generated_emails(campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_stats_campaign ON email_stats(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_logs_campaign ON campaign_logs(campaign_id);
