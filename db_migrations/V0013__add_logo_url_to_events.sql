-- Добавляем поле для хранения URL логотипа мероприятия
ALTER TABLE events ADD COLUMN IF NOT EXISTS logo_url TEXT;