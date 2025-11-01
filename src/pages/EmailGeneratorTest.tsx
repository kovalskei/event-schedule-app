import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Sparkles, Mail, FileText } from 'lucide-react';

const EVENTS_URL = 'https://functions.poehali.dev/b56e5895-fb22-4d96-b746-b046a9fd2750';
const GENERATE_URL = 'https://functions.poehali.dev/d2a2e722-c697-4c1e-a3c7-af2366b408af';

interface Event {
  id: number;
  name: string;
}

interface Template {
  id: number;
  name: string;
  subject_template: string;
}

export default function EmailGeneratorTest() {
  const { toast } = useToast();
  const [events, setEvents] = useState<Event[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [theme, setTheme] = useState('Анонс спикеров по адаптации и мотивации сотрудников');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    loadEvents();
  }, []);

  useEffect(() => {
    if (selectedEventId) {
      loadTemplates(parseInt(selectedEventId));
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

  const loadTemplates = async (eventId: number) => {
    try {
      const res = await fetch(`${EVENTS_URL}?action=get_event&event_id=${eventId}`);
      const data = await res.json();
      if (data.email_templates?.length > 0) {
        setTemplates(data.email_templates);
        setSelectedTemplateId(data.email_templates[0].id.toString());
      }
    } catch (err) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось загрузить шаблоны',
        variant: 'destructive',
      });
    }
  };

  const handleGenerate = async () => {
    if (!selectedEventId || !selectedTemplateId) return;

    setLoading(true);
    setResult(null);

    try {
      const res = await fetch(GENERATE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: parseInt(selectedEventId),
          template_id: parseInt(selectedTemplateId),
          theme,
          test_mode: true,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setResult(data);
        toast({
          title: '✅ Готово!',
          description: 'Письмо успешно сгенерировано',
        });
      } else {
        throw new Error(data.error || 'Ошибка генерации');
      }
    } catch (err) {
      toast({
        title: 'Ошибка',
        description: err instanceof Error ? err.message : 'Не удалось сгенерировать письмо',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Заголовок */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">🧪 Тест генерации писем</h1>
          <p className="text-gray-600">AI создает письмо из шаблона + базы знаний</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Панель настроек */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-blue-600" />
                Настройки генерации
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Мероприятие */}
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

              {/* Шаблон */}
              <div>
                <label className="block text-sm font-medium mb-2">Шаблон письма</label>
                <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите шаблон" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((template) => (
                      <SelectItem key={template.id} value={template.id.toString()}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Тема */}
              <div>
                <label className="block text-sm font-medium mb-2">Тема письма</label>
                <Textarea
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                  placeholder="О чем должно быть письмо?"
                  rows={3}
                />
              </div>

              {/* Кнопка */}
              <Button
                onClick={handleGenerate}
                disabled={loading || !selectedEventId || !selectedTemplateId}
                className="w-full"
                size="lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Генерирую...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Сгенерировать письмо
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Результат */}
          {result && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5 text-green-600" />
                  Результат
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Тема письма */}
                <div>
                  <div className="text-sm font-medium text-gray-500 mb-1">Тема письма:</div>
                  <div className="font-semibold text-gray-900">{result.subject}</div>
                </div>

                {/* AI Reasoning */}
                {result.ai_reasoning && (
                  <div>
                    <div className="text-sm font-medium text-gray-500 mb-1">AI reasoning:</div>
                    <div className="text-sm text-gray-700 bg-gray-50 p-3 rounded-md">
                      {result.ai_reasoning}
                    </div>
                  </div>
                )}

                {/* Спикеры */}
                {result.selected_speakers && result.selected_speakers.length > 0 && (
                  <div>
                    <div className="text-sm font-medium text-gray-500 mb-2">Выбранные спикеры:</div>
                    <div className="space-y-1">
                      {result.selected_speakers.map((speaker: string, i: number) => (
                        <div key={i} className="text-sm text-gray-700">
                          • {speaker}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Кнопка просмотра HTML */}
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    const win = window.open('', '_blank');
                    if (win) {
                      win.document.write(result.html);
                      win.document.close();
                    }
                  }}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Открыть превью письма
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Превью HTML */}
        {result && (
          <Card>
            <CardHeader>
              <CardTitle>HTML письма</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg p-4 bg-white max-h-96 overflow-auto">
                <iframe
                  srcDoc={result.html}
                  className="w-full h-96 border-0"
                  title="Email Preview"
                />
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
