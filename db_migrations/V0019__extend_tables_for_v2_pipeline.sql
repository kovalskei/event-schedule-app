-- Extend email_templates for V2
ALTER TABLE t_p22819116_event_schedule_app.email_templates
ADD COLUMN IF NOT EXISTS html_layout TEXT,
ADD COLUMN IF NOT EXISTS slots_schema JSONB,
ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

UPDATE t_p22819116_event_schedule_app.email_templates 
SET html_layout = html_template 
WHERE html_layout IS NULL;

UPDATE t_p22819116_event_schedule_app.email_templates 
SET slots_schema = '{
  "required": ["hero_title", "intro", "cta_primary"],
  "properties": {
    "hero_title": {"maxLength": 80},
    "intro": {"maxLength": 300},
    "benefits_bullets": {"type": "array", "minItems": 2, "maxItems": 5},
    "cta_primary": {"properties": {"id": {}, "text": {}}},
    "cta_secondary": {"properties": {"id": {}, "text": {}}}
  }
}'::jsonb
WHERE slots_schema IS NULL;

-- Extend event_mailing_lists
ALTER TABLE t_p22819116_event_schedule_app.event_mailing_lists
ADD COLUMN IF NOT EXISTS ai_model_override TEXT,
ADD COLUMN IF NOT EXISTS from_name TEXT,
ADD COLUMN IF NOT EXISTS from_email TEXT,
ADD COLUMN IF NOT EXISTS reply_to TEXT,
ADD COLUMN IF NOT EXISTS unsubscribe_url TEXT;

-- Extend content_plan
ALTER TABLE t_p22819116_event_schedule_app.content_plan
ADD COLUMN IF NOT EXISTS segment TEXT,
ADD COLUMN IF NOT EXISTS offer_deadline TIMESTAMP,
ADD COLUMN IF NOT EXISTS speakers_hint TEXT,
ADD COLUMN IF NOT EXISTS ab_variants INTEGER DEFAULT 2,
ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'ru-RU',
ADD COLUMN IF NOT EXISTS tone_override TEXT,
ADD COLUMN IF NOT EXISTS ai_model_override TEXT,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft';

-- Extend content_types
ALTER TABLE t_p22819116_event_schedule_app.content_types
ADD COLUMN IF NOT EXISTS allowed_ctas JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS default_cta_primary TEXT,
ADD COLUMN IF NOT EXISTS default_cta_secondary TEXT;

-- Extend generated_emails
ALTER TABLE t_p22819116_event_schedule_app.generated_emails
ADD COLUMN IF NOT EXISTS pipeline_version TEXT DEFAULT 'v1',
ADD COLUMN IF NOT EXISTS pass1_json JSONB,
ADD COLUMN IF NOT EXISTS pass2_json JSONB,
ADD COLUMN IF NOT EXISTS rag_sources JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS template_version INTEGER,
ADD COLUMN IF NOT EXISTS qa_metrics JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS plain_text TEXT,
ADD COLUMN IF NOT EXISTS input_params JSONB DEFAULT '{}';

-- Create utm_logs table
CREATE TABLE IF NOT EXISTS t_p22819116_event_schedule_app.utm_logs (
    id SERIAL PRIMARY KEY,
    email_id INTEGER REFERENCES t_p22819116_event_schedule_app.generated_emails(id),
    raw_url TEXT NOT NULL,
    final_url TEXT NOT NULL,
    utm_params JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_utm_logs_email ON t_p22819116_event_schedule_app.utm_logs(email_id);