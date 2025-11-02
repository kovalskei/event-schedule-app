-- Таблица семантических блоков шаблонов
CREATE TABLE IF NOT EXISTS t_p22819116_event_schedule_app.template_blocks (
    id SERIAL PRIMARY KEY,
    template_id INTEGER NOT NULL REFERENCES t_p22819116_event_schedule_app.email_templates(id),
    block_type VARCHAR(100) NOT NULL, -- intro, speakers_section, schedule_section, pain_point, cta, footer
    block_name VARCHAR(255) NOT NULL, -- Название блока для разработчика
    html_content TEXT NOT NULL, -- Оригинальный HTML блока
    block_order INTEGER NOT NULL DEFAULT 0, -- Порядок блоков в письме
    
    -- Метаданные для генерации
    knowledge_source VARCHAR(100), -- program, pain, style, content_plan
    generation_instructions TEXT, -- Инструкции для ИИ как генерировать этот блок
    example_content TEXT, -- Пример контента из оригинального письма
    
    -- Схема данных блока
    data_schema JSONB, -- {speakers: [{name, company, topic}], schedule: [{time, title}]}
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(template_id, block_name)
);

CREATE INDEX idx_template_blocks_template ON t_p22819116_event_schedule_app.template_blocks(template_id);
CREATE INDEX idx_template_blocks_type ON t_p22819116_event_schedule_app.template_blocks(block_type);

COMMENT ON TABLE t_p22819116_event_schedule_app.template_blocks IS 'Семантические блоки email шаблонов с привязкой к базе знаний';
COMMENT ON COLUMN t_p22819116_event_schedule_app.template_blocks.block_type IS 'Тип блока: intro, speakers_section, schedule_section, pain_point, cta, footer';
COMMENT ON COLUMN t_p22819116_event_schedule_app.template_blocks.knowledge_source IS 'Откуда брать данные: program (программа), pain (боли), style (примеры), content_plan (контент план)';
COMMENT ON COLUMN t_p22819116_event_schedule_app.template_blocks.data_schema IS 'JSON схема данных которые нужно извлечь из базы знаний для этого блока';