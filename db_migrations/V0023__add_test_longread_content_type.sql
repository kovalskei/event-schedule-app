-- Создаём тестовый тип контента для проверки сохранения стилей
INSERT INTO t_p22819116_event_schedule_app.content_types 
  (event_id, name, description, primary_cta_text, primary_cta_url)
VALUES 
  (1, 'Тестовый лонгрид', 'Тестовый тип контента с богатым оформлением для проверки сохранения стилей', 'Узнать подробнее', 'https://test-event.example.com/details');