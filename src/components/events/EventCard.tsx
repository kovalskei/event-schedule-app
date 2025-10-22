import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';

interface Event {
  id: number;
  name: string;
  description: string;
  start_date: string;
  end_date: string;
  program_doc_id: string;
  pain_doc_id: string;
  default_tone: string;
  status: string;
  lists_count: number;
  campaigns_count: number;
}

interface EventCardProps {
  event: Event;
  onSelect: (event: Event) => void;
}

export default function EventCard({ event, onSelect }: EventCardProps) {
  return (
    <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => onSelect(event)}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-xl mb-1">{event.name}</CardTitle>
            <CardDescription className="line-clamp-2">{event.description}</CardDescription>
          </div>
          <Badge variant={event.status === 'active' ? 'default' : 'secondary'}>
            {event.status === 'active' ? 'Активно' : 'Завершено'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-gray-500 mb-1">Начало</div>
            <div className="font-medium">{new Date(event.start_date).toLocaleDateString('ru-RU')}</div>
          </div>
          <div>
            <div className="text-gray-500 mb-1">Окончание</div>
            <div className="font-medium">{new Date(event.end_date).toLocaleDateString('ru-RU')}</div>
          </div>
        </div>
        
        <div className="flex gap-4 mt-4 pt-4 border-t">
          <div className="flex items-center gap-2 text-sm">
            <Icon name="List" className="w-4 h-4 text-gray-500" />
            <span>{event.lists_count} списков</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Icon name="Mail" className="w-4 h-4 text-gray-500" />
            <span>{event.campaigns_count} кампаний</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
