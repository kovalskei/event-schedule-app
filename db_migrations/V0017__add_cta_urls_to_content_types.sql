-- Добавляем JSON массив с CTA ссылками в типы контента
ALTER TABLE t_p22819116_event_schedule_app.content_types 
ADD COLUMN cta_urls JSONB NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN t_p22819116_event_schedule_app.content_types.cta_urls IS 'Массив объектов с CTA кнопками: [{"label": "Зарегистрироваться", "url": "https://..."}]';