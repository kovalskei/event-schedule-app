-- Таблица для хранения CTA ссылок с UTM метками
CREATE TABLE t_p22819116_event_schedule_app.email_cta_links (
    id SERIAL PRIMARY KEY,
    event_list_id INTEGER NOT NULL REFERENCES t_p22819116_event_schedule_app.event_mailing_lists(id),
    content_type_id INTEGER NULL REFERENCES t_p22819116_event_schedule_app.content_types(id),
    
    -- UTM параметры (переопределяют базовые из event_mailing_lists)
    utm_campaign VARCHAR(255) NULL,
    utm_content VARCHAR(255) NULL,
    
    -- Кастомные параметры для этой конкретной ссылки
    custom_params JSONB NULL,
    
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE t_p22819116_event_schedule_app.email_cta_links IS 'CTA ссылки с UTM метками для каждого типа контента и списка рассылки';
COMMENT ON COLUMN t_p22819116_event_schedule_app.email_cta_links.event_list_id IS 'ID списка рассылки (наследует utm_source, utm_medium)';
COMMENT ON COLUMN t_p22819116_event_schedule_app.email_cta_links.content_type_id IS 'ID типа контента (NULL = default для всего списка)';
COMMENT ON COLUMN t_p22819116_event_schedule_app.email_cta_links.utm_campaign IS 'Название кампании (если NULL - берется из event_mailing_lists)';
COMMENT ON COLUMN t_p22819116_event_schedule_app.email_cta_links.utm_content IS 'Содержимое метки (обычно тема письма или тип контента)';

-- Индексы для быстрого поиска
CREATE INDEX idx_email_cta_links_list_type ON t_p22819116_event_schedule_app.email_cta_links(event_list_id, content_type_id);