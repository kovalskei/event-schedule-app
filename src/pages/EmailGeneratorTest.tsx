import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';

export default function EmailGeneratorTest() {
  const [eventId, setEventId] = useState('1');
  const [templateId, setTemplateId] = useState('138');
  const [theme, setTheme] = useState('Анонс спикеров по адаптации и мотивации сотрудников');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

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
                <label className="text-sm font-medium text-slate-700 mb-2 block">Event ID</label>
                <Input
                  type="number"
                  value={eventId}
                  onChange={(e) => setEventId(e.target.value)}
                  placeholder="1"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 mb-2 block">Template ID</label>
                <Input
                  type="number"
                  value={templateId}
                  onChange={(e) => setTemplateId(e.target.value)}
                  placeholder="138"
                />
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
                disabled={loading}
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
