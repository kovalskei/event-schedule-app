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
  onManageCampaigns: () => void;
}

export default function EventDetails({ event, mailingLists, onBack, onLinkList, onEditSettings, onManageCampaigns }: EventDetailsProps) {
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
              <CardTitle>Кампании</CardTitle>
              <CardDescription>
                Email-кампании для этого мероприятия
              </CardDescription>
            </div>
            <Button onClick={onManageCampaigns}>
              <Icon name="Mail" className="w-4 h-4 mr-2" />
              Управление кампаниями
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <Icon name="Mail" className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Нажмите «Управление кампаниями» для создания и запуска</p>
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
            <div className="space-y-3">
              {mailingLists.map((list) => (
                <Card key={list.id} className="border-l-4 border-l-blue-500">
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h4 className="font-semibold text-lg">{list.unisender_list_name}</h4>
                        <p className="text-sm text-gray-500">ID: {list.unisender_list_id}</p>
                      </div>
                      <div className="flex gap-2">
                        <Badge variant="secondary">source: email</Badge>
                        <Badge variant="secondary">medium: newsletter</Badge>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 mt-3 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500">Тип контента:</span>
                        <Badge variant="outline">можно несколько типов</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500">campaign:</span>
                        <code className="text-xs bg-gray-100 px-2 py-1 rounded">{list.utm_campaign}</code>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between mt-3 pt-3 border-t">
                      <span className="text-xs text-gray-400">и выбор какой ИИ работает</span>
                      <div className="flex gap-2">
                        <Badge>demo</Badge>
                        <Badge variant="outline">openai</Badge>
                        <Badge variant="outline">claude</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}