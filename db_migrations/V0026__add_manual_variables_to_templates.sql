ALTER TABLE t_p22819116_event_schedule_app.email_templates 
ADD COLUMN IF NOT EXISTS manual_variables JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN t_p22819116_event_schedule_app.email_templates.manual_variables 
IS 'Вручную размеченные переменные: [{id, name, description, source, startIndex, endIndex, content}]';