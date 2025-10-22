import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'react-router-dom';
import Icon from '@/components/ui/icon';

const FUNCTIONS = {
  googleDocsReader: 'https://functions.poehali.dev/4df54bd9-8e52-46a4-a000-7cf55c0fd37d',
  aiGenerator: 'https://functions.poehali.dev/e3a9e3f7-5973-4c72-827a-c755b5b909c0',
  unisender: 'https://functions.poehali.dev/c6001b4a-b44b-4358-8b02-a4e85f7da1b8',
  telegram: 'https://functions.poehali.dev/e3024a9f-3935-4618-8f44-14ef29bf5d0a',
  campaignManager: 'https://functions.poehali.dev/e54890ac-fb38-4f4d-aca0-425c559bce45',
};

export default function CampaignManager() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  
  const [programDocId, setProgramDocId] = useState('');
  const [painDocId, setPainDocId] = useState('');
  const [tone, setTone] = useState('professional');
  const [testEmail, setTestEmail] = useState('');
  const [templateName, setTemplateName] = useState('HR Campaign');
  
  const [generatedSubject, setGeneratedSubject] = useState('');
  const [generatedHtml, setGeneratedHtml] = useState('');
  const [templateId, setTemplateId] = useState('');

  const handleReadDocs = async () => {
    if (!programDocId || !painDocId) {
      toast({
        title: 'Ошибка',
        description: 'Укажите ID обоих документов',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const [programRes, painRes] = await Promise.all([
        fetch(`${FUNCTIONS.googleDocsReader}?doc_id=${programDocId}`),
        fetch(`${FUNCTIONS.googleDocsReader}?doc_id=${painDocId}`),
      ]);

      const programData = await programRes.json();
      const painData = await painRes.json();

      if (programData.error || painData.error) {
        throw new Error(programData.error || painData.error);
      }

      toast({
        title: 'Документы загружены',
        description: 'Готов к генерации контента',
      });

      return { programText: programData.content, painText: painData.content };
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

  const handleGenerateContent = async () => {
    const docs = await handleReadDocs();
    if (!docs) return;

    setLoading(true);
    try {
      const res = await fetch(FUNCTIONS.aiGenerator, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          program_text: docs.programText,
          pain_points_text: docs.painText,
          tone,
        }),
      });

      const data = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setGeneratedSubject(data.subject);
      setGeneratedHtml(data.html);

      toast({
        title: 'Контент сгенерирован',
        description: 'Письмо готово к созданию шаблона',
      });
    } catch (error: any) {
      toast({
        title: 'Ошибка генерации',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTemplate = async () => {
    if (!generatedSubject || !generatedHtml) {
      toast({
        title: 'Ошибка',
        description: 'Сначала сгенерируйте контент',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(FUNCTIONS.unisender, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_template',
          subject: generatedSubject,
          html: generatedHtml,
          template_name: templateName,
        }),
      });

      const data = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setTemplateId(data.template_id);

      toast({
        title: 'Шаблон создан',
        description: `ID: ${data.template_id}`,
      });
    } catch (error: any) {
      toast({
        title: 'Ошибка создания шаблона',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSendTest = async () => {
    if (!templateId || !testEmail) {
      toast({
        title: 'Ошибка',
        description: 'Укажите ID шаблона и email для теста',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(FUNCTIONS.unisender, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_test',
          template_id: templateId,
          test_email: testEmail,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.message);
      }

      toast({
        title: 'Тест отправлен',
        description: `Проверьте почту ${testEmail}`,
      });
    } catch (error: any) {
      toast({
        title: 'Ошибка отправки теста',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleNotifyManager = async () => {
    if (!templateId) {
      toast({
        title: 'Ошибка',
        description: 'Сначала создайте шаблон',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(FUNCTIONS.telegram, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_id: templateId,
          unisender_link: 'https://cp.unisender.com',
        }),
      });

      const data = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }

      toast({
        title: 'Уведомление отправлено',
        description: 'Менеджер получил уведомление в Telegram',
      });
    } catch (error: any) {
      toast({
        title: 'Ошибка уведомления',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFullPipeline = async () => {
    await handleGenerateContent();
    setTimeout(async () => {
      await handleCreateTemplate();
      setTimeout(async () => {
        await handleNotifyManager();
      }, 1000);
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              HR Рассылки
            </h1>
            <p className="text-lg text-gray-600">
              Автоматическая генерация и отправка персонализированных писем
            </p>
          </div>
          <Link to="/history">
            <Button variant="outline">
              <Icon name="History" className="w-4 h-4 mr-2" />
              История
            </Button>
          </Link>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Icon name="FileText" className="w-5 h-5" />
                Шаг 1: Источники данных
              </CardTitle>
              <CardDescription>
                Укажите ID документов Google Docs
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="program">ID программы мероприятия</Label>
                <Input
                  id="program"
                  value={programDocId}
                  onChange={(e) => setProgramDocId(e.target.value)}
                  placeholder="1abc2def3ghi..."
                />
              </div>
              <div>
                <Label htmlFor="pain">ID болей ЦА</Label>
                <Input
                  id="pain"
                  value={painDocId}
                  onChange={(e) => setPainDocId(e.target.value)}
                  placeholder="4jkl5mno6pqr..."
                />
              </div>
              <div>
                <Label htmlFor="tone">Тон письма</Label>
                <Select value={tone} onValueChange={setTone}>
                  <SelectTrigger id="tone">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="professional">Профессиональный</SelectItem>
                    <SelectItem value="friendly">Дружелюбный</SelectItem>
                    <SelectItem value="formal">Официальный</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Icon name="Sparkles" className="w-5 h-5" />
                Шаг 2: Генерация контента
              </CardTitle>
              <CardDescription>
                ИИ создаст письмо на основе данных
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                onClick={handleGenerateContent}
                disabled={loading || !programDocId || !painDocId}
                className="w-full"
              >
                <Icon name="Wand2" className="w-4 h-4 mr-2" />
                Сгенерировать письмо
              </Button>
              {generatedSubject && (
                <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                  <p className="text-sm font-medium text-green-900 mb-1">Тема:</p>
                  <p className="text-sm text-green-700">{generatedSubject}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Icon name="Mail" className="w-5 h-5" />
                Шаг 3: Создание шаблона
              </CardTitle>
              <CardDescription>
                Сохранение в UniSender
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="templateName">Название шаблона</Label>
                <Input
                  id="templateName"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                />
              </div>
              <Button
                onClick={handleCreateTemplate}
                disabled={loading || !generatedSubject}
                className="w-full"
              >
                <Icon name="Save" className="w-4 h-4 mr-2" />
                Создать шаблон в UniSender
              </Button>
              {templateId && (
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm font-medium text-blue-900 mb-1">ID шаблона:</p>
                  <p className="text-sm text-blue-700 font-mono">{templateId}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Icon name="Send" className="w-5 h-5" />
                Шаг 4: Тестирование
              </CardTitle>
              <CardDescription>
                Отправка тестового письма и уведомление
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="testEmail">Email для теста</Label>
                <Input
                  id="testEmail"
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="manager@example.com"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleSendTest}
                  disabled={loading || !templateId}
                  className="flex-1"
                  variant="outline"
                >
                  <Icon name="Mail" className="w-4 h-4 mr-2" />
                  Тест
                </Button>
                <Button
                  onClick={handleNotifyManager}
                  disabled={loading || !templateId}
                  className="flex-1"
                >
                  <Icon name="MessageSquare" className="w-4 h-4 mr-2" />
                  Уведомить
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Icon name="Zap" className="w-5 h-5" />
              Быстрый запуск
            </CardTitle>
            <CardDescription className="text-indigo-100">
              Выполнить все шаги автоматически
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={handleFullPipeline}
              disabled={loading || !programDocId || !painDocId}
              className="w-full bg-white text-indigo-600 hover:bg-indigo-50"
              size="lg"
            >
              <Icon name="Rocket" className="w-5 h-5 mr-2" />
              Запустить полный цикл
            </Button>
          </CardContent>
        </Card>

        {generatedHtml && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Icon name="Eye" className="w-5 h-5" />
                Предпросмотр письма
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div 
                className="border rounded-lg p-4 bg-white max-h-96 overflow-auto"
                dangerouslySetInnerHTML={{ __html: generatedHtml }}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}