import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import Icon from '@/components/ui/icon';
import { cn } from '@/lib/utils';

const EVENTS_MANAGER_URL = 'https://functions.poehali.dev/b56e5895-fb22-4d96-b746-b046a9fd2750';

interface ContentType {
  id: number;
  name: string;
  description: string;
}

interface MailingList {
  id: number;
  event_id: number;
  unisender_list_id: string;
  unisender_list_name: string;
  content_type_ids: number[];
  content_type_order: string;
  ai_provider: string;
  ai_model: string;
  ai_assistant_id: string | null;
  demo_mode: boolean;
  schedule_type: string;
  schedule_rrule: string | null;
  schedule_datetime: string | null;
  schedule_window_start: string;
  schedule_window_end: string;
  test_required: boolean;
  status: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  sender_email: string | null;
  sender_name: string | null;
}

interface MailingListSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mailingList: MailingList | null;
  contentTypes: ContentType[];
  onUpdate: () => void;
}

export default function MailingListSettings({
  open,
  onOpenChange,
  mailingList,
  contentTypes,
  onUpdate,
}: MailingListSettingsProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  
  const [selectedContentTypes, setSelectedContentTypes] = useState<number[]>([]);
  const [contentOrder, setContentOrder] = useState<number[]>([]);
  
  const [aiProvider, setAiProvider] = useState('openai');
  const [aiModel, setAiModel] = useState('gpt-4o-mini');
  const [aiAssistantId, setAiAssistantId] = useState('');
  const [demoMode, setDemoMode] = useState(false);
  
  const [scheduleType, setScheduleType] = useState('manual');
  const [scheduleRrule, setScheduleRrule] = useState('');
  const [scheduleDatetime, setScheduleDatetime] = useState('');
  const [windowStart, setWindowStart] = useState('10:00');
  const [windowEnd, setWindowEnd] = useState('19:00');
  const [testRequired, setTestRequired] = useState(true);
  const [senderEmail, setSenderEmail] = useState('');
  const [senderName, setSenderName] = useState('HR Team');

  useEffect(() => {
    if (mailingList) {
      setSenderEmail(mailingList.sender_email || '');
      setSenderName(mailingList.sender_name || 'HR Team');
      setSelectedContentTypes(mailingList.content_type_ids || []);
      
      try {
        const order = mailingList.content_type_order ? JSON.parse(mailingList.content_type_order) : [];
        setContentOrder(order);
      } catch {
        setContentOrder([]);
      }
      
      setAiProvider(mailingList.ai_provider || 'openai');
      setAiModel(mailingList.ai_model || 'gpt-4o-mini');
      setAiAssistantId(mailingList.ai_assistant_id || '');
      setDemoMode(mailingList.demo_mode || false);
      
      setScheduleType(mailingList.schedule_type || 'manual');
      setScheduleRrule(mailingList.schedule_rrule || '');
      setScheduleDatetime(mailingList.schedule_datetime ? mailingList.schedule_datetime.slice(0, 16) : '');
      setWindowStart(mailingList.schedule_window_start?.slice(0, 5) || '10:00');
      setWindowEnd(mailingList.schedule_window_end?.slice(0, 5) || '19:00');
      setTestRequired(mailingList.test_required ?? true);
    }
  }, [mailingList]);

  const toggleContentType = (typeId: number) => {
    setSelectedContentTypes(prev => {
      const newTypes = prev.includes(typeId) 
        ? prev.filter(id => id !== typeId)
        : [...prev, typeId];
      
      setContentOrder(newTypes);
      return newTypes;
    });
  };

  const moveContentType = (index: number, direction: 'up' | 'down') => {
    const newOrder = [...contentOrder];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (targetIndex < 0 || targetIndex >= newOrder.length) return;
    
    [newOrder[index], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[index]];
    setContentOrder(newOrder);
  };

  const handleSave = async () => {
    if (!mailingList) return;

    setLoading(true);
    try {
      const res = await fetch(EVENTS_MANAGER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_mailing_list_settings',
          list_id: mailingList.id,
          content_type_ids: selectedContentTypes,
          content_type_order: JSON.stringify(contentOrder),
          ai_provider: aiProvider,
          ai_model: aiModel,
          ai_assistant_id: aiAssistantId || null,
          demo_mode: demoMode,
          schedule_type: scheduleType,
          schedule_rrule: scheduleRrule || null,
          schedule_datetime: scheduleDatetime || null,
          schedule_window_start: windowStart,
          schedule_window_end: windowEnd,
          test_required: testRequired,
          sender_email: senderEmail || null,
          sender_name: senderName || 'HR Team',
        }),
      });

      const data = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }

      toast({
        title: 'Настройки сохранены',
        description: 'Изменения применены к списку рассылки',
      });

      onUpdate();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: 'Ошибка сохранения',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateDrafts = async () => {
    if (!mailingList) return;

    setLoading(true);
    try {
      const res = await fetch(EVENTS_MANAGER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate_drafts',
          list_id: mailingList.id,
          use_v2: true,
        }),
      });

      const data = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }

      const isV2 = data.version === 'v2';
      const badge = isV2 ? '🔍 RAG' : '';

      toast({
        title: `Черновики созданы ${badge}`,
        description: data.message || `Создано ${data.count || 0} писем`,
      });

      onUpdate();
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

  const handleLaunch = async () => {
    if (!mailingList) return;

    toast({
      title: 'Запуск рассылки',
      description: 'Рассылка будет запущена согласно расписанию',
    });
  };

  const handleTest = async () => {
    if (!mailingList) return;

    toast({
      title: 'Тестовая отправка',
      description: 'Отправка тестовых писем...',
    });
  };

  if (!mailingList) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon name="Settings" className="w-5 h-5" />
            Настройки списка: {mailingList.unisender_list_name}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="content" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="content">Типы контента</TabsTrigger>
            <TabsTrigger value="sender">Отправка</TabsTrigger>
            <TabsTrigger value="ai">AI-профиль</TabsTrigger>
            <TabsTrigger value="schedule">Расписание</TabsTrigger>
            <TabsTrigger value="utm">UTM</TabsTrigger>
          </TabsList>

          <TabsContent value="content" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Типы контента</CardTitle>
                <CardDescription>
                  Выберите типы писем и настройте порядок отправки
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Доступные типы</Label>
                  <div className="grid gap-2">
                    {contentTypes.map(type => (
                      <div
                        key={type.id}
                        className={cn(
                          "flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors",
                          selectedContentTypes.includes(type.id) && "bg-blue-50 border-blue-300"
                        )}
                        onClick={() => toggleContentType(type.id)}
                      >
                        <Checkbox
                          checked={selectedContentTypes.includes(type.id)}
                          onCheckedChange={() => toggleContentType(type.id)}
                        />
                        <div className="flex-1">
                          <div className="font-medium">{type.name}</div>
                          <div className="text-sm text-muted-foreground">{type.description}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {contentOrder.length > 0 && (
                  <div className="space-y-2">
                    <Label>Порядок отправки</Label>
                    <div className="space-y-2">
                      {contentOrder.map((typeId, index) => {
                        const type = contentTypes.find(t => t.id === typeId);
                        if (!type) return null;

                        return (
                          <div key={typeId} className="flex items-center gap-2 p-2 border rounded">
                            <Badge variant="outline">{index + 1}</Badge>
                            <div className="flex-1 font-medium">{type.name}</div>
                            <div className="flex gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => moveContentType(index, 'up')}
                                disabled={index === 0}
                              >
                                <Icon name="ChevronUp" className="w-4 h-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => moveContentType(index, 'down')}
                                disabled={index === contentOrder.length - 1}
                              >
                                <Icon name="ChevronDown" className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sender" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Настройки отправки</CardTitle>
                <CardDescription>
                  Укажите данные отправителя для массовых рассылок
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="sender-name">Имя отправителя</Label>
                  <Input
                    id="sender-name"
                    value={senderName}
                    onChange={(e) => setSenderName(e.target.value)}
                    placeholder="HR Team"
                  />
                  <p className="text-xs text-muted-foreground">
                    Имя, которое увидят получатели в поле "От"
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sender-email">Email отправителя</Label>
                  <Input
                    id="sender-email"
                    type="email"
                    value={senderEmail}
                    onChange={(e) => setSenderEmail(e.target.value)}
                    placeholder="events@example.com"
                  />
                  <p className="text-xs text-muted-foreground">
                    Email должен быть подтверждён в UniSender
                  </p>
                </div>

                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
                  <div className="flex items-start gap-2">
                    <Icon name="Info" className="w-4 h-4 mt-0.5 text-blue-600" />
                    <div className="text-sm text-blue-900">
                      <div className="font-medium">Важно:</div>
                      <ul className="list-disc list-inside mt-1 space-y-1 text-xs">
                        <li>Email должен быть подтверждён в UniSender</li>
                        <li>Используется только для массовых рассылок</li>
                        <li>Для тестов используется шаблон UniSender</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ai" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>AI-профиль</CardTitle>
                <CardDescription>
                  Настройте ИИ для генерации писем
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <Checkbox
                    id="demo-mode"
                    checked={demoMode}
                    onCheckedChange={(checked) => setDemoMode(checked as boolean)}
                  />
                  <Label htmlFor="demo-mode" className="cursor-pointer">
                    <div className="font-medium">Demo режим</div>
                    <div className="text-xs text-muted-foreground">
                      Использовать демо-генератор без API-ключей
                    </div>
                  </Label>
                </div>

                {!demoMode && (
                  <>
                    <div className="space-y-2">
                      <Label>Провайдер</Label>
                      <Select value={aiProvider} onValueChange={setAiProvider}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="openai">OpenAI</SelectItem>
                          <SelectItem value="claude">Anthropic Claude</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Модель</Label>
                      <Select value={aiModel} onValueChange={setAiModel}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {aiProvider === 'openai' ? (
                            <>
                              <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
                              <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                              <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                            </>
                          ) : (
                            <>
                              <SelectItem value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</SelectItem>
                              <SelectItem value="claude-3-5-haiku-20241022">Claude 3.5 Haiku</SelectItem>
                            </>
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    {aiProvider === 'openai' && (
                      <div className="space-y-2">
                        <Label>Assistant ID (опционально)</Label>
                        <Input
                          value={aiAssistantId}
                          onChange={(e) => setAiAssistantId(e.target.value)}
                          placeholder="asst_..."
                        />
                        <p className="text-xs text-muted-foreground">
                          Используйте готового OpenAI Assistant с настроенными промптами
                        </p>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="schedule" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Расписание отправки</CardTitle>
                <CardDescription>
                  Настройте время и правила автоматической отправки
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Тип расписания</Label>
                  <Select value={scheduleType} onValueChange={setScheduleType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">Ручной запуск</SelectItem>
                      <SelectItem value="datetime">Конкретная дата/время</SelectItem>
                      <SelectItem value="rrule">Повторяющееся (RRULE)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {scheduleType === 'datetime' && (
                  <div className="space-y-2">
                    <Label>Дата и время</Label>
                    <Input
                      type="datetime-local"
                      value={scheduleDatetime}
                      onChange={(e) => setScheduleDatetime(e.target.value)}
                    />
                  </div>
                )}

                {scheduleType === 'rrule' && (
                  <div className="space-y-2">
                    <Label>RRULE правило</Label>
                    <Input
                      value={scheduleRrule}
                      onChange={(e) => setScheduleRrule(e.target.value)}
                      placeholder="FREQ=DAILY;BYDAY=MO,WE,FR"
                    />
                    <p className="text-xs text-muted-foreground">
                      Формат iCalendar RRULE. Пример: каждый понедельник, среду, пятницу
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Окно отправки: начало</Label>
                    <Input
                      type="time"
                      value={windowStart}
                      onChange={(e) => setWindowStart(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Окно отправки: конец</Label>
                    <Input
                      type="time"
                      value={windowEnd}
                      onChange={(e) => setWindowEnd(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox
                    id="test-required"
                    checked={testRequired}
                    onCheckedChange={(checked) => setTestRequired(checked as boolean)}
                  />
                  <Label htmlFor="test-required">
                    Обязательна тестовая отправка перед запуском
                  </Label>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="utm" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>UTM-метки и ограничения</CardTitle>
                <CardDescription>
                  Параметры отслеживания и лимиты рассылки
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3">
                  <div className="flex justify-between items-center p-2 border rounded">
                    <span className="text-sm font-medium">utm_source</span>
                    <Badge variant="secondary">{mailingList.utm_source}</Badge>
                  </div>
                  <div className="flex justify-between items-center p-2 border rounded">
                    <span className="text-sm font-medium">utm_medium</span>
                    <Badge variant="secondary">{mailingList.utm_medium}</Badge>
                  </div>
                  <div className="flex justify-between items-center p-2 border rounded">
                    <span className="text-sm font-medium">utm_campaign</span>
                    <Badge variant="secondary">{mailingList.utm_campaign}</Badge>
                  </div>
                </div>

                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-gray-700">
                    <Icon name="Info" className="w-4 h-4 inline mr-1" />
                    UTM-метки настраиваются при привязке списка к мероприятию
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex gap-2 pt-4 border-t">
          <Button
            variant="outline"
            onClick={handleGenerateDrafts}
            disabled={selectedContentTypes.length === 0 || loading}
          >
            <Icon name="FileText" className="w-4 h-4 mr-2" />
            Сгенерировать черновики
          </Button>
          <Button
            variant="default"
            onClick={handleLaunch}
            disabled={loading}
          >
            <Icon name="Play" className="w-4 h-4 mr-2" />
            Запустить
          </Button>
          <Button
            variant="outline"
            onClick={handleTest}
            disabled={loading}
          >
            <Icon name="Send" className="w-4 h-4 mr-2" />
            Тест
          </Button>
          <div className="flex-1" />
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? 'Сохранение...' : 'Сохранить'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}