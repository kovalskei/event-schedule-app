-- Таблица для хранения переменных шаблонов
CREATE TABLE t_p22819116_event_schedule_app.template_variables (
    id SERIAL PRIMARY KEY,
    template_id INTEGER NOT NULL,
    variable_name VARCHAR(100) NOT NULL,
    variable_description TEXT,
    default_value TEXT,
    is_required BOOLEAN DEFAULT false,
    variable_type VARCHAR(50) DEFAULT 'text',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_template_variables_template FOREIGN KEY (template_id) 
        REFERENCES t_p22819116_event_schedule_app.email_templates(id),
    CONSTRAINT unique_template_variable UNIQUE (template_id, variable_name)
);

CREATE INDEX idx_template_variables_template ON t_p22819116_event_schedule_app.template_variables(template_id);

-- Добавить колонку для хранения оригинального HTML (без переменных)
ALTER TABLE t_p22819116_event_schedule_app.email_templates 
ADD COLUMN original_html TEXT;

-- Комментарии к таблице
COMMENT ON TABLE t_p22819116_event_schedule_app.template_variables IS 'Переменные для шаблонов писем (например: {{speaker_name}}, {{event_date}})';
COMMENT ON COLUMN t_p22819116_event_schedule_app.template_variables.variable_name IS 'Имя переменной (например: speaker_name)';
COMMENT ON COLUMN t_p22819116_event_schedule_app.template_variables.variable_description IS 'Описание переменной для ИИ (например: ФИО спикера вебинара)';
COMMENT ON COLUMN t_p22819116_event_schedule_app.template_variables.default_value IS 'Значение по умолчанию если ИИ не может заполнить';
COMMENT ON COLUMN t_p22819116_event_schedule_app.template_variables.variable_type IS 'Тип переменной: text, date, url, number';
COMMENT ON COLUMN t_p22819116_event_schedule_app.email_templates.original_html IS 'Оригинальный HTML пользователя (без переменных)';