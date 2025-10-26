import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { Session, getDuration, getTagColor } from './types';
import { cn } from '@/lib/utils';

interface MyPlanViewProps {
  plannedSessions: Session[];
  onTogglePlan: (sessionId: string) => void;
  onSessionClick: (session: Session) => void;
  onExport: () => void;
}

export default function MyPlanView({ plannedSessions, onTogglePlan, onSessionClick, onExport }: MyPlanViewProps) {
  if (plannedSessions.length === 0) {
    return (
      <div className="text-center py-12">
        <Icon name="Calendar" className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
        <h3 className="text-lg font-semibold mb-2">Ваш план пуст</h3>
        <p className="text-muted-foreground">
          Добавьте сессии из расписания, чтобы создать персональный план
        </p>
      </div>
    );
  }

  const sortedSessions = [...plannedSessions].sort((a, b) => {
    if (a.startTime === b.startTime) {
      return a.hall.localeCompare(b.hall);
    }
    return a.startTime.localeCompare(b.startTime);
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          Сессий в плане: {plannedSessions.length}
        </p>
        <Button variant="outline" size="sm" onClick={onExport}>
          <Icon name="Download" className="w-4 h-4 mr-2" />
          Экспорт
        </Button>
      </div>

      <div className="space-y-3">
        {sortedSessions.map(session => {
          const duration = getDuration(session.startTime, session.endTime);
          
          return (
            <Card 
              key={session.id}
              className="p-4 cursor-pointer hover:shadow-md transition-all"
              onClick={() => onSessionClick(session)}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-xs">
                      {session.startTime} - {session.endTime} ({duration} мин)
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {session.hall}
                    </Badge>
                  </div>
                  <h3 className="font-semibold text-base mb-1">{session.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {session.speaker} • {session.role}
                  </p>
                </div>
                <Button
                  size="icon"
                  variant="default"
                  onClick={(e) => {
                    e.stopPropagation();
                    onTogglePlan(session.id);
                  }}
                  className="shrink-0"
                >
                  <Icon name="BookmarkCheck" className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-1">
                {session.tags.map(tag => (
                  <Badge 
                    key={tag} 
                    variant="secondary" 
                    className={cn("text-xs", getTagColor(tag))}
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
