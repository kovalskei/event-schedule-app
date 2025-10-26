import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'react-router-dom';
import Icon from '@/components/ui/icon';
import EventCard from '@/components/events/EventCard';
import CreateEventDialog from '@/components/events/CreateEventDialog';
import LinkListDialog from '@/components/events/LinkListDialog';
import EventDetails from '@/components/events/EventDetails';
import EventSettingsDialog from '@/components/events/EventSettingsDialog';

const EVENTS_MANAGER_URL = 'https://functions.poehali.dev/b56e5895-fb22-4d96-b746-b046a9fd2750';
const SYNC_UNISENDER_URL = 'https://functions.poehali.dev/b7fefc5f-605d-4c44-8830-b5cf0c00ca0e';
const UNISENDER_MANAGER_URL = 'https://functions.poehali.dev/c6001b4a-b44b-4358-8b02-a4e85f7da1b8';

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

interface UniSenderList {
  id: string;
  title: string;
}

interface ContentType {
  id: number;
  name: string;
  description: string;
}

export default function EventsManager() {
  const { toast } = useToast();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [mailingLists, setMailingLists] = useState<MailingList[]>([]);
  const [unisenderLists, setUnisenderLists] = useState<UniSenderList[]>([]);
  const [contentTypes, setContentTypes] = useState<ContentType[]>([]);
  
  const [createEventOpen, setCreateEventOpen] = useState(false);
  const [linkListOpen, setLinkListOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  
  const [newEvent, setNewEvent] = useState({
    name: '',
    description: '',
    start_date: '',
    end_date: '',
    program_doc_id: '',
    pain_doc_id: '',
    default_tone: 'professional',
    email_template_examples: '',
  });
  
  const [selectedUnisenderList, setSelectedUnisenderList] = useState({
    list_id: '',
    list_name: '',
    utm_source: 'email',
    utm_medium: 'newsletter',
    utm_campaign: '',
    utm_term: '',
    utm_content: '',
  });

  useEffect(() => {
    loadEvents();
    loadUnisenderLists();
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

  const loadUnisenderLists = async () => {
    try {
      const res = await fetch(`${UNISENDER_MANAGER_URL}?action=get_lists`);
      const data = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setUnisenderLists(data.lists || []);
    } catch (error: any) {
      toast({
        title: 'Ошибка загрузки списков UniSender',
        description: error.message,
        variant: 'destructive',
      });
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
      setContentTypes(data.content_types || []);
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
        email_template_examples: '',
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

  const handleLinkUnisenderList = async () => {
    if (!selectedUnisenderList.list_id || !selectedEvent) {
      toast({
        title: 'Ошибка',
        description: 'Выберите список из UniSender',
        variant: 'destructive',
      });
      return;
    }

    try {
      const res = await fetch(EVENTS_MANAGER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'link_unisender_list',
          event_id: selectedEvent.id,
          unisender_list_id: selectedUnisenderList.list_id,
          unisender_list_name: selectedUnisenderList.list_name,
          utm_source: selectedUnisenderList.utm_source,
          utm_medium: selectedUnisenderList.utm_medium,
          utm_campaign: selectedUnisenderList.utm_campaign,
          utm_term: selectedUnisenderList.utm_term,
          utm_content: selectedUnisenderList.utm_content,
        }),
      });

      const data = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }

      toast({
        title: 'Список привязан',
        description: `"${selectedUnisenderList.list_name}" добавлен к мероприятию`,
      });

      setLinkListOpen(false);
      setSelectedUnisenderList({
        list_id: '',
        list_name: '',
        utm_source: 'email',
        utm_medium: 'newsletter',
        utm_campaign: '',
        utm_term: '',
        utm_content: '',
      });
      loadEventDetails(selectedEvent.id);
    } catch (error: any) {
      toast({
        title: 'Ошибка привязки списка',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleSelectEvent = (event: Event) => {
    loadEventDetails(event.id);
  };

  const handleBackToList = () => {
    setSelectedEvent(null);
    setMailingLists([]);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8 flex items-center justify-center">
        <div className="text-center">
          <Icon name="Loader2" className="w-8 h-8 animate-spin mx-auto mb-2" />
          <p>Загрузка...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              Управление мероприятиями
            </h1>
            <p className="text-gray-600">
              Создавайте мероприятия, привязывайте списки рассылки и настраивайте UTM-метки
            </p>
          </div>
          <Link to="/campaigns">
            <Icon name="ArrowRight" className="w-6 h-6" />
          </Link>
        </div>

        {selectedEvent ? (
          <>
            <EventDetails
              event={selectedEvent}
              mailingLists={mailingLists}
              contentTypes={contentTypes}
              onBack={handleBackToList}
              onLinkList={() => setLinkListOpen(true)}
              onEditSettings={() => setSettingsOpen(true)}
              onUpdate={() => loadEventDetails(selectedEvent.id)}
            />
            
            <LinkListDialog
              open={linkListOpen}
              onOpenChange={setLinkListOpen}
              unisenderLists={unisenderLists}
              selectedUnisenderList={selectedUnisenderList}
              onListChange={setSelectedUnisenderList}
              onLinkList={handleLinkUnisenderList}
            />
            
            <EventSettingsDialog
              open={settingsOpen}
              onOpenChange={setSettingsOpen}
              eventId={selectedEvent.id}
              onUpdate={() => {
                loadEventDetails(selectedEvent.id);
                loadEvents();
              }}
            />
          </>
        ) : (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-semibold">Мероприятия</h2>
              <CreateEventDialog
                open={createEventOpen}
                onOpenChange={setCreateEventOpen}
                newEvent={newEvent}
                onEventChange={setNewEvent}
                onCreateEvent={handleCreateEvent}
              />
            </div>

            {events.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Icon name="Calendar" className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <h3 className="text-xl font-medium mb-2">Нет мероприятий</h3>
                  <p className="text-gray-500 mb-4">Создайте первое мероприятие для начала работы</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {events.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    onSelect={handleSelectEvent}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}