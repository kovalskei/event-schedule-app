import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Mail, Eye, Send, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const EVENTS_URL = 'https://functions.poehali.dev/b56e5895-fb22-4d96-b746-b046a9fd2750';
const DRAFT_URL = 'https://functions.poehali.dev/f1e7289d-4051-4929-b175-ee31b2a46995';

interface Event {
  id: number;
  name: string;
}

interface ContentType {
  id: number;
  name: string;
  description: string;
}

interface Draft {
  id: number;
  subject: string;
  html_content: string;
  created_at: string;
  status: string;
}

export default function DraftsManager() {
  const { toast } = useToast();
  const [events, setEvents] = useState<Event[]>([]);
  const [contentTypes, setContentTypes] = useState<ContentType[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [selectedContentTypeId, setSelectedContentTypeId] = useState<string>('');
  const [theme, setTheme] = useState('');
  
  const [generating, setGenerating] = useState(false);
  const [loadingDrafts, setLoadingDrafts] = useState(false);
  
  const [previewDraft, setPreviewDraft] = useState<Draft | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    loadEvents();
  }, []);

  useEffect(() => {
    if (selectedEventId) {
      loadContentTypes(parseInt(selectedEventId));
      loadDrafts(parseInt(selectedEventId));
    }
  }, [selectedEventId]);

  const loadEvents = async () => {
    try {
      const res = await fetch(`${EVENTS_URL}?action=list_events`);
      const data = await res.json();
      if (data.events?.length > 0) {
        setEvents(data.events);
        setSelectedEventId(data.events[0].id.toString());
      }
    } catch (err) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось загрузить мероприятия',
        variant: 'destructive',
      });
    }
  };

  const loadContentTypes = async (eventId: number) => {
    try {
      const res = await fetch(`${EVENTS_URL}?action=get_event&event_id=${eventId}`);
      const data = await res.json();
      if (data.content_types?.length > 0) {
        setContentTypes(data.content_types);
        setSelectedContentTypeId(data.content_types[0].id.toString());
      }
    } catch (err) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось загрузить типы контента',
        variant: 'destructive',
      });
    }
  };

  const loadDrafts = async (eventId: number) => {
    setLoadingDrafts(true);
    try {
      const res = await fetch(`${EVENTS_URL}?action=list_drafts&event_id=${eventId}`);
      const data = await res.json();
      if (data.drafts) {
        setDrafts(data.drafts);
      }
    } catch (err) {
      console.error('Failed to load drafts:', err);
    } finally {
      setLoadingDrafts(false);
    }
  };

  const handleGenerate = async () => {
    if (!selectedEventId || !selectedContentTypeId || !theme.trim()) {
      toast({
        title: 'Внимание',
        description: 'Заполните все поля',
        variant: 'destructive',
      });
      return;
    }

    setGenerating(true);
    try {
      const res = await fetch(DRAFT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: parseInt(selectedEventId),
          content_type_id: parseInt(selectedContentTypeId),
          theme,
        }),
      });

      const data = await res.json();

      if (data.success) {
        toast({
          title: '✅ Готово!',
          description: 'Черновик создан',
        });
        setTheme('');
        loadDrafts(parseInt(selectedEventId));
      } else {
        throw new Error(data.error || 'Ошибка генерации');
      }
    } catch (err) {
      toast({
        title: 'Ошибка',
        description: err instanceof Error ? err.message : 'Не удалось создать черновик',
        variant: 'destructive',
      });
    } finally {
      setGenerating(false);
    }
  };

  const handlePreview = (draft: Draft) => {
    setPreviewDraft(draft);
    setShowPreview(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Заголовок */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">📧 Менеджер черновиков v2</h1>
          <p className="text-gray-600">Генерация и управление черновиками писем</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Создание черновика */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5 text-indigo-600" />
                Новый черновик
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Мероприятие</label>
                <Select value={selectedEventId} onValueChange={setSelectedEventId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите мероприятие" />
                  </SelectTrigger>
                  <SelectContent>
                    {events.map((event) => (
                      <SelectItem key={event.id} value={event.id.toString()}>
                        {event.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Тип контента</label>
                <Select value={selectedContentTypeId} onValueChange={setSelectedContentTypeId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите тип" />
                  </SelectTrigger>
                  <SelectContent>
                    {contentTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id.toString()}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Тема письма</label>
                <Textarea
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                  placeholder="Например: Адаптация и мотивация сотрудников"
                  rows={3}
                />
              </div>

              <Button
                onClick={handleGenerate}
                disabled={generating}
                className="w-full"
                size="lg"
              >
                {generating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Генерирую...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Создать черновик
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Список черновиков */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-purple-600" />
                Черновики ({drafts.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingDrafts ? (
                <div className="text-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400" />
                </div>
              ) : drafts.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  Нет черновиков. Создайте первый!
                </div>
              ) : (
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {drafts.map((draft) => (
                    <div
                      key={draft.id}
                      className="border rounded-lg p-4 bg-white hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 mb-1">
                            {draft.subject}
                          </h3>
                          <p className="text-xs text-gray-500">
                            {new Date(draft.created_at).toLocaleString('ru')}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handlePreview(draft)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Превью */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{previewDraft?.subject}</DialogTitle>
          </DialogHeader>
          <div className="border rounded-lg overflow-auto max-h-[70vh]">
            {previewDraft && (
              <iframe
                srcDoc={previewDraft.html_content}
                className="w-full h-[600px] border-0"
                title="Email Preview"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
