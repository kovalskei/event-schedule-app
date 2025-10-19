import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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
    startTime: '10:45',
    endTime: '11:20',
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
    startTime: '11:15',
    endTime: '11:55',
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
    startTime: '10:45',
    endTime: '11:35',
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

const timeToMinutes = (time: string): number => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

const getDuration = (start: string, end: string): number => {
  return timeToMinutes(end) - timeToMinutes(start);
};

const EventSchedule = () => {
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [myPlan, setMyPlan] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [filtersOpen, setFiltersOpen] = useState(false);

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
    return planSessions.some(s => {
      const sStart = timeToMinutes(s.startTime);
      const sEnd = timeToMinutes(s.endTime);
      const sessionStart = timeToMinutes(session.startTime);
      const sessionEnd = timeToMinutes(session.endTime);
      return (sessionStart < sEnd && sessionEnd > sStart);
    });
  };

  const currentTime = '11:00';
  const nowSessions = mockSessions.filter(s => s.startTime <= currentTime && s.endTime > currentTime);

  const exportProgramToPDF = () => {
    alert('Экспорт полной программы в PDF (в разработке)');
  };

  const exportMyPlanToPDF = () => {
    alert('Экспорт личного плана в PDF (в разработке)');
  };

  const allHalls = Array.from(new Set(filteredSessions.map(s => s.hall))).sort();
  
  const earliestTime = Math.min(...filteredSessions.map(s => timeToMinutes(s.startTime)));
  const latestTime = Math.max(...filteredSessions.map(s => timeToMinutes(s.endTime)));
  
  const generateTimeLabels = () => {
    const labels: string[] = [];
    const startMinute = Math.floor(earliestTime / 15) * 15;
    const endMinute = Math.ceil(latestTime / 15) * 15;
    
    for (let minute = startMinute; minute <= endMinute; minute += 15) {
      const hours = Math.floor(minute / 60);
      const mins = minute % 60;
      labels.push(`${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`);
    }
    return labels;
  };

  const timeLabels = generateTimeLabels();
  const PIXELS_PER_MINUTE = 3;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 md:py-8 max-w-[1800px]">
        {/* Header */}
        <div className="mb-6 md:mb-8 animate-fade-in">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl md:text-5xl font-bold text-foreground mb-2">
                Премиум Форум 2025
              </h1>
              <p className="text-muted-foreground text-sm md:text-base">
                17 октября 2025 • Москва, Центр «Метрополь»
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={exportProgramToPDF}
                className="h-10 text-sm"
              >
                <Icon name="FileDown" size={16} className="mr-2" />
                Программа PDF
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                className="rounded-full h-10 w-10"
              >
                <Icon name={theme === 'light' ? 'Moon' : 'Sun'} size={18} />
              </Button>
            </div>
          </div>
          <Separator className="my-4 md:my-6" />
        </div>

        {/* Filters - Collapsible */}
        <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen} className="mb-6 md:mb-8 animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <div className="flex items-center justify-between">
            <CollapsibleTrigger asChild>
              <Button variant="outline" className="gap-2 h-10 text-sm">
                <Icon name="Filter" size={16} />
                Фильтры
                {selectedTags.length > 0 && (
                  <Badge variant="default" className="ml-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
                    {selectedTags.length}
                  </Badge>
                )}
                <Icon name={filtersOpen ? 'ChevronUp' : 'ChevronDown'} size={14} />
              </Button>
            </CollapsibleTrigger>
            {selectedTags.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedTags([])}
                className="text-sm h-10"
              >
                Сбросить
              </Button>
            )}
          </div>
          <CollapsibleContent className="mt-4">
            <div className="flex items-center gap-2 flex-wrap p-4 bg-muted/30 rounded-lg border">
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
            </div>
          </CollapsibleContent>
        </Collapsible>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 md:gap-8">
          {/* Main Schedule */}
          <div className="xl:col-span-3">
            <Tabs defaultValue="grid" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6 md:mb-8 h-11">
                <TabsTrigger value="grid" className="flex items-center gap-2 text-sm">
                  <Icon name="LayoutGrid" size={16} />
                  Программа
                </TabsTrigger>
                <TabsTrigger value="now" className="flex items-center gap-2 text-sm">
                  <Icon name="Clock" size={16} />
                  Сейчас
                </TabsTrigger>
              </TabsList>

              <TabsContent value="grid" className="mt-0">
                {/* Desktop Timeline View */}
                <div className="hidden md:block">
                  <Card className="p-6 bg-card border">
                    <ScrollArea className="h-[700px]">
                      <div className="flex gap-4">
                        {/* Time Column */}
                        <div className="w-16 flex-shrink-0 pt-12">
                          <div className="relative" style={{ height: `${(latestTime - earliestTime) * PIXELS_PER_MINUTE}px` }}>
                            {timeLabels.map((time) => {
                              const offset = (timeToMinutes(time) - earliestTime) * PIXELS_PER_MINUTE;
                              return (
                                <div
                                  key={time}
                                  className="absolute right-3 text-xs font-normal text-muted-foreground"
                                  style={{ top: `${offset}px`, transform: 'translateY(-50%)' }}
                                >
                                  {time}
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Halls Grid */}
                        <div className="flex-1">
                          {/* Sticky Hall Headers */}
                          <div className="sticky top-0 bg-card z-10 pb-3 mb-3">
                            <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${allHalls.length}, minmax(0, 1fr))` }}>
                              {allHalls.map(hall => (
                                <div key={hall} className="text-left px-4">
                                  <h4 className="font-bold text-lg uppercase tracking-wide text-foreground">
                                    {hall}
                                  </h4>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Sessions Timeline */}
                          <div className="relative grid gap-4" style={{ 
                            gridTemplateColumns: `repeat(${allHalls.length}, minmax(0, 1fr))`,
                            height: `${(latestTime - earliestTime) * PIXELS_PER_MINUTE}px`
                          }}>
                            {allHalls.map((hall) => (
                              <div key={hall} className="relative border-l border-border">
                                {filteredSessions
                                  .filter(s => s.hall === hall)
                                  .map(session => {
                                    const startOffset = (timeToMinutes(session.startTime) - earliestTime) * PIXELS_PER_MINUTE;
                                    const duration = getDuration(session.startTime, session.endTime);
                                    const height = duration * PIXELS_PER_MINUTE;
                                    
                                    return (
                                      <div
                                        key={session.id}
                                        className="absolute left-0 right-0 px-3"
                                        style={{ 
                                          top: `${startOffset}px`,
                                          height: `${height}px`
                                        }}
                                      >
                                        <Card
                                          className={cn(
                                            'h-full p-4 cursor-pointer transition-all hover:shadow-md border overflow-hidden',
                                            myPlan.includes(session.id) ? 'bg-primary/5 border-primary/50' : 'bg-card/50'
                                          )}
                                          onClick={() => setSelectedSession(session)}
                                        >
                                          <div className="flex flex-col h-full">
                                            <div className="flex items-start justify-between gap-2 mb-2">
                                              <div className="text-xs text-muted-foreground">
                                                {session.startTime} — {session.endTime}
                                              </div>
                                              <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 flex-shrink-0 -mt-1 -mr-2"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  toggleMyPlan(session.id);
                                                }}
                                              >
                                                <Icon
                                                  name={myPlan.includes(session.id) ? 'BookmarkCheck' : 'BookmarkPlus'}
                                                  size={14}
                                                  className={myPlan.includes(session.id) ? 'text-primary' : 'text-muted-foreground'}
                                                />
                                              </Button>
                                            </div>
                                            
                                            {session.tags && session.tags.length > 0 && (
                                              <div className="flex gap-1 mb-2 flex-wrap">
                                                <Badge variant="secondary" className="text-xs px-2 py-0.5 bg-primary/10 text-primary border-0">
                                                  {session.tags[0]}
                                                </Badge>
                                              </div>
                                            )}
                                            
                                            <h4 className="font-bold text-base leading-tight mb-2">
                                              {session.title}
                                            </h4>
                                            
                                            <div className="mb-2">
                                              <p className="text-sm font-medium text-foreground">
                                                {session.speaker}
                                              </p>
                                              <p className="text-sm text-muted-foreground">
                                                {session.role}
                                              </p>
                                            </div>
                                            
                                            {session.bulletPoints && session.bulletPoints.length > 0 && height > 150 && (
                                              <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                                                {session.bulletPoints.slice(0, Math.min(3, Math.floor((height - 150) / 25))).map((point, idx) => (
                                                  <div key={idx} className="flex items-start gap-2">
                                                    <span className="text-xs mt-1">—</span>
                                                    <p className="text-xs leading-relaxed line-clamp-2">{point}</p>
                                                  </div>
                                                ))}
                                              </div>
                                            )}
                                          </div>
                                        </Card>
                                      </div>
                                    );
                                  })}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </ScrollArea>
                  </Card>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden space-y-4">
                  {/* Time Chips */}
                  <div className="sticky top-0 bg-background z-10 pb-4 -mx-4 px-4">
                    <ScrollArea className="w-full">
                      <div className="flex gap-2 pb-2">
                        {Array.from(new Set(filteredSessions.map(s => s.startTime))).sort().map(time => (
                          <a
                            key={time}
                            href={`#time-${time}`}
                            className="flex-shrink-0 px-4 py-2 bg-muted hover:bg-muted/80 rounded-lg border transition-colors"
                          >
                            <span className="font-semibold text-sm text-foreground whitespace-nowrap">
                              {time}
                            </span>
                          </a>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>

                  {/* Sessions by Time */}
                  {Array.from(new Set(filteredSessions.map(s => s.startTime))).sort().map(time => {
                    const sessions = filteredSessions.filter(s => s.startTime === time);
                    return (
                      <div key={time} id={`time-${time}`} className="scroll-mt-20">
                        <h3 className="text-base font-bold text-foreground mb-3 flex items-center gap-2">
                          <Icon name="Clock" size={18} />
                          {time}
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {sessions.map(session => {
                            const duration = getDuration(session.startTime, session.endTime);
                            return (
                              <Card
                                key={session.id}
                                className={cn(
                                  'p-4 cursor-pointer transition-all active:scale-95 border',
                                  myPlan.includes(session.id) && 'ring-2 ring-primary border-primary bg-primary/5'
                                )}
                                onClick={() => setSelectedSession(session)}
                              >
                                <div className="flex justify-between items-start mb-2">
                                  <h4 className="font-bold text-sm leading-snug flex-1 pr-2">
                                    {session.title}
                                  </h4>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 flex-shrink-0"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleMyPlan(session.id);
                                    }}
                                  >
                                    <Icon
                                      name={myPlan.includes(session.id) ? 'BookmarkCheck' : 'BookmarkPlus'}
                                      size={14}
                                      className={myPlan.includes(session.id) ? 'text-primary' : ''}
                                    />
                                  </Button>
                                </div>
                                <p className="text-xs text-muted-foreground mb-3">
                                  {session.startTime}, {duration} мин
                                </p>
                                <Badge variant="outline" className="text-xs">
                                  {session.hall}
                                </Badge>
                              </Card>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </TabsContent>

              <TabsContent value="now" className="mt-0">
                <div className="space-y-4">
                  {nowSessions.length > 0 ? (
                    nowSessions.map((session, idx) => (
                      <Card
                        key={session.id}
                        className="p-6 md:p-8 cursor-pointer hover:shadow-lg transition-all bg-primary/5 border-primary/30 animate-fade-in"
                        style={{ animationDelay: `${idx * 0.1}s` }}
                        onClick={() => setSelectedSession(session)}
                      >
                        <div className="flex flex-col md:flex-row items-start gap-4 md:gap-6">
                          <div className="flex-shrink-0">
                            <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-primary/20 flex items-center justify-center">
                              <Icon name="Radio" size={24} className="text-primary animate-pulse" />
                            </div>
                          </div>
                          <div className="flex-1">
                            <Badge className="mb-3 text-xs">Идёт сейчас</Badge>
                            <h3 className="text-xl md:text-2xl font-bold mb-2">{session.title}</h3>
                            <p className="text-sm font-medium text-foreground mb-1">
                              {session.speaker}
                            </p>
                            <p className="text-sm text-muted-foreground mb-2">
                              {session.role}
                            </p>
                            <p className="text-sm text-muted-foreground mb-4">
                              {session.hall} • {session.startTime} - {session.endTime}
                            </p>
                            <p className="text-sm mb-4 leading-relaxed">{session.description}</p>
                            <div className="flex gap-2 flex-wrap">
                              {session.tags.map(tag => (
                                <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))
                  ) : (
                    <Card className="p-12 md:p-16 text-center border-dashed">
                      <Icon name="Coffee" size={48} className="mx-auto mb-4 text-muted-foreground" />
                      <h3 className="text-xl font-bold mb-2">Перерыв</h3>
                      <p className="text-muted-foreground text-sm">Сейчас идёт перерыв. Следующая сессия начнётся в 14:00</p>
                    </Card>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* My Plan Sidebar */}
          <div className="xl:col-span-1">
            <Card className="p-5 md:p-6 sticky top-8 bg-card border animate-fade-in" style={{ animationDelay: '0.2s' }}>
              <h2 className="text-xl md:text-2xl font-bold mb-4 flex items-center gap-2">
                <Icon name="Calendar" size={22} />
                Мой план
              </h2>
              <Separator className="mb-4" />
              <ScrollArea className="h-[400px] md:h-[550px]">
                {myPlan.length === 0 ? (
                  <div className="text-center py-12 md:py-16">
                    <Icon name="CalendarX" size={48} className="mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground text-sm leading-relaxed px-4">
                      Добавляйте доклады из расписания
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {myPlan.map((sessionId, idx) => {
                      const session = mockSessions.find(s => s.id === sessionId);
                      if (!session) return null;
                      const conflict = hasConflict(session);
                      return (
                        <Card
                          key={sessionId}
                          className={cn(
                            'p-3 cursor-pointer transition-all hover:shadow-md animate-scale-in border',
                            conflict && 'border-destructive bg-destructive/5'
                          )}
                          style={{ animationDelay: `${idx * 0.05}s` }}
                          onClick={() => setSelectedSession(session)}
                        >
                          {conflict && (
                            <div className="flex items-center gap-1 text-xs text-destructive mb-2 font-medium">
                              <Icon name="AlertCircle" size={12} />
                              Конфликт
                            </div>
                          )}
                          <div className="flex justify-between items-start mb-2">
                            <Badge variant="secondary" className="text-xs">
                              {session.startTime}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleMyPlan(session.id);
                              }}
                            >
                              <Icon name="X" size={12} />
                            </Button>
                          </div>
                          <h4 className="font-bold text-xs mb-1 leading-snug line-clamp-2">
                            {session.title}
                          </h4>
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
                  <Separator className="my-4" />
                  <Button 
                    className="w-full h-10 text-sm" 
                    variant="default"
                    onClick={exportMyPlanToPDF}
                  >
                    <Icon name="FileDown" size={16} className="mr-2" />
                    Экспорт PDF
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
                <SheetTitle className="text-2xl md:text-3xl font-bold pr-8">{selectedSession.title}</SheetTitle>
              </SheetHeader>
              <div className="mt-6 md:mt-8 space-y-5 md:space-y-6">
                <div>
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Icon name="User" size={24} className="text-primary" />
                    </div>
                    <div>
                      <p className="font-bold text-base">{selectedSession.speaker}</p>
                      <p className="text-sm text-muted-foreground">{selectedSession.role}</p>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-sm">
                    <Icon name="MapPin" size={16} className="text-muted-foreground" />
                    <span>{selectedSession.hall}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Icon name="Clock" size={16} className="text-muted-foreground" />
                    <span>{selectedSession.startTime} - {selectedSession.endTime}</span>
                  </div>
                </div>

                <Separator />

                <div>
                  <h3 className="font-bold text-base mb-3">О докладе</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {selectedSession.description}
                  </p>
                </div>

                {selectedSession.bulletPoints && selectedSession.bulletPoints.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <h3 className="font-bold text-base mb-3">Основные тезисы</h3>
                      <ul className="space-y-2">
                        {selectedSession.bulletPoints.map((point, idx) => (
                          <li key={idx} className="flex items-start gap-3">
                            <span className="text-primary text-base mt-0.5">•</span>
                            <p className="text-sm text-muted-foreground leading-relaxed flex-1">
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
                  <h3 className="font-bold text-base mb-3">Теги</h3>
                  <div className="flex gap-2 flex-wrap">
                    {selectedSession.tags.map(tag => (
                      <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                    ))}
                  </div>
                </div>

                <Separator />

                <Button
                  className="w-full h-11 text-sm"
                  variant={myPlan.includes(selectedSession.id) ? 'outline' : 'default'}
                  onClick={() => toggleMyPlan(selectedSession.id)}
                >
                  <Icon
                    name={myPlan.includes(selectedSession.id) ? 'BookmarkCheck' : 'BookmarkPlus'}
                    size={16}
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