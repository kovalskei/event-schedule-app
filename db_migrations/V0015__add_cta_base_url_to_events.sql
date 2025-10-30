-- Добавляем базовую CTA ссылку в настройки события
ALTER TABLE t_p22819116_event_schedule_app.events 
ADD COLUMN cta_base_url TEXT NULL;

COMMENT ON COLUMN t_p22819116_event_schedule_app.events.cta_base_url IS 'Базовая ссылка для CTA кнопок (без UTM меток)';