import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import Icon from '@/components/ui/icon';
import { cn } from '@/lib/utils';

interface Session {
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

const mockSessions: Session[] = [
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
  }
];

const halls = ['Главный зал', 'Зал А', 'Зал B', 'Зал C', 'Зал D'];
const timeSlots = ['10:00', '11:30', '14:00'];

const EventSchedule = () => {
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [myPlan, setMyPlan] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const saved = localStorage.getItem('myPlan');
    if (saved) {
      setMyPlan(JSON.parse(saved));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('myPlan', JSON.stringify(myPlan));
  }, [myPlan]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  const allTags = Array.from(new Set(mockSessions.flatMap(s => s.tags)));

  const filteredSessions = selectedTags.length === 0
    ? mockSessions
    : mockSessions.filter(s => s.tags.some(tag => selectedTags.includes(tag)));

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const toggleMyPlan = (sessionId: string) => {
    setMyPlan(prev =>
      prev.includes(sessionId) ? prev.filter(id => id !== sessionId) : [...prev, sessionId]
    );
  };

  const hasConflict = (session: Session) => {
    const planSessions = mockSessions.filter(s => myPlan.includes(s.id) && s.id !== session.id);
    return planSessions.some(s => 
      s.startTime === session.startTime || 
      (s.startTime < session.startTime && s.endTime > session.startTime)
    );
  };

  const currentTime = '11:00';
  const nowSessions = mockSessions.filter(s => s.startTime <= currentTime && s.endTime > currentTime);

  const exportProgramToPDF = () => {
    alert('Экспорт полной программы в PDF (в разработке)');
  };

  const exportMyPlanToPDF = () => {
    alert('Экспорт личного плана в PDF (в разработке)');
  };

  const activeHalls = halls.filter(hall => 
    filteredSessions.some(s => s.hall === hall)
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-[1600px]">
        {/* Header */}
        <div className="mb-8 animate-fade-in">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-6xl font-serif font-bold text-foreground mb-3">
                Премиум Форум 2025
              </h1>
              <p className="text-muted-foreground text-xl">
                17 октября 2025 • Москва, Центр «Метрополь»
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={exportProgramToPDF}
                className="h-11"
              >
                <Icon name="FileDown" size={18} className="mr-2" />
                Программа PDF
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                className="rounded-full h-11 w-11"
              >
                <Icon name={theme === 'light' ? 'Moon' : 'Sun'} size={20} />
              </Button>
            </div>
          </div>
          <Separator className="my-6" />
        </div>

        {/* Filters */}
        <div className="mb-8 animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <div className="flex items-center gap-3 flex-wrap">
            <Icon name="Filter" size={20} className="text-muted-foreground" />
            <span className="text-base font-medium text-muted-foreground">Фильтры:</span>
            {allTags.map(tag => (
              <Badge
                key={tag}
                variant={selectedTags.includes(tag) ? 'default' : 'outline'}
                className={cn(
                  'cursor-pointer transition-all hover-scale text-sm px-3 py-1',
                  selectedTags.includes(tag) && 'bg-primary text-primary-foreground'
                )}
                onClick={() => toggleTag(tag)}
              >
                {tag}
              </Badge>
            ))}
            {selectedTags.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedTags([])}
                className="text-sm"
              >
                Сбросить
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
          {/* Main Schedule */}
          <div className="xl:col-span-3">
            <Tabs defaultValue="grid" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-8 h-12">
                <TabsTrigger value="grid" className="flex items-center gap-2 text-base">
                  <Icon name="LayoutGrid" size={18} />
                  Программа
                </TabsTrigger>
                <TabsTrigger value="now" className="flex items-center gap-2 text-base">
                  <Icon name="Clock" size={18} />
                  Сейчас
                </TabsTrigger>
              </TabsList>

              <TabsContent value="grid" className="mt-0">
                <Card className="p-8 bg-card border-2">
                  <ScrollArea className="h-[700px]">
                    <div className="space-y-10">
                      {timeSlots.map((time, timeIdx) => (
                        <div key={time} className="animate-fade-in" style={{ animationDelay: `${timeIdx * 0.1}s` }}>
                          <div className="mb-6">
                            <h3 className="text-2xl font-bold text-primary flex items-center gap-3">
                              <Icon name="Clock" size={24} />
                              {time}
                            </h3>
                          </div>
                          
                          {/* Hall Headers */}
                          <div className={`grid gap-4 mb-4`} style={{ gridTemplateColumns: `repeat(${activeHalls.length}, minmax(0, 1fr))` }}>
                            {activeHalls.map(hall => (
                              <div key={hall} className="px-4 py-2 bg-primary/10 rounded-lg border-2 border-primary/20">
                                <h4 className="font-bold text-base text-center text-foreground">
                                  {hall}
                                </h4>
                              </div>
                            ))}
                          </div>

                          {/* Sessions Grid */}
                          <div className={`grid gap-4`} style={{ gridTemplateColumns: `repeat(${activeHalls.length}, minmax(0, 1fr))` }}>
                            {activeHalls.map(hall => {
                              const session = filteredSessions.find(
                                s => s.hall === hall && s.startTime === time
                              );
                              return (
                                <div key={hall}>
                                  {session ? (
                                    <Card
                                      className={cn(
                                        'p-5 cursor-pointer transition-all hover:shadow-xl hover:-translate-y-1 border-2',
                                        'bg-card',
                                        myPlan.includes(session.id) && 'ring-2 ring-primary border-primary'
                                      )}
                                      onClick={() => setSelectedSession(session)}
                                    >
                                      <div className="flex justify-between items-start mb-3">
                                        <Badge variant="outline" className="text-xs">
                                          {session.startTime} - {session.endTime}
                                        </Badge>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-7 w-7 -mt-1 -mr-1"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            toggleMyPlan(session.id);
                                          }}
                                        >
                                          <Icon
                                            name={myPlan.includes(session.id) ? 'BookmarkCheck' : 'BookmarkPlus'}
                                            size={16}
                                            className={myPlan.includes(session.id) ? 'text-primary' : ''}
                                          />
                                        </Button>
                                      </div>
                                      <h4 className="font-bold text-base mb-3 leading-snug">
                                        {session.title}
                                      </h4>
                                      <p className="text-sm font-medium text-foreground mb-1">
                                        {session.speaker}
                                      </p>
                                      <p className="text-sm text-muted-foreground mb-3">
                                        {session.role}
                                      </p>
                                      
                                      {session.bulletPoints && session.bulletPoints.length > 0 && (
                                        <div className="mb-3 space-y-1">
                                          {session.bulletPoints.slice(0, 2).map((point, idx) => (
                                            <div key={idx} className="flex items-start gap-2">
                                              <span className="text-primary text-xs mt-0.5">•</span>
                                              <p className="text-xs text-muted-foreground leading-relaxed">
                                                {point}
                                              </p>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                      
                                      <div className="flex gap-1.5 flex-wrap">
                                        {session.tags.slice(0, 2).map(tag => (
                                          <Badge key={tag} variant="secondary" className="text-xs px-2 py-0">
                                            {tag}
                                          </Badge>
                                        ))}
                                      </div>
                                    </Card>
                                  ) : (
                                    <Card className="p-5 border-2 border-dashed border-muted bg-muted/30">
                                      <p className="text-sm text-muted-foreground text-center py-8">
                                        Перерыв
                                      </p>
                                    </Card>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </Card>
              </TabsContent>

              <TabsContent value="now" className="mt-0">
                <div className="space-y-5">
                  {nowSessions.length > 0 ? (
                    nowSessions.map((session, idx) => (
                      <Card
                        key={session.id}
                        className="p-8 cursor-pointer hover:shadow-xl transition-all bg-gradient-to-r from-primary/10 to-accent/10 border-2 border-primary/30 animate-fade-in"
                        style={{ animationDelay: `${idx * 0.1}s` }}
                        onClick={() => setSelectedSession(session)}
                      >
                        <div className="flex items-start gap-6">
                          <div className="flex-shrink-0">
                            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
                              <Icon name="Radio" size={28} className="text-primary animate-pulse" />
                            </div>
                          </div>
                          <div className="flex-1">
                            <Badge className="mb-3 text-sm">Идёт сейчас</Badge>
                            <h3 className="font-serif text-3xl font-bold mb-3">{session.title}</h3>
                            <p className="text-base text-foreground font-medium mb-1">
                              {session.speaker}
                            </p>
                            <p className="text-base text-muted-foreground mb-2">
                              {session.role}
                            </p>
                            <p className="text-base text-muted-foreground mb-4">
                              {session.hall} • {session.startTime} - {session.endTime}
                            </p>
                            <p className="text-base mb-4 leading-relaxed">{session.description}</p>
                            <div className="flex gap-2 flex-wrap">
                              {session.tags.map(tag => (
                                <Badge key={tag} variant="secondary" className="text-sm">{tag}</Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))
                  ) : (
                    <Card className="p-16 text-center border-2 border-dashed">
                      <Icon name="Coffee" size={56} className="mx-auto mb-6 text-muted-foreground" />
                      <h3 className="text-2xl font-bold mb-3">Перерыв</h3>
                      <p className="text-muted-foreground text-lg">Сейчас идёт перерыв. Следующая сессия начнётся в 14:00</p>
                    </Card>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* My Plan Sidebar */}
          <div className="xl:col-span-1">
            <Card className="p-6 sticky top-8 bg-card border-2 animate-fade-in" style={{ animationDelay: '0.2s' }}>
              <h2 className="text-3xl font-serif font-bold mb-5 flex items-center gap-3">
                <Icon name="Calendar" size={28} />
                Мой план
              </h2>
              <Separator className="mb-5" />
              <ScrollArea className="h-[550px]">
                {myPlan.length === 0 ? (
                  <div className="text-center py-16">
                    <Icon name="CalendarX" size={56} className="mx-auto mb-5 text-muted-foreground" />
                    <p className="text-muted-foreground text-base leading-relaxed px-4">
                      Выберите доклады, которые хотите посетить
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {myPlan.map((sessionId, idx) => {
                      const session = mockSessions.find(s => s.id === sessionId);
                      if (!session) return null;
                      const conflict = hasConflict(session);
                      return (
                        <Card
                          key={sessionId}
                          className={cn(
                            'p-4 cursor-pointer transition-all hover:shadow-lg animate-scale-in border-2',
                            conflict && 'border-destructive bg-destructive/5'
                          )}
                          style={{ animationDelay: `${idx * 0.05}s` }}
                          onClick={() => setSelectedSession(session)}
                        >
                          {conflict && (
                            <div className="flex items-center gap-2 text-sm text-destructive mb-2 font-medium">
                              <Icon name="AlertCircle" size={14} />
                              Конфликт по времени
                            </div>
                          )}
                          <div className="flex justify-between items-start mb-2">
                            <Badge variant="outline" className="text-xs">
                              {session.startTime} - {session.endTime}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleMyPlan(session.id);
                              }}
                            >
                              <Icon name="X" size={14} />
                            </Button>
                          </div>
                          <h4 className="font-bold text-sm mb-2 leading-snug">
                            {session.title}
                          </h4>
                          <p className="text-xs text-muted-foreground mb-1">
                            {session.speaker}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {session.hall}
                          </p>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
              {myPlan.length > 0 && (
                <>
                  <Separator className="my-5" />
                  <Button 
                    className="w-full h-11 text-base" 
                    variant="default"
                    onClick={exportMyPlanToPDF}
                  >
                    <Icon name="FileDown" size={18} className="mr-2" />
                    Мой план PDF
                  </Button>
                </>
              )}
            </Card>
          </div>
        </div>
      </div>

      {/* Session Details Sheet */}
      <Sheet open={!!selectedSession} onOpenChange={() => setSelectedSession(null)}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          {selectedSession && (
            <div className="animate-fade-in">
              <SheetHeader>
                <SheetTitle className="text-3xl font-serif pr-8">{selectedSession.title}</SheetTitle>
              </SheetHeader>
              <div className="mt-8 space-y-6">
                <div>
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                      <Icon name="User" size={28} className="text-primary" />
                    </div>
                    <div>
                      <p className="font-bold text-lg">{selectedSession.speaker}</p>
                      <p className="text-base text-muted-foreground">{selectedSession.role}</p>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="flex items-center gap-3 text-base">
                    <Icon name="MapPin" size={18} className="text-muted-foreground" />
                    <span>{selectedSession.hall}</span>
                  </div>
                  <div className="flex items-center gap-3 text-base">
                    <Icon name="Clock" size={18} className="text-muted-foreground" />
                    <span>{selectedSession.startTime} - {selectedSession.endTime}</span>
                  </div>
                </div>

                <Separator />

                <div>
                  <h3 className="font-bold text-lg mb-3">О докладе</h3>
                  <p className="text-base text-muted-foreground leading-relaxed mb-4">
                    {selectedSession.description}
                  </p>
                </div>

                {selectedSession.bulletPoints && selectedSession.bulletPoints.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <h3 className="font-bold text-lg mb-3">Основные тезисы</h3>
                      <ul className="space-y-2">
                        {selectedSession.bulletPoints.map((point, idx) => (
                          <li key={idx} className="flex items-start gap-3">
                            <span className="text-primary text-lg mt-1">•</span>
                            <p className="text-base text-muted-foreground leading-relaxed flex-1">
                              {point}
                            </p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </>
                )}

                <Separator />

                <div>
                  <h3 className="font-bold text-lg mb-3">Теги</h3>
                  <div className="flex gap-2 flex-wrap">
                    {selectedSession.tags.map(tag => (
                      <Badge key={tag} variant="secondary" className="text-sm px-3 py-1">{tag}</Badge>
                    ))}
                  </div>
                </div>

                <Separator />

                <Button
                  className="w-full h-12 text-base"
                  variant={myPlan.includes(selectedSession.id) ? 'outline' : 'default'}
                  onClick={() => toggleMyPlan(selectedSession.id)}
                >
                  <Icon
                    name={myPlan.includes(selectedSession.id) ? 'BookmarkCheck' : 'BookmarkPlus'}
                    size={18}
                    className="mr-2"
                  />
                  {myPlan.includes(selectedSession.id) ? 'Удалить из плана' : 'Добавить в план'}
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default EventSchedule;
