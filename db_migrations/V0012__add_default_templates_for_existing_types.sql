-- Добавляем базовые шаблоны для типов контента без шаблонов
INSERT INTO email_templates (event_id, content_type_id, name, html_template, subject_template, instructions)
SELECT 
    ct.event_id,
    ct.id,
    'Базовый шаблон: ' || ct.name,
    '<html><body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;"><h1>{subject}</h1><div>{content}</div></body></html>',
    '{subject}',
    'Создай письмо в стиле "' || ct.name || '". Используй информацию о программе мероприятия и болях целевой аудитории.'
FROM content_types ct
WHERE NOT EXISTS (
    SELECT 1 FROM email_templates et WHERE et.content_type_id = ct.id
);