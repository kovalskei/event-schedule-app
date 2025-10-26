import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import MailingListSettings from './MailingListSettings';

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

interface ContentType {
  id: number;
  name: string;
  description: string;
}

interface EventDetailsProps {
  event: Event;
  mailingLists: MailingList[];
  contentTypes: ContentType[];
  onBack: () => void;
  onLinkList: () => void;
  onEditSettings: () => void;
  onUpdate: () => void;
}

export default function EventDetails({ event, mailingLists, contentTypes, onBack, onLinkList, onEditSettings, onUpdate }: EventDetailsProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedList, setSelectedList] = useState<MailingList | null>(null);

  const handleOpenSettings = (list: MailingList) => {
    setSelectedList(list);
    setSettingsOpen(true);
  };

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
                <div key={list.id} className="p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h4 className="font-medium">{list.unisender_list_name}</h4>
                      <p className="text-sm text-gray-500">ID: {list.unisender_list_id}</p>
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleOpenSettings(list)}
                    >
                      <Icon name="Settings" className="w-4 h-4 mr-2" />
                      Настроить
                    </Button>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">
                      <Icon name="Tag" className="w-3 h-3 mr-1" />
                      {list.utm_source}
                    </Badge>
                    <Badge variant="outline">
                      <Icon name="Radio" className="w-3 h-3 mr-1" />
                      {list.utm_medium}
                    </Badge>
                    <Badge variant="outline">
                      <Icon name="Target" className="w-3 h-3 mr-1" />
                      {list.utm_campaign}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <MailingListSettings
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        mailingList={selectedList}
        contentTypes={contentTypes}
        onUpdate={() => {
          setSettingsOpen(false);
          onUpdate();
        }}
      />
    </div>
  );
}