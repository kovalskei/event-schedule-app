export function generateTestData(): Record<string, string> {
  return {
    event_name: 'Название мероприятия',
    event_description: 'Описание мероприятия',
    event_date: '15 декабря 2024',
    event_location: 'Москва, отель Арарат Парк Хаятт',
    speaker_name: 'Иван Иванов',
    speaker_title: 'CEO, ООО "Компания"',
    speaker_topic: 'Будущее индустрии',
    cta_text: 'Зарегистрироваться',
    cta_url: 'https://example.com/register',
    email: 'info@example.com',
    phone: '+7 (495) 123-45-67',
    unsubscribe_link: 'https://example.com/unsubscribe',
    pain: 'Актуальные боли и проблемы',
    solution: 'Решения и подходы',
    benefits: 'Преимущества участия',
  };
}

export function renderMustache(template: string, data: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(data)) {
    const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
    result = result.replace(regex, value);
  }
  return result;
}
