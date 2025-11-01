import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

const EVENTS_MANAGER_URL = 'https://functions.poehali.dev/b56e5895-fb22-4d96-b746-b046a9fd2750';

interface Event {
  id: number;
  name: string;
  description: string;
}

interface EmailTemplate {
  id: number;
  name: string;
  content_type_name: string;
  html_template: string;
  subject_template: string;
}

export default function EmailGeneratorTest() {
  const { toast } = useToast();
  const [events, setEvents] = useState<Event[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [eventId, setEventId] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [theme, setTheme] = useState('Анонс спикеров по адаптации и мотивации сотрудников');
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadEvents();
  }, []);

  useEffect(() => {
    if (eventId) {
      loadTemplates(parseInt(eventId));
    }
  }, [eventId]);

  const loadEvents = async () => {
    setLoadingData(true);
    try {
      const res = await fetch(`${EVENTS_MANAGER_URL}?action=list_events`);
      const data = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setEvents(data.events || []);
      if (data.events?.length > 0) {
        setEventId(data.events[0].id.toString());
      }
    } catch (err) {
      toast({
        title: 'Ошибка загрузки',
        description: err instanceof Error ? err.message : 'Не удалось загрузить мероприятия',
        variant: 'destructive',
      });
    } finally {
      setLoadingData(false);
    }
  };

  const loadTemplates = async (eventIdNum: number) => {
    try {
      const res = await fetch(`${EVENTS_MANAGER_URL}?action=get_event&event_id=${eventIdNum}`);
      const data = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setTemplates(data.email_templates || []);
      if (data.email_templates?.length > 0) {
        setTemplateId(data.email_templates[0].id.toString());
      }
    } catch (err) {
      toast({
        title: 'Ошибка загрузки',
        description: err instanceof Error ? err.message : 'Не удалось загрузить шаблоны',
        variant: 'destructive',
      });
    }
  };

  const generateEmail = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('https://functions.poehali.dev/d2a2e722-c697-4c1e-a3c7-af2366b408af', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          event_id: parseInt(eventId),
          template_id: parseInt(templateId),
          theme: theme,
          test_mode: true,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setResult(data);
      } else {
        setError(data.error || 'Unknown error');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">🧪 Тест генерации email</h1>
          <p className="text-slate-600">AI генерирует письмо из шаблона + базы знаний по теме</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Параметры */}
          <Card>
            <CardHeader>
              <CardTitle>Параметры генерации</CardTitle>
              <CardDescription>Настройте параметры для генерации письма</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-2 block">Мероприятие</label>
                <Select value={eventId} onValueChange={setEventId} disabled={loadingData}>
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
                <label className="text-sm font-medium text-slate-700 mb-2 block">Шаблон письма</label>
                <Select value={templateId} onValueChange={setTemplateId} disabled={!eventId || templates.length === 0}>
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
                {eventId && templates.length === 0 && (
                  <p className="text-xs text-slate-500 mt-1">Для этого мероприятия пока нет шаблонов</p>
                )}
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 mb-2 block">Тема письма</label>
                <Textarea
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                  placeholder="Анонс спикеров по адаптации и мотивации"
                  rows={3}
                />
              </div>

              <Button
                onClick={generateEmail}
                disabled={loading || !eventId || !templateId}
                className="w-full"
                size="lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Генерирую...
                  </>
                ) : (
                  '🚀 Генерировать письмо'
                )}
              </Button>

              {error && (
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {result && (
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertDescription>Письмо успешно сгенерировано!</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Результат AI */}
          {result && (
            <Card>
              <CardHeader>
                <CardTitle>AI Reasoning</CardTitle>
                <CardDescription>Почему AI выбрал этих спикеров</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-700 mb-4">{result.ai_reasoning}</p>

                <h4 className="font-semibold text-slate-900 mb-2">Выбранные спикеры:</h4>
                <ul className="space-y-1">
                  {result.selected_speakers?.map((speaker: any, idx: number) => (
                    <li key={idx} className="text-sm text-slate-600">
                      • {typeof speaker === 'string' ? speaker : speaker.name || JSON.stringify(speaker)}
                    </li>
                  ))}
                </ul>

                <details className="mt-4">
                  <summary className="cursor-pointer text-sm font-medium text-slate-700">
                    Данные для шаблона
                  </summary>
                  <pre className="mt-2 text-xs bg-slate-100 p-3 rounded overflow-auto max-h-60">
                    {JSON.stringify(result.data, null, 2)}
                  </pre>
                </details>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Превью письма */}
        {result && (
          <Card>
            <CardHeader>
              <CardTitle>Превью письма</CardTitle>
              <CardDescription>Так выглядит сгенерированное письмо</CardDescription>
            </CardHeader>
            <CardContent>
              <iframe
                srcDoc={result.rendered_html}
                className="w-full h-[600px] border border-slate-200 rounded-lg"
                title="Email Preview"
              />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}