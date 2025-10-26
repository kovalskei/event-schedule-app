import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import Icon from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import { Session, getDuration, getTagColor } from './types';

interface SessionDetailProps {
  session: Session | null;
  isOpen: boolean;
  isInPlan: boolean;
  onClose: () => void;
  onTogglePlan: (sessionId: string) => void;
}

export default function SessionDetail({ session, isOpen, isInPlan, onClose, onTogglePlan }: SessionDetailProps) {
  if (!session) return null;

  const duration = getDuration(session.startTime, session.endTime);

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="text-xl">{session.title}</SheetTitle>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-120px)] mt-6">
          <div className="space-y-4 pr-4">
            <div className="flex gap-2 flex-wrap">
              <Badge variant="outline">
                <Icon name="Clock" className="w-3 h-3 mr-1" />
                {session.startTime} - {session.endTime} ({duration} мин)
              </Badge>
              <Badge variant="secondary">
                <Icon name="MapPin" className="w-3 h-3 mr-1" />
                {session.hall}
              </Badge>
            </div>

            <div>
              <h4 className="font-semibold mb-1">Спикер</h4>
              <p className="text-sm">{session.speaker}</p>
              <p className="text-sm text-muted-foreground">{session.role}</p>
            </div>

            <Separator />

            <div>
              <h4 className="font-semibold mb-2">Описание</h4>
              <p className="text-sm text-muted-foreground">{session.description}</p>
            </div>

            {session.bulletPoints.length > 0 && (
              <>
                <Separator />
                <div>
                  <h4 className="font-semibold mb-2">Основные темы</h4>
                  <ul className="space-y-2">
                    {session.bulletPoints.map((point, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm">
                        <Icon name="Check" className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                        <span className="text-muted-foreground">{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}

            <Separator />

            <div>
              <h4 className="font-semibold mb-2">Теги</h4>
              <div className="flex flex-wrap gap-2">
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
            </div>

            <Separator />

            <Button 
              onClick={() => onTogglePlan(session.id)} 
              className="w-full"
              variant={isInPlan ? 'outline' : 'default'}
            >
              <Icon name={isInPlan ? 'BookmarkCheck' : 'Bookmark'} className="w-4 h-4 mr-2" />
              {isInPlan ? 'Убрать из плана' : 'Добавить в план'}
            </Button>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
