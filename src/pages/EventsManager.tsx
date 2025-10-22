import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import { Link } from 'react-router-dom';

const EVENTS_MANAGER_URL = 'https://functions.poehali.dev/b56e5895-fb22-4d96-b746-b046a9fd2750';
const SYNC_UNISENDER_URL = 'https://functions.poehali.dev/b7fefc5f-605d-4c44-8830-b5cf0c00ca0e';

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
  name: string;
  unisender_list_id: string;
  subscriber_count: number;
  description: string;
  utm_rules_count: number;
  link_rules_count: number;
}

export default function EventsManager() {
  const { toast } = useToast();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [mailingLists, setMailingLists] = useState<MailingList[]>([]);
  
  const [createEventOpen, setCreateEventOpen] = useState(false);
  const [createListOpen, setCreateListOpen] = useState(false);
  const [createUtmOpen, setCreateUtmOpen] = useState(false);
  
  const [newEvent, setNewEvent] = useState({
    name: '',
    description: '',
    start_date: '',
    end_date: '',
    program_doc_id: '',
    pain_doc_id: '',
    default_tone: 'professional',
  });
  
  const [newList, setNewList] = useState({
    name: '',
    unisender_list_id: '',
    description: '',
  });
  
  const [newUtm, setNewUtm] = useState({
    mailing_list_id: 0,
    utm_source: 'email',
    utm_medium: 'newsletter',
    utm_campaign: '',
    utm_term: '',
    utm_content: '',
  });

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${EVENTS_MANAGER_URL}?action=list_events`);
      const data = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setEvents(data.events);
    } catch (error: any) {
      toast({
        title: 'Ошибка загрузки',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadEventDetails = async (eventId: number) => {
    try {
      const res = await fetch(`${EVENTS_MANAGER_URL}?action=get_event&event_id=${eventId}`);
      const data = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setSelectedEvent(data.event);
      setMailingLists(data.mailing_lists);
    } catch (error: any) {
      toast({
        title: 'Ошибка загрузки деталей',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleCreateEvent = async () => {
    if (!newEvent.name) {
      toast({
        title: 'Ошибка',
        description: 'Укажите название мероприятия',
        variant: 'destructive',
      });
      return;
    }

    try {
      const res = await fetch(EVENTS_MANAGER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_event',
          ...newEvent,
        }),
      });

      const data = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }

      toast({
        title: 'Мероприятие создано',
        description: `"${newEvent.name}" успешно добавлено`,
      });

      setCreateEventOpen(false);
      setNewEvent({
        name: '',
        description: '',
        start_date: '',
        end_date: '',
        program_doc_id: '',
        pain_doc_id: '',
        default_tone: 'professional',
      });
      loadEvents();
    } catch (error: any) {
      toast({
        title: 'Ошибка создания',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleCreateList = async () => {
    if (!newList.name || !selectedEvent) {
      toast({
        title: 'Ошибка',
        description: 'Укажите название списка',
        variant: 'destructive',
      });
      return;
    }

    try {
      const res = await fetch(EVENTS_MANAGER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_mailing_list',
          event_id: selectedEvent.id,
          ...newList,
        }),
      });

      const data = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }

      toast({
        title: 'Список создан',
        description: `"${newList.name}" добавлен`,
      });

      setCreateListOpen(false);
      setNewList({
        name: '',
        unisender_list_id: '',
        description: '',
      });
      loadEventDetails(selectedEvent.id);
    } catch (error: any) {
      toast({
        title: 'Ошибка создания списка',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleCreateUtm = async () => {
    if (!newUtm.mailing_list_id) {
      toast({
        title: 'Ошибка',
        description: 'Выберите список рассылки',
        variant: 'destructive',
      });
      return;
    }

    try {
      const res = await fetch(EVENTS_MANAGER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_utm_rule',
          ...newUtm,
        }),
      });

      const data = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }

      toast({
        title: 'UTM правило создано',
        description: 'Метки будут добавлены ко всем ссылкам',
      });

      setCreateUtmOpen(false);
      if (selectedEvent) {
        loadEventDetails(selectedEvent.id);
      }
    } catch (error: any) {
      toast({
        title: 'Ошибка создания UTM',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleSyncEvent = async (eventId: number) => {
    try {
      const res = await fetch(SYNC_UNISENDER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sync_event',
          event_id: eventId,
        }),
      });

      const data = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }

      toast({
        title: 'Синхронизация выполнена',
        description: `Список создан в UniSender (ID: ${data.unisender_list_id})`,
      });

      loadEvents();
      if (selectedEvent?.id === eventId) {
        loadEventDetails(eventId);
      }
    } catch (error: any) {
      toast({
        title: 'Ошибка синхронизации',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleSyncAll = async () => {
    try {
      const res = await fetch(SYNC_UNISENDER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sync_all',
        }),
      });

      const data = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }

      toast({
        title: 'Синхронизация завершена',
        description: `Синхронизировано событий: ${data.synced.length}, ошибок: ${data.errors.length}`,
      });

      loadEvents();
    } catch (error: any) {
      toast({
        title: 'Ошибка массовой синхронизации',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              Управление мероприятиями
            </h1>
            <p className="text-lg text-gray-600">
              Настройте мероприятия, списки рассылок и UTM-метки
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSyncAll} variant="outline">
              <Icon name="RefreshCw" className="w-4 h-4 mr-2" />
              Синхронизировать все с UniSender
            </Button>
            <Dialog open={createEventOpen} onOpenChange={setCreateEventOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Icon name="Plus" className="w-4 h-4 mr-2" />
                  Новое мероприятие
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Создание мероприятия</DialogTitle>
                  <DialogDescription>
                    Добавьте новое мероприятие для организации рассылок
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="eventName">Название мероприятия *</Label>
                    <Input
                      id="eventName"
                      value={newEvent.name}
                      onChange={(e) => setNewEvent({ ...newEvent, name: e.target.value })}
                      placeholder="HR Tech Conference 2025"
                    />
                  </div>
                  <div>
                    <Label htmlFor="eventDesc">Описание</Label>
                    <Textarea
                      id="eventDesc"
                      value={newEvent.description}
                      onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                      placeholder="Описание мероприятия..."
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="startDate">Дата начала</Label>
                      <Input
                        id="startDate"
                        type="date"
                        value={newEvent.start_date}
                        onChange={(e) => setNewEvent({ ...newEvent, start_date: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="endDate">Дата окончания</Label>
                      <Input
                        id="endDate"
                        type="date"
                        value={newEvent.end_date}
                        onChange={(e) => setNewEvent({ ...newEvent, end_date: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="programDoc">ID документа программы</Label>
                    <Input
                      id="programDoc"
                      value={newEvent.program_doc_id}
                      onChange={(e) => setNewEvent({ ...newEvent, program_doc_id: e.target.value })}
                      placeholder="1abc2def3ghi..."
                    />
                  </div>
                  <div>
                    <Label htmlFor="painDoc">ID документа болей ЦА</Label>
                    <Input
                      id="painDoc"
                      value={newEvent.pain_doc_id}
                      onChange={(e) => setNewEvent({ ...newEvent, pain_doc_id: e.target.value })}
                      placeholder="4jkl5mno6pqr..."
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCreateEventOpen(false)}>
                    Отмена
                  </Button>
                  <Button onClick={handleCreateEvent}>Создать</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Link to="/">
              <Button variant="outline">
                <Icon name="ArrowLeft" className="w-4 h-4 mr-2" />
                К рассылкам
              </Button>
            </Link>
          </div>
        </div>

        {loading ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Icon name="Loader2" className="w-8 h-8 animate-spin mx-auto mb-4 text-gray-400" />
              <p className="text-gray-600">Загрузка...</p>
            </CardContent>
          </Card>
        ) : events.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Icon name="Calendar" className="w-16 h-16 mx-auto mb-4 text-gray-400" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Пока нет мероприятий
              </h3>
              <p className="text-gray-600 mb-4">
                Создайте первое мероприятие для организации рассылок
              </p>
              <Button onClick={() => setCreateEventOpen(true)}>
                <Icon name="Plus" className="w-4 h-4 mr-2" />
                Создать мероприятие
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-4">
              <h2 className="text-xl font-bold text-gray-900">Мероприятия</h2>
              {events.map((event) => (
                <Card
                  key={event.id}
                  className={`cursor-pointer transition-all ${
                    selectedEvent?.id === event.id ? 'ring-2 ring-blue-500' : 'hover:shadow-md'
                  }`}
                  onClick={() => loadEventDetails(event.id)}
                >
                  <CardHeader>
                    <CardTitle className="text-lg">{event.name}</CardTitle>
                    <CardDescription>
                      {event.start_date && new Date(event.start_date).toLocaleDateString('ru-RU')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-4 text-sm text-gray-600 mb-3">
                      <div className="flex items-center gap-1">
                        <Icon name="List" className="w-4 h-4" />
                        {event.lists_count} списков
                      </div>
                      <div className="flex items-center gap-1">
                        <Icon name="Mail" className="w-4 h-4" />
                        {event.campaigns_count} кампаний
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSyncEvent(event.id);
                      }}
                    >
                      <Icon name="RefreshCw" className="w-4 h-4 mr-2" />
                      Синхронизировать
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="lg:col-span-2">
              {selectedEvent ? (
                <div className="space-y-4">
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle>{selectedEvent.name}</CardTitle>
                          <CardDescription>{selectedEvent.description}</CardDescription>
                        </div>
                        <Badge>{selectedEvent.status}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {selectedEvent.program_doc_id && (
                        <div>
                          <p className="text-sm text-gray-500">Программа:</p>
                          <p className="text-sm font-mono">{selectedEvent.program_doc_id}</p>
                        </div>
                      )}
                      {selectedEvent.pain_doc_id && (
                        <div>
                          <p className="text-sm text-gray-500">Боли ЦА:</p>
                          <p className="text-sm font-mono">{selectedEvent.pain_doc_id}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Списки рассылки</h3>
                    <Dialog open={createListOpen} onOpenChange={setCreateListOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm">
                          <Icon name="Plus" className="w-4 h-4 mr-2" />
                          Добавить список
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Новый список рассылки</DialogTitle>
                          <DialogDescription>
                            Создайте список для сегмента аудитории
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="listName">Название списка *</Label>
                            <Input
                              id="listName"
                              value={newList.name}
                              onChange={(e) => setNewList({ ...newList, name: e.target.value })}
                              placeholder="VIP-гости"
                            />
                          </div>
                          <div>
                            <Label htmlFor="unisenderList">ID списка в UniSender</Label>
                            <Input
                              id="unisenderList"
                              value={newList.unisender_list_id}
                              onChange={(e) => setNewList({ ...newList, unisender_list_id: e.target.value })}
                              placeholder="12345"
                            />
                          </div>
                          <div>
                            <Label htmlFor="listDesc">Описание</Label>
                            <Textarea
                              id="listDesc"
                              value={newList.description}
                              onChange={(e) => setNewList({ ...newList, description: e.target.value })}
                              placeholder="HR-директора из ритейла"
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setCreateListOpen(false)}>
                            Отмена
                          </Button>
                          <Button onClick={handleCreateList}>Создать</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>

                  {mailingLists.length === 0 ? (
                    <Card>
                      <CardContent className="p-8 text-center">
                        <Icon name="List" className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                        <p className="text-gray-600">Нет списков рассылки</p>
                      </CardContent>
                    </Card>
                  ) : (
                    mailingLists.map((list) => (
                      <Card key={list.id}>
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-lg">{list.name}</CardTitle>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setNewUtm({ ...newUtm, mailing_list_id: list.id });
                                setCreateUtmOpen(true);
                              }}
                            >
                              <Icon name="Link" className="w-4 h-4 mr-2" />
                              UTM метки
                            </Button>
                          </div>
                          <CardDescription>{list.description}</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="flex gap-4 text-sm">
                            <div className="flex items-center gap-1">
                              <Icon name="Users" className="w-4 h-4 text-gray-500" />
                              {list.subscriber_count} подписчиков
                            </div>
                            <div className="flex items-center gap-1">
                              <Icon name="Link" className="w-4 h-4 text-gray-500" />
                              {list.utm_rules_count} UTM правил
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              ) : (
                <Card>
                  <CardContent className="p-12 text-center">
                    <Icon name="ArrowLeft" className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                    <p className="text-gray-600">Выберите мероприятие слева</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}

        <Dialog open={createUtmOpen} onOpenChange={setCreateUtmOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Настройка UTM-меток</DialogTitle>
              <DialogDescription>
                Метки будут автоматически добавлены ко всем ссылкам в рассылках
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="utmSource">utm_source</Label>
                <Input
                  id="utmSource"
                  value={newUtm.utm_source}
                  onChange={(e) => setNewUtm({ ...newUtm, utm_source: e.target.value })}
                  placeholder="email"
                />
              </div>
              <div>
                <Label htmlFor="utmMedium">utm_medium</Label>
                <Input
                  id="utmMedium"
                  value={newUtm.utm_medium}
                  onChange={(e) => setNewUtm({ ...newUtm, utm_medium: e.target.value })}
                  placeholder="newsletter"
                />
              </div>
              <div>
                <Label htmlFor="utmCampaign">utm_campaign</Label>
                <Input
                  id="utmCampaign"
                  value={newUtm.utm_campaign}
                  onChange={(e) => setNewUtm({ ...newUtm, utm_campaign: e.target.value })}
                  placeholder="hr_tech_2025"
                />
              </div>
              <div>
                <Label htmlFor="utmTerm">utm_term (опционально)</Label>
                <Input
                  id="utmTerm"
                  value={newUtm.utm_term}
                  onChange={(e) => setNewUtm({ ...newUtm, utm_term: e.target.value })}
                  placeholder="vip_list"
                />
              </div>
              <div>
                <Label htmlFor="utmContent">utm_content (опционально)</Label>
                <Input
                  id="utmContent"
                  value={newUtm.utm_content}
                  onChange={(e) => setNewUtm({ ...newUtm, utm_content: e.target.value })}
                  placeholder="button_cta"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateUtmOpen(false)}>
                Отмена
              </Button>
              <Button onClick={handleCreateUtm}>Сохранить</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}