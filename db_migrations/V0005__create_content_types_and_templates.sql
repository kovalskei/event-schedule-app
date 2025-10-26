-- Таблица типов контента для мероприятия
CREATE TABLE t_p22819116_event_schedule_app.content_types (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_content_types_event FOREIGN KEY (event_id) REFERENCES t_p22819116_event_schedule_app.events(id)
);

-- Таблица шаблонов писем
CREATE TABLE t_p22819116_event_schedule_app.email_templates (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL,
    content_type_id INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    html_template TEXT NOT NULL,
    subject_template VARCHAR(255),
    instructions TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_email_templates_event FOREIGN KEY (event_id) REFERENCES t_p22819116_event_schedule_app.events(id),
    CONSTRAINT fk_email_templates_content_type FOREIGN KEY (content_type_id) REFERENCES t_p22819116_event_schedule_app.content_types(id)
);

-- Таблица контент-плана
CREATE TABLE t_p22819116_event_schedule_app.content_plan (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL,
    content_type_id INTEGER NOT NULL,
    topic VARCHAR(500) NOT NULL,
    scheduled_date DATE,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_content_plan_event FOREIGN KEY (event_id) REFERENCES t_p22819116_event_schedule_app.events(id),
    CONSTRAINT fk_content_plan_content_type FOREIGN KEY (content_type_id) REFERENCES t_p22819116_event_schedule_app.content_types(id)
);

CREATE INDEX idx_content_types_event ON t_p22819116_event_schedule_app.content_types(event_id);
CREATE INDEX idx_email_templates_event ON t_p22819116_event_schedule_app.email_templates(event_id);
CREATE INDEX idx_email_templates_content_type ON t_p22819116_event_schedule_app.email_templates(content_type_id);
CREATE INDEX idx_content_plan_event ON t_p22819116_event_schedule_app.content_plan(event_id);