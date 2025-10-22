import { useState, useEffect } from 'react';
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
  aiGeneratorAdvanced: 'https://functions.poehali.dev/24b9eee9-eec6-43b2-9e3e-ce6c7b4b5fdc',
  unisender: 'https://functions.poehali.dev/c6001b4a-b44b-4358-8b02-a4e85f7da1b8',
  telegram: 'https://functions.poehali.dev/e3024a9f-3935-4618-8f44-14ef29bf5d0a',
  campaignManager: 'https://functions.poehali.dev/e54890ac-fb38-4f4d-aca0-425c559bce45',
  eventsManager: 'https://functions.poehali.dev/b56e5895-fb22-4d96-b746-b046a9fd2750',
};

interface Event {
  id: number;
  name: string;
  program_doc_id: string;
  pain_doc_id: string;
  default_tone: string;
}

interface MailingList {
  id: number;
  name: string;
  unisender_list_id: string;
  utm_rules_count: number;
}

export default function CampaignManager() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [mailingLists, setMailingLists] = useState<MailingList[]>([]);
  const [selectedList, setSelectedList] = useState<MailingList | null>(null);
  
  const [programDocId, setProgramDocId] = useState('');
  const [painDocId, setPainDocId] = useState('');
  const [programUrl, setProgramUrl] = useState('');
  const [painUrl, setPainUrl] = useState('');
  const [inputMode, setInputMode] = useState<'doc_id' | 'url'>('doc_id');
  const [tone, setTone] = useState('professional');
  const [testEmail, setTestEmail] = useState('');
  const [templateName, setTemplateName] = useState('HR Campaign');
  
  const [aiProvider, setAiProvider] = useState('openai');
  const [aiModel, setAiModel] = useState('gpt-4o-mini');
  const [assistantId, setAssistantId] = useState('');
  const [useAdvanced, setUseAdvanced] = useState(false);
  
  const [generatedSubject, setGeneratedSubject] = useState('');
  const [generatedHtml, setGeneratedHtml] = useState('');
  const [templateId, setTemplateId] = useState('');

  useEffect(() => {
    loadEvents();
  }, []);

  useEffect(() => {
    if (selectedEvent) {
      setProgramDocId(selectedEvent.program_doc_id);
      setPainDocId(selectedEvent.pain_doc_id);
      setTone(selectedEvent.default_tone);
      loadEventDetails(selectedEvent.id);
    }
  }, [selectedEvent]);

  const loadEvents = async () => {
    try {
      const res = await fetch(`${FUNCTIONS.eventsManager}?action=list_events`);
      const data = await res.json();
      if (!data.error) {
        setEvents(data.events);
      }
    } catch (error) {
      console.error('Failed to load events:', error);
    }
  };

  const loadEventDetails = async (eventId: number) => {
    try {
      const res = await fetch(`${FUNCTIONS.eventsManager}?action=get_event&event_id=${eventId}`);
      const data = await res.json();
      if (!data.error) {
        setMailingLists(data.mailing_lists);
      }
    } catch (error) {
      console.error('Failed to load event details:', error);
    }
  };

  const handleReadDocs = async () => {
    if (inputMode === 'doc_id' && (!programDocId || !painDocId)) {
      toast({
        title: 'Ошибка',
        description: 'Укажите ID обоих документов',
        variant: 'destructive',
      });
      return;
    }

    if (inputMode === 'url' && (!programUrl || !painUrl)) {
      toast({
        title: 'Ошибка',
        description: 'Укажите ссылки на оба документа',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      let programParam = '';
      let painParam = '';

      if (inputMode === 'doc_id') {
        programParam = `doc_id=${programDocId}`;
        painParam = `doc_id=${painDocId}`;
      } else {
        programParam = `url=${encodeURIComponent(programUrl)}`;
        painParam = `url=${encodeURIComponent(painUrl)}`;
      }

      const [programRes, painRes] = await Promise.all([
        fetch(`${FUNCTIONS.googleDocsReader}?${programParam}`),
        fetch(`${FUNCTIONS.googleDocsReader}?${painParam}`),
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
      const apiUrl = useAdvanced ? FUNCTIONS.aiGeneratorAdvanced : FUNCTIONS.aiGenerator;
      
      const requestBody: any = {
        program_text: docs.programText,
        pain_points_text: docs.painText,
        tone,
      };
      
      if (useAdvanced) {
        requestBody.ai_provider = aiProvider;
        requestBody.model = aiModel;
        if (assistantId) {
          requestBody.assistant_id = assistantId;
        }
      }
      
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const data = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setGeneratedSubject(data.subject);
      setGeneratedHtml(data.html);

      const providerText = data.ai_provider === 'claude' ? 'Claude' : 
                          data.assistant_id ? `OpenAI Assistant (${data.assistant_id})` :
                          data.model || 'ИИ';

      toast({
        title: 'Контент сгенерирован',
        description: `Письмо создано с помощью ${providerText}`,
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
          <div className="flex gap-2">
            <Link to="/ai-settings">
              <Button variant="outline">
                <Icon name="Settings" className="w-4 h-4 mr-2" />
                Настройка ИИ
              </Button>
            </Link>
            <Link to="/history">
              <Button variant="outline">
                <Icon name="History" className="w-4 h-4 mr-2" />
                История
              </Button>
            </Link>
          </div>
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
                <Label htmlFor="event">Мероприятие</Label>
                {events.length === 0 ? (
                  <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-md text-sm text-amber-800">
                    <Icon name="AlertCircle" className="w-4 h-4" />
                    <span>Нет мероприятий. Создайте мероприятие через <Link to="/events" className="underline font-medium">Управление мероприятиями</Link></span>
                  </div>
                ) : (
                  <Select 
                    value={selectedEvent?.id.toString()} 
                    onValueChange={(value) => {
                      const event = events.find(e => e.id.toString() === value);
                      setSelectedEvent(event || null);
                    }}
                  >
                    <SelectTrigger id="event">
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
                )}
              </div>
              {selectedEvent && (
                <div>
                  <Label htmlFor="mailingList">Список рассылки</Label>
                  {mailingLists.length === 0 ? (
                    <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-md text-sm text-amber-800">
                      <Icon name="AlertCircle" className="w-4 h-4" />
                      <span>Списки рассылок пусты. Добавьте список через <Link to="/events" className="underline font-medium">Управление мероприятиями</Link></span>
                    </div>
                  ) : (
                    <Select 
                      value={selectedList?.id.toString()} 
                      onValueChange={(value) => {
                        const list = mailingLists.find(l => l.id.toString() === value);
                        setSelectedList(list || null);
                      }}
                    >
                      <SelectTrigger id="mailingList">
                        <SelectValue placeholder="Выберите список рассылки" />
                      </SelectTrigger>
                      <SelectContent>
                        {mailingLists.map((list) => (
                          <SelectItem key={list.id} value={list.id.toString()}>
                            {list.unisender_list_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}
              <div className="flex gap-2 p-3 bg-gray-50 rounded-lg">
                <Button
                  variant={inputMode === 'doc_id' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setInputMode('doc_id')}
                  className="flex-1"
                >
                  <Icon name="FileText" className="w-4 h-4 mr-2" />
                  ID документа
                </Button>
                <Button
                  variant={inputMode === 'url' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setInputMode('url')}
                  className="flex-1"
                >
                  <Icon name="Link" className="w-4 h-4 mr-2" />
                  Ссылка
                </Button>
              </div>

              {inputMode === 'doc_id' ? (
                <>
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
                </>
              ) : (
                <>
                  <div>
                    <Label htmlFor="programUrl">Ссылка на документ с программой мероприятия</Label>
                    <Input
                      id="programUrl"
                      value={programUrl}
                      onChange={(e) => setProgramUrl(e.target.value)}
                      placeholder="https://docs.google.com/document/d/..."
                    />
                    <p className="text-xs text-gray-500 mt-1">Google Docs, Notion или любая публичная ссылка</p>
                  </div>
                  <div>
                    <Label htmlFor="painUrl">Ссылка на документ с болями ЦА</Label>
                    <Input
                      id="painUrl"
                      value={painUrl}
                      onChange={(e) => setPainUrl(e.target.value)}
                      placeholder="https://docs.google.com/document/d/..."
                    />
                    <p className="text-xs text-gray-500 mt-1">Google Docs, Notion или любая публичная ссылка</p>
                  </div>
                </>
              )}
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

          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Icon name="Sparkles" className="w-5 h-5" />
                Шаг 2: Настройка ИИ и генерация
              </CardTitle>
              <CardDescription>
                Выберите модель и сгенерируйте контент
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <input
                  type="checkbox"
                  id="useAdvanced"
                  checked={useAdvanced}
                  onChange={(e) => setUseAdvanced(e.target.checked)}
                  className="w-4 h-4"
                />
                <Label htmlFor="useAdvanced" className="cursor-pointer">
                  Расширенные настройки ИИ (GPT-4o, o1, Claude, Assistants)
                </Label>
              </div>
              
              {useAdvanced && (
                <div className="grid md:grid-cols-3 gap-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div>
                    <Label htmlFor="aiProvider">Провайдер ИИ</Label>
                    <Select value={aiProvider} onValueChange={setAiProvider}>
                      <SelectTrigger id="aiProvider">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="openai">OpenAI</SelectItem>
                        <SelectItem value="claude">Anthropic Claude</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="aiModel">Модель</Label>
                    <Select value={aiModel} onValueChange={setAiModel}>
                      <SelectTrigger id="aiModel">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {aiProvider === 'openai' ? (
                          <>
                            <SelectItem value="gpt-4o-mini">GPT-4o Mini (быстрая)</SelectItem>
                            <SelectItem value="gpt-4o">GPT-4o (продвинутая)</SelectItem>
                            <SelectItem value="o1-preview">o1-preview (reasoning)</SelectItem>
                            <SelectItem value="o1-mini">o1-mini (reasoning быстрая)</SelectItem>
                          </>
                        ) : (
                          <>
                            <SelectItem value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</SelectItem>
                            <SelectItem value="claude-3-opus-20240229">Claude 3 Opus</SelectItem>
                            <SelectItem value="claude-3-haiku-20240307">Claude 3 Haiku</SelectItem>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {aiProvider === 'openai' && (
                    <div>
                      <Label htmlFor="assistantId">
                        Assistant ID (опционально)
                        <span className="text-xs text-gray-500 ml-1">для кастомного ассистента</span>
                      </Label>
                      <Input
                        id="assistantId"
                        value={assistantId}
                        onChange={(e) => setAssistantId(e.target.value)}
                        placeholder="asst_..."
                      />
                    </div>
                  )}
                </div>
              )}
              
              <Button
                onClick={handleGenerateContent}
                disabled={loading || (inputMode === 'doc_id' ? (!programDocId || !painDocId) : (!programUrl || !painUrl))}
                className="w-full"
                size="lg"
              >
                <Icon name="Wand2" className="w-4 h-4 mr-2" />
                {loading ? 'Генерация...' : 'Сгенерировать письмо'}
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