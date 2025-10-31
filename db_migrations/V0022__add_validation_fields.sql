-- Добавляю поле is_example для маркировки эталонных шаблонов
ALTER TABLE t_p22819116_event_schedule_app.email_templates 
ADD COLUMN IF NOT EXISTS is_example BOOLEAN DEFAULT false;

-- Добавляю поля валидации в generated_emails
ALTER TABLE t_p22819116_event_schedule_app.generated_emails
ADD COLUMN IF NOT EXISTS validation_status VARCHAR(50) DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS validation_notes TEXT,
ADD COLUMN IF NOT EXISTS html_body TEXT;

-- Переименовываю html_content в html_body если нужно
UPDATE t_p22819116_event_schedule_app.generated_emails 
SET html_body = html_content 
WHERE html_body IS NULL AND html_content IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_templates_is_example 
ON t_p22819116_event_schedule_app.email_templates(is_example, content_type_id);