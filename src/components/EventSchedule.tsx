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
    tags: ['Финансы', 'Стратегия']
  }
];

const halls = ['Главный зал', 'Зал А', 'Зал B'];
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8 animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-5xl font-serif font-bold text-foreground mb-2">
                Премиум Форум 2025
              </h1>
              <p className="text-muted-foreground text-lg">
                17 октября 2025 • Москва, Центр «Метрополь»
              </p>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              className="rounded-full"
            >
              <Icon name={theme === 'light' ? 'Moon' : 'Sun'} size={20} />
            </Button>
          </div>
          <Separator className="my-6" />
        </div>

        {/* Filters */}
        <div className="mb-6 animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <div className="flex items-center gap-2 flex-wrap">
            <Icon name="Filter" size={18} className="text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">Фильтры:</span>
            {allTags.map(tag => (
              <Badge
                key={tag}
                variant={selectedTags.includes(tag) ? 'default' : 'outline'}
                className={cn(
                  'cursor-pointer transition-all hover-scale',
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
                className="text-xs"
              >
                Сбросить
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Schedule */}
          <div className="lg:col-span-2">
            <Tabs defaultValue="grid" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="grid" className="flex items-center gap-2">
                  <Icon name="LayoutGrid" size={16} />
                  Программа
                </TabsTrigger>
                <TabsTrigger value="now" className="flex items-center gap-2">
                  <Icon name="Clock" size={16} />
                  Сейчас
                </TabsTrigger>
              </TabsList>

              <TabsContent value="grid" className="mt-0">
                <Card className="p-6 bg-card/50 backdrop-blur-sm border-accent/20">
                  <ScrollArea className="h-[600px]">
                    <div className="space-y-8">
                      {timeSlots.map((time, timeIdx) => (
                        <div key={time} className="animate-fade-in" style={{ animationDelay: `${timeIdx * 0.1}s` }}>
                          <div className="sticky top-0 bg-card/95 backdrop-blur-sm py-2 mb-4 z-10 border-b border-accent/20">
                            <h3 className="text-lg font-semibold text-primary flex items-center gap-2">
                              <Icon name="Clock" size={18} />
                              {time}
                            </h3>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {halls.map(hall => {
                              const session = filteredSessions.find(
                                s => s.hall === hall && s.startTime === time
                              );
                              return (
                                <div key={hall}>
                                  {session ? (
                                    <Card
                                      className={cn(
                                        'p-4 cursor-pointer transition-all hover:shadow-lg hover:-translate-y-1',
                                        'bg-gradient-to-br from-card to-accent/5 border-accent/20',
                                        myPlan.includes(session.id) && 'ring-2 ring-primary'
                                      )}
                                      onClick={() => setSelectedSession(session)}
                                    >
                                      <div className="flex justify-between items-start mb-2">
                                        <Badge variant="outline" className="text-xs">
                                          {session.hall}
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
                                          <Icon
                                            name={myPlan.includes(session.id) ? 'BookmarkCheck' : 'BookmarkPlus'}
                                            size={14}
                                            className={myPlan.includes(session.id) ? 'text-primary' : ''}
                                          />
                                        </Button>
                                      </div>
                                      <h4 className="font-semibold text-sm mb-2 line-clamp-2">
                                        {session.title}
                                      </h4>
                                      <p className="text-xs text-muted-foreground mb-1">
                                        {session.speaker}
                                      </p>
                                      <p className="text-xs text-muted-foreground/80">
                                        {session.role}
                                      </p>
                                      <div className="flex gap-1 mt-2 flex-wrap">
                                        {session.tags.slice(0, 2).map(tag => (
                                          <Badge key={tag} variant="secondary" className="text-xs px-1.5 py-0">
                                            {tag}
                                          </Badge>
                                        ))}
                                      </div>
                                    </Card>
                                  ) : (
                                    <Card className="p-4 border-dashed border-accent/20 bg-transparent">
                                      <p className="text-xs text-muted-foreground text-center">
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
                <div className="space-y-4">
                  {nowSessions.length > 0 ? (
                    nowSessions.map((session, idx) => (
                      <Card
                        key={session.id}
                        className="p-6 cursor-pointer hover:shadow-lg transition-all bg-gradient-to-r from-primary/10 to-accent/10 border-primary/20 animate-fade-in"
                        style={{ animationDelay: `${idx * 0.1}s` }}
                        onClick={() => setSelectedSession(session)}
                      >
                        <div className="flex items-start gap-4">
                          <div className="flex-shrink-0">
                            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                              <Icon name="Radio" size={24} className="text-primary animate-pulse" />
                            </div>
                          </div>
                          <div className="flex-1">
                            <Badge className="mb-2">Идёт сейчас</Badge>
                            <h3 className="font-serif text-xl font-bold mb-2">{session.title}</h3>
                            <p className="text-sm text-muted-foreground mb-1">
                              {session.speaker} — {session.role}
                            </p>
                            <p className="text-sm text-muted-foreground mb-3">
                              {session.hall} • {session.startTime} - {session.endTime}
                            </p>
                            <p className="text-sm mb-3">{session.description}</p>
                            <div className="flex gap-2">
                              {session.tags.map(tag => (
                                <Badge key={tag} variant="secondary">{tag}</Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))
                  ) : (
                    <Card className="p-12 text-center border-dashed">
                      <Icon name="Coffee" size={48} className="mx-auto mb-4 text-muted-foreground" />
                      <h3 className="text-xl font-semibold mb-2">Перерыв</h3>
                      <p className="text-muted-foreground">Сейчас идёт перерыв. Следующая сессия начнётся в 14:00</p>
                    </Card>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* My Plan Sidebar */}
          <div className="lg:col-span-1">
            <Card className="p-6 sticky top-8 bg-card/50 backdrop-blur-sm border-accent/20 animate-fade-in" style={{ animationDelay: '0.2s' }}>
              <h2 className="text-2xl font-serif font-bold mb-4 flex items-center gap-2">
                <Icon name="Calendar" size={24} />
                Мой план
              </h2>
              <Separator className="mb-4" />
              <ScrollArea className="h-[550px]">
                {myPlan.length === 0 ? (
                  <div className="text-center py-12">
                    <Icon name="CalendarX" size={48} className="mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground text-sm">
                      Выберите доклады, которые хотите посетить
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
                            'p-4 cursor-pointer transition-all hover:shadow-md animate-scale-in',
                            conflict && 'border-destructive bg-destructive/5'
                          )}
                          style={{ animationDelay: `${idx * 0.05}s` }}
                          onClick={() => setSelectedSession(session)}
                        >
                          {conflict && (
                            <div className="flex items-center gap-1 text-xs text-destructive mb-2">
                              <Icon name="AlertCircle" size={12} />
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
                              className="h-6 w-6"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleMyPlan(session.id);
                              }}
                            >
                              <Icon name="X" size={14} />
                            </Button>
                          </div>
                          <h4 className="font-semibold text-sm mb-1 line-clamp-2">
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
                  <Button className="w-full" variant="default">
                    <Icon name="FileDown" size={16} className="mr-2" />
                    Экспорт в PDF
                  </Button>
                </>
              )}
            </Card>
          </div>
        </div>
      </div>

      {/* Session Details Sheet */}
      <Sheet open={!!selectedSession} onOpenChange={() => setSelectedSession(null)}>
        <SheetContent className="w-full sm:max-w-lg">
          {selectedSession && (
            <div className="animate-fade-in">
              <SheetHeader>
                <SheetTitle className="text-2xl font-serif">{selectedSession.title}</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-6">
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                      <Icon name="User" size={24} className="text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold">{selectedSession.speaker}</p>
                      <p className="text-sm text-muted-foreground">{selectedSession.role}</p>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Icon name="MapPin" size={16} className="text-muted-foreground" />
                    <span>{selectedSession.hall}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Icon name="Clock" size={16} className="text-muted-foreground" />
                    <span>{selectedSession.startTime} - {selectedSession.endTime}</span>
                  </div>
                </div>

                <Separator />

                <div>
                  <h3 className="font-semibold mb-2">О докладе</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {selectedSession.description}
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Теги</h3>
                  <div className="flex gap-2 flex-wrap">
                    {selectedSession.tags.map(tag => (
                      <Badge key={tag} variant="secondary">{tag}</Badge>
                    ))}
                  </div>
                </div>

                <Separator />

                <Button
                  className="w-full"
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
