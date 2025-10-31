-- Добавляем AI настройки в таблицу events
ALTER TABLE events 
ADD COLUMN ai_provider VARCHAR(50) DEFAULT 'openai',
ADD COLUMN ai_model VARCHAR(100) DEFAULT 'gpt-4o-mini',
ADD COLUMN ai_assistant_id VARCHAR(255);

-- Комментарии для документации
COMMENT ON COLUMN events.ai_provider IS 'AI провайдер: openai, openrouter, anthropic';
COMMENT ON COLUMN events.ai_model IS 'Модель AI для генерации писем';
COMMENT ON COLUMN events.ai_assistant_id IS 'ID ассистента (если используется)';
