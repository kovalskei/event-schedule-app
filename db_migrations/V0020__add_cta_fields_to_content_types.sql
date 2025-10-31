-- Добавляем поля для CTA в content_types
ALTER TABLE t_p22819116_event_schedule_app.content_types 
ADD COLUMN IF NOT EXISTS default_cta_primary VARCHAR(500),
ADD COLUMN IF NOT EXISTS default_cta_secondary VARCHAR(500),
ADD COLUMN IF NOT EXISTS default_cta_text_primary VARCHAR(100),
ADD COLUMN IF NOT EXISTS default_cta_text_secondary VARCHAR(100);

-- Обновляем существующие типы контента с CTA
UPDATE t_p22819116_event_schedule_app.content_types 
SET 
  default_cta_primary = 'https://human-obuchenie.ru/register',
  default_cta_text_primary = 'Зарегистрироваться на конференцию'
WHERE name = 'Продажа через боль';

UPDATE t_p22819116_event_schedule_app.content_types 
SET 
  default_cta_primary = 'https://human-obuchenie.ru/program',
  default_cta_text_primary = 'Посмотреть программу'
WHERE name = 'Анонс';

UPDATE t_p22819116_event_schedule_app.content_types 
SET 
  default_cta_primary = 'https://human-obuchenie.ru/blog',
  default_cta_text_primary = 'Читать статью'
WHERE name = 'Полезный контент';

-- Добавляем индекс для быстрого поиска шаблонов
CREATE INDEX IF NOT EXISTS idx_email_templates_event_content 
ON t_p22819116_event_schedule_app.email_templates(event_id, content_type_id);