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

interface MailingList {
  id: number;
  event_id: number;
  unisender_list_id: string;
  unisender_list_name: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_term: string | null;
  utm_content: string | null;
  created_at: string;
}

interface EventDetailsProps {
  event: Event;
  mailingLists: MailingList[];
  onBack: () => void;
  onLinkList: () => void;
  onEditSettings: () => void;
}

export default function EventDetails({ event, mailingLists, onBack, onLinkList, onEditSettings }: EventDetailsProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onBack}>
          <Icon name="ArrowLeft" className="w-4 h-4 mr-2" />
          Назад к списку
        </Button>
        
        <Button onClick={onEditSettings} variant="outline">
          <Icon name="Settings" className="w-4 h-4 mr-2" />
          Настройки мероприятия
        </Button>
      </div>
      
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-2xl">{event.name}</CardTitle>
              <CardDescription className="mt-2">{event.description}</CardDescription>
            </div>
            <Badge variant={event.status === 'active' ? 'default' : 'secondary'}>
              {event.status === 'active' ? 'Активно' : 'Завершено'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium mb-2">Период проведения</h4>
              <div className="text-sm space-y-1">
                <div>Начало: {new Date(event.start_date).toLocaleDateString('ru-RU')}</div>
                <div>Окончание: {new Date(event.end_date).toLocaleDateString('ru-RU')}</div>
              </div>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">Документы</h4>
              <div className="text-sm space-y-1">
                <div>Программа: <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">{event.program_doc_id}</code></div>
                <div>Боли ЦА: <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">{event.pain_doc_id}</code></div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Списки рассылки</CardTitle>
              <CardDescription>
                Привязанные списки из UniSender с UTM-метками
              </CardDescription>
            </div>
            <Button onClick={onLinkList}>
              <Icon name="Link" className="w-4 h-4 mr-2" />
              Привязать список
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {mailingLists.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Icon name="Inbox" className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Нет привязанных списков</p>
            </div>
          ) : (
            <div className="space-y-4">
              {mailingLists.map((list) => (
                <div key={list.id} className="p-4 border rounded-lg">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-medium">{list.unisender_list_name}</h4>
                      <p className="text-sm text-gray-500">ID: {list.unisender_list_id}</p>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">source: {list.utm_source}</Badge>
                    <Badge variant="outline">medium: {list.utm_medium}</Badge>
                    <Badge variant="outline">campaign: {list.utm_campaign}</Badge>
                    {list.utm_term && <Badge variant="outline">term: {list.utm_term}</Badge>}
                    {list.utm_content && <Badge variant="outline">content: {list.utm_content}</Badge>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}