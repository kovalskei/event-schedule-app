-- Добавление полей отправителя для списков рассылки
ALTER TABLE event_mailing_lists
ADD COLUMN sender_email VARCHAR(255),
ADD COLUMN sender_name VARCHAR(255) DEFAULT 'HR Team';