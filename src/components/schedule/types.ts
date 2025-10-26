export interface Session {
  id: string;
  hall: string;
  startTime: string;
  endTime: string;
  speaker: string;
  role: string;
  title: string;
  description: string;
  bulletPoints: string[];
  tags: string[];
}

export const mockSessions: Session[] = [
  {
    id: '1',
    hall: 'Главный зал',
    startTime: '10:00',
    endTime: '11:00',
    speaker: 'Анна Петрова',
    role: 'CEO Tech Innovations',
    title: 'Будущее искусственного интеллекта в бизнесе',
    description: 'Практические кейсы применения ИИ для оптимизации бизнес-процессов и увеличения прибыли.',
    bulletPoints: [
      'Автоматизация рутинных процессов с помощью ИИ',
      'Анализ больших данных для принятия решений',
      'Внедрение чат-ботов и виртуальных ассистентов'
    ],
    tags: ['AI', 'Технологии', 'Бизнес']
  },
  {
    id: '2',
    hall: 'Главный зал',
    startTime: '11:30',
    endTime: '12:30',
    speaker: 'Михаил Соколов',
    role: 'Директор по инновациям',
    title: 'Цифровая трансформация: от стратегии к результатам',
    description: 'Как выстроить эффективную стратегию цифровизации и избежать типичных ошибок.',
    bulletPoints: [
      'Оценка текущего уровня цифровизации',
      'Выбор приоритетных направлений',
      'Управление изменениями в команде'
    ],
    tags: ['Цифровизация', 'Стратегия']
  },
  {
    id: '3',
    hall: 'Зал А',
    startTime: '10:00',
    endTime: '11:00',
    speaker: 'Елена Королёва',
    role: 'Head of Marketing',
    title: 'Тренды маркетинга 2025',
    description: 'Обзор ключевых трендов в маркетинге и практические рекомендации по их применению.',
    bulletPoints: [
      'Персонализация на новом уровне',
      'Интерактивный контент и геймификация',
      'Влияние ИИ на маркетинговые стратегии'
    ],
    tags: ['Маркетинг', 'Тренды']
  },
  {
    id: '4',
    hall: 'Зал А',
    startTime: '11:30',
    endTime: '12:30',
    speaker: 'Дмитрий Волков',
    role: 'Партнёр венчурного фонда',
    title: 'Инвестиции в стартапы: что важно знать',
    description: 'Критерии оценки стартапов инвесторами и как подготовиться к привлечению инвестиций.',
    bulletPoints: [
      'Ключевые метрики для инвесторов',
      'Подготовка питч-дека',
      'Типичные ошибки основателей'
    ],
    tags: ['Инвестиции', 'Стартапы']
  },
  {
    id: '5',
    hall: 'Зал B',
    startTime: '10:00',
    endTime: '11:00',
    speaker: 'Ольга Смирнова',
    role: 'HR Director',
    title: 'Управление талантами в эпоху изменений',
    description: 'Современные подходы к привлечению, развитию и удержанию лучших специалистов.',
    bulletPoints: [
      'Построение бренда работодателя',
      'Развитие внутренних талантов',
      'Создание культуры обучения'
    ],
    tags: ['HR', 'Управление']
  },
  {
    id: '6',
    hall: 'Зал B',
    startTime: '11:30',
    endTime: '12:30',
    speaker: 'Сергей Иванов',
    role: 'Эксперт по ESG',
    title: 'Устойчивое развитие бизнеса',
    description: 'ESG-повестка: от формальности к реальной пользе для компании и общества.',
    bulletPoints: [
      'Интеграция ESG в бизнес-стратегию',
      'Измерение и отчётность по ESG',
      'Создание долгосрочной ценности'
    ],
    tags: ['ESG', 'Устойчивость']
  },
  {
    id: '7',
    hall: 'Главный зал',
    startTime: '14:00',
    endTime: '15:00',
    speaker: 'Александр Новиков',
    role: 'Основатель Tech Corp',
    title: 'Масштабирование технологического бизнеса',
    description: 'Стратегии роста от стартапа до международной компании.',
    bulletPoints: [
      'Построение масштабируемой архитектуры',
      'Формирование команды для роста',
      'Выход на новые рынки'
    ],
    tags: ['Бизнес', 'Технологии', 'Масштабирование']
  },
  {
    id: '8',
    hall: 'Зал А',
    startTime: '14:00',
    endTime: '15:00',
    speaker: 'Наталья Григорьева',
    role: 'CFO',
    title: 'Финансовая стратегия в условиях неопределённости',
    description: 'Инструменты финансового планирования и управления рисками.',
    bulletPoints: [
      'Сценарное планирование',
      'Управление денежными потоками',
      'Оптимизация структуры капитала'
    ],
    tags: ['Финансы', 'Стратегия']
  },
  {
    id: '9',
    hall: 'Зал C',
    startTime: '10:00',
    endTime: '11:00',
    speaker: 'Виктор Морозов',
    role: 'Эксперт по кибербезопасности',
    title: 'Защита данных в цифровую эпоху',
    description: 'Современные угрозы и методы защиты корпоративной информации.',
    bulletPoints: [
      'Актуальные киберугрозы 2025',
      'Построение системы защиты',
      'Обучение сотрудников кибергигиене'
    ],
    tags: ['Безопасность', 'Технологии']
  },
  {
    id: '10',
    hall: 'Зал D',
    startTime: '10:00',
    endTime: '11:00',
    speaker: 'Мария Лебедева',
    role: 'Product Manager',
    title: 'Создание продуктов, которые любят пользователи',
    description: 'Методология разработки продуктов с фокусом на пользовательский опыт.',
    bulletPoints: [
      'Исследование потребностей пользователей',
      'Быстрое тестирование гипотез',
      'Метрики успеха продукта'
    ],
    tags: ['Продукт', 'UX']
  },
  {
    id: '11',
    hall: 'Зал B',
    startTime: '10:15',
    endTime: '10:45',
    speaker: 'Игорь Семёнов',
    role: 'Tech Lead',
    title: 'Микросервисная архитектура на практике',
    description: 'Реальный опыт перехода от монолита к микросервисам.',
    bulletPoints: [
      'Когда нужны микросервисы',
      'Паттерны проектирования',
      'Мониторинг и отладка'
    ],
    tags: ['Технологии', 'Архитектура']
  }
];

export const getDuration = (start: string, end: string): number => {
  const [startH, startM] = start.split(':').map(Number);
  const [endH, endM] = end.split(':').map(Number);
  return (endH * 60 + endM) - (startH * 60 + startM);
};

export const tagColors: Record<string, string> = {
  'AI': 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  'Технологии': 'bg-purple-500/15 text-purple-700 dark:text-purple-300',
  'Бизнес': 'bg-green-500/15 text-green-700 dark:text-green-300',
  'Цифровизация': 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300',
  'Стратегия': 'bg-orange-500/15 text-orange-700 dark:text-orange-300',
  'Маркетинг': 'bg-pink-500/15 text-pink-700 dark:text-pink-300',
  'Тренды': 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300',
  'Инвестиции': 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  'Стартапы': 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  'HR': 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
  'Управление': 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
  'ESG': 'bg-lime-500/15 text-lime-700 dark:text-lime-300',
  'Устойчивость': 'bg-teal-500/15 text-teal-700 dark:text-teal-300',
  'Масштабирование': 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  'Финансы': 'bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300',
  'Безопасность': 'bg-red-500/15 text-red-700 dark:text-red-300',
  'Продукт': 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-300',
  'UX': 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  'Архитектура': 'bg-slate-500/15 text-slate-700 dark:text-slate-300'
};

export const getTagColor = (tag: string) => tagColors[tag] || 'bg-gray-500/15 text-gray-700 dark:text-gray-300';
