import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import SessionCard from './schedule/SessionCard';
import SessionDetail from './schedule/SessionDetail';
import SessionFilters from './schedule/SessionFilters';
import TimelineView from './schedule/TimelineView';
import MyPlanView from './schedule/MyPlanView';
import { Session, mockSessions } from './schedule/types';

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

    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.classList.toggle('dark', savedTheme === 'dark');
    }
  }, []);

  const togglePlan = (sessionId: string) => {
    setMyPlan(prev => {
      const newPlan = prev.includes(sessionId)
        ? prev.filter(id => id !== sessionId)
        : [...prev, sessionId];
      localStorage.setItem('myPlan', JSON.stringify(newPlan));
      return newPlan;
    });
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
  };

  const exportPlan = () => {
    const plannedSessions = mockSessions.filter(s => myPlan.includes(s.id));
    const text = plannedSessions
      .map(s => `${s.startTime} - ${s.endTime} | ${s.hall}\n${s.title}\n${s.speaker}\n`)
      .join('\n');
    
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'my-event-plan.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredSessions = mockSessions.filter(session => {
    if (selectedTags.length === 0) return true;
    return session.tags.some(tag => selectedTags.includes(tag));
  });

  const plannedSessions = mockSessions.filter(s => myPlan.includes(s.id));

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4 md:p-8 transition-colors">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-2">
              Расписание конференции
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              Выберите интересные сессии и создайте свой план
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={toggleTheme}>
            <Icon name={theme === 'light' ? 'Moon' : 'Sun'} className="w-5 h-5" />
          </Button>
        </div>

        <Tabs defaultValue="list" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 max-w-md">
            <TabsTrigger value="list">
              <Icon name="List" className="w-4 h-4 mr-2" />
              Список
            </TabsTrigger>
            <TabsTrigger value="timeline">
              <Icon name="Calendar" className="w-4 h-4 mr-2" />
              Таймлайн
            </TabsTrigger>
            <TabsTrigger value="myplan">
              <Icon name="BookmarkCheck" className="w-4 h-4 mr-2" />
              Мой план ({myPlan.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="space-y-4">
            <SessionFilters
              selectedTags={selectedTags}
              onTagToggle={toggleTag}
              filtersOpen={filtersOpen}
              onFiltersToggle={() => setFiltersOpen(!filtersOpen)}
            />
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredSessions.map(session => (
                <SessionCard
                  key={session.id}
                  session={session}
                  isInPlan={myPlan.includes(session.id)}
                  onTogglePlan={togglePlan}
                  onClick={setSelectedSession}
                />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="timeline">
            <TimelineView
              sessions={filteredSessions}
              myPlan={myPlan}
              onTogglePlan={togglePlan}
              onSessionClick={setSelectedSession}
            />
          </TabsContent>

          <TabsContent value="myplan">
            <MyPlanView
              plannedSessions={plannedSessions}
              onTogglePlan={togglePlan}
              onSessionClick={setSelectedSession}
              onExport={exportPlan}
            />
          </TabsContent>
        </Tabs>

        <SessionDetail
          session={selectedSession}
          isOpen={selectedSession !== null}
          isInPlan={selectedSession ? myPlan.includes(selectedSession.id) : false}
          onClose={() => setSelectedSession(null)}
          onTogglePlan={togglePlan}
        />
      </div>
    </div>
  );
};

export default EventSchedule;
