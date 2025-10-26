import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import { Session, getDuration, getTagColor } from './types';

interface TimelineViewProps {
  sessions: Session[];
  myPlan: string[];
  onTogglePlan: (sessionId: string) => void;
  onSessionClick: (session: Session) => void;
}

export default function TimelineView({ sessions, myPlan, onTogglePlan, onSessionClick }: TimelineViewProps) {
  const halls = Array.from(new Set(sessions.map(s => s.hall))).sort();
  const timeSlots = Array.from(new Set(sessions.map(s => s.startTime))).sort();

  return (
    <div className="overflow-x-auto">
      <div className="min-w-max">
        <div className="grid gap-4" style={{ gridTemplateColumns: `120px repeat(${halls.length}, minmax(280px, 1fr))` }}>
          <div className="font-semibold text-sm"></div>
          {halls.map(hall => (
            <div key={hall} className="font-semibold text-sm p-2 bg-muted rounded-lg text-center">
              {hall}
            </div>
          ))}

          {timeSlots.map(time => (
            <div key={time} className="contents">
              <div className="font-medium text-sm py-4 text-muted-foreground">
                {time}
              </div>
              {halls.map(hall => {
                const session = sessions.find(s => s.startTime === time && s.hall === hall);
                if (!session) {
                  return <div key={`${time}-${hall}`} className="py-4"></div>;
                }

                const duration = getDuration(session.startTime, session.endTime);
                const isInPlan = myPlan.includes(session.id);

                return (
                  <Card
                    key={session.id}
                    className={cn(
                      "p-3 cursor-pointer transition-all hover:shadow-md",
                      isInPlan && "ring-2 ring-blue-500 dark:ring-blue-400"
                    )}
                    onClick={() => onSessionClick(session)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <Badge variant="outline" className="text-xs">
                        {duration} мин
                      </Badge>
                      <Button
                        size="icon"
                        variant={isInPlan ? 'default' : 'ghost'}
                        onClick={(e) => {
                          e.stopPropagation();
                          onTogglePlan(session.id);
                        }}
                        className="h-6 w-6"
                      >
                        <Icon name={isInPlan ? 'BookmarkCheck' : 'Bookmark'} className="w-3 h-3" />
                      </Button>
                    </div>
                    <h4 className="font-semibold text-sm mb-1 line-clamp-2">{session.title}</h4>
                    <p className="text-xs text-muted-foreground mb-2">{session.speaker}</p>
                    <div className="flex flex-wrap gap-1">
                      {session.tags.slice(0, 2).map(tag => (
                        <Badge 
                          key={tag} 
                          variant="secondary" 
                          className={cn("text-xs", getTagColor(tag))}
                        >
                          {tag}
                        </Badge>
                      ))}
                      {session.tags.length > 2 && (
                        <Badge variant="secondary" className="text-xs">
                          +{session.tags.length - 2}
                        </Badge>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
