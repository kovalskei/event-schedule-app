-- Добавление настроек для списков рассылки
ALTER TABLE event_mailing_lists 
ADD COLUMN content_type_ids INTEGER[] DEFAULT '{}',
ADD COLUMN content_type_order TEXT DEFAULT '[]',
ADD COLUMN ai_provider VARCHAR(50) DEFAULT 'openai',
ADD COLUMN ai_model VARCHAR(100) DEFAULT 'gpt-4o-mini',
ADD COLUMN ai_assistant_id VARCHAR(255),
ADD COLUMN demo_mode BOOLEAN DEFAULT false,
ADD COLUMN schedule_type VARCHAR(20) DEFAULT 'manual',
ADD COLUMN schedule_rrule TEXT,
ADD COLUMN schedule_datetime TIMESTAMP,
ADD COLUMN schedule_window_start TIME DEFAULT '10:00:00',
ADD COLUMN schedule_window_end TIME DEFAULT '19:00:00',
ADD COLUMN test_required BOOLEAN DEFAULT true,
ADD COLUMN status VARCHAR(20) DEFAULT 'draft',
ADD COLUMN last_run_at TIMESTAMP;

COMMENT ON COLUMN event_mailing_lists.content_type_ids IS 'Массив ID типов контента для этого списка';
COMMENT ON COLUMN event_mailing_lists.content_type_order IS 'JSON порядок отправки типов контента';
COMMENT ON COLUMN event_mailing_lists.ai_provider IS 'openai, claude, demo';
COMMENT ON COLUMN event_mailing_lists.ai_model IS 'gpt-4o-mini, gpt-4o, claude-3-5-sonnet';
COMMENT ON COLUMN event_mailing_lists.schedule_type IS 'manual, datetime, rrule';
COMMENT ON COLUMN event_mailing_lists.status IS 'draft, active, paused, completed';
