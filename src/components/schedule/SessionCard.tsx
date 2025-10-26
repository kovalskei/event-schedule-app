import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import { Session, getDuration, getTagColor } from './types';

interface SessionCardProps {
  session: Session;
  isInPlan: boolean;
  onTogglePlan: (sessionId: string) => void;
  onClick: (session: Session) => void;
}

export default function SessionCard({ session, isInPlan, onTogglePlan, onClick }: SessionCardProps) {
  const duration = getDuration(session.startTime, session.endTime);

  return (
    <Card 
      className={cn(
        "p-4 cursor-pointer transition-all hover:shadow-md",
        isInPlan && "ring-2 ring-blue-500 dark:ring-blue-400"
      )}
      onClick={() => onClick(session)}
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
          variant={isInPlan ? 'default' : 'outline'}
          onClick={(e) => {
            e.stopPropagation();
            onTogglePlan(session.id);
          }}
          className="shrink-0"
        >
          <Icon name={isInPlan ? 'BookmarkCheck' : 'Bookmark'} className="w-4 h-4" />
        </Button>
      </div>
      <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
        {session.description}
      </p>
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
}
