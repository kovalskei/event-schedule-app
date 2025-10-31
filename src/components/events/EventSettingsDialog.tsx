import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { toast as sonnerToast } from 'sonner';
import Icon from '@/components/ui/icon';

const EVENTS_MANAGER_URL = 'https://functions.poehali.dev/b56e5895-fb22-4d96-b746-b046a9fd2750';
const IMAGE_UPLOADER_URL = 'https://functions.poehali.dev/61daaad5-eb92-4f21-8104-8760f8d0094e';
const INDEX_KNOWLEDGE_URL = 'https://functions.poehali.dev/814ac16e-cb58-4603-b3af-4b6f9215fb05';
const TEMPLATE_GENERATOR_URL = 'https://functions.poehali.dev/616d6890-24c3-49c8-8b29-692dd342933b';

interface Event {
  id: number;
  name: string;
  description: string;
  start_date: string;
  end_date: string;
  program_doc_id: string;
  pain_doc_id: string;
  default_tone: string;
  email_template_examples: string;
  logo_url?: string;
  cta_base_url?: string;
  use_v2_pipeline?: boolean;
}

interface ContentType {
  id: number;
  name: string;
  description: string;
  cta_urls?: Array<{ label: string; url: string }>;
}

interface EmailTemplate {
  id: number;
  content_type_id: number;
  content_type_name: string;
  name: string;
  html_template: string;
  subject_template: string;
  instructions: string;
}

interface EventSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: number | null;
  onUpdate: () => void;
}

export default function EventSettingsDialog({
  open,
  onOpenChange,
  eventId,
  onUpdate,
}: EventSettingsDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [indexing, setIndexing] = useState(false);
  const [generatingTemplate, setGeneratingTemplate] = useState(false);
  const [event, setEvent] = useState<Event | null>(null);
  const [contentTypes, setContentTypes] = useState<ContentType[]>([]);
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);
  
  const [newContentType, setNewContentType] = useState({ 
    name: '', 
    description: '', 
    cta_urls: [{ label: '', url: '' }] 
  });
  const [editingContentType, setEditingContentType] = useState<ContentType | null>(null);
  const [newTemplate, setNewTemplate] = useState({
    content_type_id: '',
    name: '',
    html_template: '',
    subject_template: '',
    instructions: '',
  });
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplate | null>(null);
  const [previewHtml, setPreviewHtml] = useState('');
  const templateFormRef = useRef<HTMLDivElement>(null);
  const contentTypeFormRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && eventId) {
      loadEventSettings();
    }
  }, [open, eventId]);

  const loadEventSettings = async () => {
    if (!eventId) return;
    
    setLoading(true);
    try {
      const res = await fetch(`${EVENTS_MANAGER_URL}?action=get_event&event_id=${eventId}`);
      const data = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setEvent(data.event);
      setContentTypes(data.content_types || []);
      setEmailTemplates(data.email_templates || []);
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

  const handleUpdateEvent = async () => {
    if (!event) return;

    setLoading(true);
    try {
      const res = await fetch(EVENTS_MANAGER_URL, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_event',
          event_id: event.id,
          ...event,
        }),
      });

      const data = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }

      toast({
        title: 'Настройки обновлены',
        description: 'Изменения сохранены',
      });

      onUpdate();
    } catch (error: any) {
      toast({
        title: 'Ошибка обновления',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateContentType = async () => {
    if (!newContentType.name || !eventId) {
      toast({
        title: 'Ошибка',
        description: 'Укажите название типа контента',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const action = editingContentType ? 'update_content_type' : 'create_content_type';
      const body: any = {
        action,
        event_id: eventId,
        ...newContentType,
      };

      if (editingContentType) {
        body.content_type_id = editingContentType.id;
      }

      const res = await fetch(EVENTS_MANAGER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }

      toast({
        title: editingContentType ? 'Тип контента обновлён' : 'Тип контента создан',
        description: newContentType.name,
      });

      setNewContentType({ 
        name: '', 
        description: '', 
        cta_urls: [{ label: '', url: '' }] 
      });
      setEditingContentType(null);
      loadEventSettings();
    } catch (error: any) {
      toast({
        title: editingContentType ? 'Ошибка обновления' : 'Ошибка создания',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTemplate = async () => {
    if (!newTemplate.content_type_id || !newTemplate.name || !newTemplate.html_template || !eventId) {
      toast({
        title: 'Ошибка',
        description: 'Заполните обязательные поля',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(EVENTS_MANAGER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_email_template',
          event_id: eventId,
          ...newTemplate,
        }),
      });

      const data = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }

      toast({
        title: 'Шаблон создан',
        description: newTemplate.name,
      });

      setNewTemplate({
        content_type_id: '',
        name: '',
        html_template: '',
        subject_template: '',
        instructions: '',
      });
      loadEventSettings();
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

  const handleEditTemplate = (template: EmailTemplate) => {
    setEditingTemplate(template);
    setNewTemplate({
      content_type_id: template.content_type_id.toString(),
      name: template.name,
      html_template: template.html_template,
      subject_template: template.subject_template,
      instructions: template.instructions,
    });
    
    setTimeout(() => {
      templateFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const handleUpdateTemplate = async () => {
    if (!editingTemplate || !eventId) return;

    setLoading(true);
    try {
      const res = await fetch(EVENTS_MANAGER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_email_template',
          template_id: editingTemplate.id,
          ...newTemplate,
        }),
      });

      const data = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }

      toast({
        title: 'Шаблон обновлён',
        description: newTemplate.name,
      });

      setNewTemplate({
        content_type_id: '',
        name: '',
        html_template: '',
        subject_template: '',
        instructions: '',
      });
      setEditingTemplate(null);
      loadEventSettings();
    } catch (error: any) {
      toast({
        title: 'Ошибка обновления шаблона',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingTemplate(null);
    setNewTemplate({
      content_type_id: '',
      name: '',
      html_template: '',
      subject_template: '',
      instructions: '',
    });
  };

  const handlePreviewTemplate = (template: EmailTemplate) => {
    const testData = generateTestData(template.html_template);
    const renderedHtml = renderMustache(template.html_template, testData);
    setPreviewTemplate(template);
    setPreviewHtml(renderedHtml);
  };

  const generateTestData = (htmlTemplate: string): Record<string, any> => {
    const testData: Record<string, any> = {};
    const mustacheRegex = /\{\{\{?([^}]+)\}?\}\}/g;
    let match;

    while ((match = mustacheRegex.exec(htmlTemplate)) !== null) {
      const key = match[1].trim();
      
      if (key.startsWith('#') || key.startsWith('/') || key.startsWith('^') || key.startsWith('!')) continue;
      
      if (key === 'headline') testData[key] = 'Заголовок мероприятия';
      else if (key === 'intro_text') testData[key] = 'Приглашаем вас на интересное мероприятие, где мы обсудим актуальные темы и поделимся опытом.';
      else if (key === 'subject') testData[key] = 'Тема письма: Приглашение на мероприятие';
      else if (key === 'cta_text') testData[key] = 'Зарегистрироваться';
      else if (key === 'cta_url') testData[key] = 'https://example.com/register';
      else if (key === 'event_date') testData[key] = '15 ноября 2025';
      else if (key === 'event_time') testData[key] = '10:00 - 18:00';
      else if (key === 'event_location') testData[key] = 'Москва, ул. Примерная, 1';
      else if (key === 'speakers') {
        testData[key] = [
          {
            name: 'Иван Иванов',
            title: 'Директор по развитию',
            pitch: 'Эксперт в области управления проектами с 15-летним опытом',
            photo_url: 'https://via.placeholder.com/100'
          },
          {
            name: 'Мария Петрова',
            title: 'Руководитель отдела HR',
            pitch: 'Специалист по развитию персонала и корпоративной культуре',
            photo_url: 'https://via.placeholder.com/100'
          }
        ];
      }
      else testData[key] = `Тестовое значение для ${key}`;
    }

    return testData;
  };

  const renderMustache = (template: string, data: Record<string, any>): string => {
    let result = template;
    
    Object.keys(data).forEach(key => {
      const value = data[key];
      
      if (Array.isArray(value)) {
        const sectionRegex = new RegExp(`\\{\\{#${key}\\}\\}([\\s\\S]*?)\\{\\{\\/${key}\\}\\}`, 'g');
        result = result.replace(sectionRegex, (match, inner) => {
          return value.map(item => {
            let itemHtml = inner;
            Object.keys(item).forEach(itemKey => {
              itemHtml = itemHtml.replace(new RegExp(`\\{\\{${itemKey}\\}\\}`, 'g'), item[itemKey]);
            });
            return itemHtml;
          }).join('');
        });
      } else {
        result = result.replace(new RegExp(`\\{\\{\\{?${key}\\}?\\}\\}`, 'g'), value);
      }
    });
    
    return result;
  };

  const handleDeleteTemplate = async (templateId: number, templateName: string) => {
    const confirmed = window.confirm(
      `Удалить шаблон "${templateName}"?\n\nЭто действие нельзя отменить.`
    );
    
    if (!confirmed) return;

    setLoading(true);
    try {
      const res = await fetch(EVENTS_MANAGER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete_email_template',
          template_id: templateId,
        }),
      });

      const data = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }

      toast({
        title: 'Шаблон удалён',
        description: templateName,
      });

      loadEventSettings();
    } catch (error: any) {
      toast({
        title: 'Ошибка удаления',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateTemplate = async () => {
    if (!newTemplate.html_template) {
      sonnerToast.error('Вставьте HTML для преобразования');
      return;
    }

    if (!newTemplate.content_type_id || !newTemplate.name) {
      sonnerToast.error('Укажите тип контента и название шаблона');
      return;
    }

    setGeneratingTemplate(true);
    try {
      const requestBody = { 
        html_content: newTemplate.html_template,
        event_id: eventId,
        content_type_id: parseInt(newTemplate.content_type_id),
        name: newTemplate.name + ' (со слотами)'
      };
      
      console.log('[FRONTEND] Sending to template-generator:', {
        html_length: requestBody.html_content?.length || 0,
        html_preview: requestBody.html_content?.substring(0, 200) || 'EMPTY',
        event_id: requestBody.event_id,
        content_type_id: requestBody.content_type_id
      });
      
      const res = await fetch(TEMPLATE_GENERATOR_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const data = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }

      sonnerToast.success(editingTemplate ? 'Шаблон преобразован!' : 'Новый шаблон создан!', {
        description: `Оригинал сохранён как пример для валидации. ${data.notes || ''}`,
      });

      setNewTemplate({
        content_type_id: '',
        name: '',
        html_template: '',
        subject_template: '',
        instructions: '',
      });
      
      if (editingTemplate) {
        setEditingTemplate(null);
      }

      loadEventSettings();
    } catch (error: any) {
      sonnerToast.error(`Ошибка генерации: ${error.message}`);
    } finally {
      setGeneratingTemplate(false);
    }
  };

  const handleIndexKnowledge = async () => {
    if (!eventId) return;
    
    setIndexing(true);
    try {
      const res = await fetch(INDEX_KNOWLEDGE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: eventId }),
      });
      
      const data = await res.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      sonnerToast.success(`Проиндексировано ${data.indexed_count} элементов знаний`);
    } catch (error: any) {
      sonnerToast.error(`Ошибка индексации: ${error.message}`);
    } finally {
      setIndexing(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !event) return;

    if (!file.type.startsWith('image/')) {
      sonnerToast.error('Пожалуйста, выберите изображение');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      sonnerToast.error('Размер файла не должен превышать 2 МБ');
      return;
    }

    setLogoUploading(true);

    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        
        try {
          const uploadRes = await fetch(IMAGE_UPLOADER_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              image: base64,
              filename: file.name,
            }),
          });

          const uploadData = await uploadRes.json();

          if (uploadData.error) {
            throw new Error(uploadData.error);
          }

          const imageUrl = uploadData.url;
          setEvent({ ...event, logo_url: imageUrl });

          const updateRes = await fetch(EVENTS_MANAGER_URL, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'update_event',
              event_id: event.id,
              logo_url: imageUrl,
            }),
          });

          const updateData = await updateRes.json();

          if (updateData.error) {
            throw new Error(updateData.error);
          }

          sonnerToast.success('Логотип загружен и сохранён');
          onUpdate();
        } catch (error: any) {
          sonnerToast.error(error.message || 'Ошибка загрузки логотипа');
        } finally {
          setLogoUploading(false);
        }
      };
      reader.onerror = () => {
        sonnerToast.error('Ошибка чтения файла');
        setLogoUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      sonnerToast.error('Ошибка загрузки логотипа');
      setLogoUploading(false);
    }
  };

  if (!event) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon name="Settings" className="w-5 h-5" />
            Настройки мероприятия: {event.name}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="general">Основные</TabsTrigger>
            <TabsTrigger value="content-types">Типы контента</TabsTrigger>
            <TabsTrigger value="templates">Шаблоны писем</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Основная информация</CardTitle>
                <CardDescription>Настройки мероприятия и документов</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="name">Название</Label>
                  <Input
                    id="name"
                    value={event.name}
                    onChange={(e) => setEvent({ ...event, name: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="description">Описание</Label>
                  <Textarea
                    id="description"
                    value={event.description || ''}
                    onChange={(e) => setEvent({ ...event, description: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="logo">Логотип для шапки писем</Label>
                  <div className="space-y-2">
                    {event.logo_url && (
                      <div className="border rounded-lg p-4 bg-gray-50">
                        <img 
                          src={event.logo_url} 
                          alt="Event logo" 
                          className="h-16 object-contain"
                        />
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="mt-2"
                          onClick={() => setEvent({ ...event, logo_url: '' })}
                        >
                          <Icon name="X" className="w-3 h-3 mr-1" />
                          Удалить
                        </Button>
                      </div>
                    )}
                    <Input
                      id="logo"
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      disabled={logoUploading}
                    />
                    <p className="text-xs text-gray-500">
                      {logoUploading ? 'Загрузка...' : 'Рекомендуемый размер: 600x100px, максимум 2 МБ'}
                    </p>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="start_date">Дата начала</Label>
                    <Input
                      id="start_date"
                      type="date"
                      value={event.start_date}
                      onChange={(e) => setEvent({ ...event, start_date: e.target.value })}
                    />
                  </div>

                  <div>
                    <Label htmlFor="end_date">Дата окончания</Label>
                    <Input
                      id="end_date"
                      type="date"
                      value={event.end_date}
                      onChange={(e) => setEvent({ ...event, end_date: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="program_doc_id">ID документа с программой</Label>
                  <Input
                    id="program_doc_id"
                    value={event.program_doc_id || ''}
                    onChange={(e) => setEvent({ ...event, program_doc_id: e.target.value })}
                    placeholder="1abc2def3ghi..."
                  />
                </div>

                <div>
                  <Label htmlFor="pain_doc_id">ID документа с болями ЦА</Label>
                  <Input
                    id="pain_doc_id"
                    value={event.pain_doc_id || ''}
                    onChange={(e) => setEvent({ ...event, pain_doc_id: e.target.value })}
                    placeholder="4jkl5mno6pqr..."
                  />
                </div>

                <div>
                  <Label htmlFor="default_tone">Тон писем по умолчанию</Label>
                  <Select
                    value={event.default_tone}
                    onValueChange={(value) => setEvent({ ...event, default_tone: value })}
                  >
                    <SelectTrigger id="default_tone">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="professional">Профессиональный</SelectItem>
                      <SelectItem value="friendly">Дружелюбный</SelectItem>
                      <SelectItem value="formal">Официальный</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="email_template_examples">Примеры шаблонов</Label>
                  <Textarea
                    id="email_template_examples"
                    value={event.email_template_examples || ''}
                    onChange={(e) => setEvent({ ...event, email_template_examples: e.target.value })}
                    rows={5}
                    placeholder="Примеры успешных писем, референсы дизайна..."
                  />
                </div>

                <div>
                  <Label htmlFor="cta_base_url">Базовая CTA ссылка</Label>
                  <Input
                    id="cta_base_url"
                    value={event.cta_base_url || ''}
                    onChange={(e) => setEvent({ ...event, cta_base_url: e.target.value })}
                    placeholder="https://example.com/register"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    UTM-метки будут добавлены автоматически при генерации писем
                  </p>
                </div>

                <Card className="border-2 border-blue-200 bg-blue-50">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Icon name="Sparkles" className="w-5 h-5 text-blue-600" />
                      V2 Pipeline (Новая система генерации)
                    </CardTitle>
                    <CardDescription>
                      Двухпроходная генерация с RAG, строгими шаблонами и QA-валидацией
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-white rounded-lg">
                      <div>
                        <div className="font-medium">Использовать V2 Pipeline</div>
                        <div className="text-xs text-gray-600">
                          {(event as any).use_v2_pipeline 
                            ? '✅ Включено — письма генерируются через V2' 
                            : '⚠️ Выключено — используется старая система (V1)'}
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={(event as any).use_v2_pipeline || false}
                          onChange={(e) => setEvent({ ...event, use_v2_pipeline: e.target.checked } as any)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>

                    <div className="text-xs text-gray-700 space-y-1 bg-white p-3 rounded-lg">
                      <div className="font-semibold mb-2">Преимущества V2:</div>
                      <div>✅ Двухпроходная генерация (план → тексты слотов)</div>
                      <div>✅ RAG: семантический поиск вместо обрезки по символам</div>
                      <div>✅ Строгие HTML-шаблоны (табличная вёрстка)</div>
                      <div>✅ QA-валидация (subject, alt, links, размер)</div>
                      <div>✅ A/B варианты subject из одного запроса</div>
                    </div>

                    <Button 
                      onClick={handleIndexKnowledge} 
                      disabled={indexing || !event?.use_v2_pipeline}
                      className="w-full"
                      variant="outline"
                    >
                      <Icon name={indexing ? "Loader2" : "Database"} className={`w-4 h-4 mr-2 ${indexing ? 'animate-spin' : ''}`} />
                      {indexing ? 'Индексация...' : 'Индексировать знания'}
                    </Button>
                    
                    {!event?.use_v2_pipeline && (
                      <div className="text-xs text-yellow-700 bg-yellow-50 p-2 rounded">
                        ℹ️ Включите V2 Pipeline, чтобы запустить индексацию
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Button onClick={handleUpdateEvent} disabled={loading} className="w-full">
                  <Icon name="Save" className="w-4 h-4 mr-2" />
                  Сохранить изменения
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="content-types" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Типы контента</CardTitle>
                <CardDescription>
                  Создайте типы контента для разных видов писем
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  {contentTypes.map((ct) => (
                    <div
                      key={ct.id}
                      className="p-3 border rounded-lg bg-gray-50 space-y-2"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="font-semibold">{ct.name}</div>
                          {ct.description && (
                            <div className="text-sm text-gray-600">{ct.description}</div>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingContentType(ct);
                            setNewContentType({
                              name: ct.name,
                              description: ct.description || '',
                              cta_urls: ct.cta_urls && ct.cta_urls.length > 0 ? ct.cta_urls : [{ label: '', url: '' }]
                            });
                            setTimeout(() => {
                              contentTypeFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            }, 100);
                          }}
                        >
                          <Icon name="Pencil" className="w-4 h-4" />
                        </Button>
                      </div>
                      {ct.cta_urls && ct.cta_urls.length > 0 && (
                        <div className="text-xs space-y-1 pt-2 border-t">
                          <div className="font-medium text-gray-500">CTA кнопки:</div>
                          {ct.cta_urls.filter(cta => cta.label && cta.url).map((cta, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-gray-600">
                              <Icon name="Link" className="w-3 h-3" />
                              <span>{cta.label}</span>
                              <span className="text-gray-400">→</span>
                              <span className="truncate">{cta.url}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {contentTypes.length === 0 && (
                    <div className="text-center text-gray-500 py-8">
                      Типы контента не созданы
                    </div>
                  )}
                </div>

                <div ref={contentTypeFormRef} className="border-t pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">
                      {editingContentType ? 'Редактировать тип контента' : 'Добавить новый тип'}
                    </h3>
                    {editingContentType && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingContentType(null);
                          setNewContentType({ 
                            name: '', 
                            description: '', 
                            cta_urls: [{ label: '', url: '' }] 
                          });
                        }}
                      >
                        <Icon name="X" className="w-4 h-4 mr-1" />
                        Отмена
                      </Button>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="new_content_type_name">Название</Label>
                    <Input
                      id="new_content_type_name"
                      value={newContentType.name}
                      onChange={(e) => setNewContentType({ ...newContentType, name: e.target.value })}
                      placeholder="Анонс, Напоминание, Итоги..."
                    />
                  </div>
                  <div>
                    <Label htmlFor="new_content_type_description">Описание</Label>
                    <Textarea
                      id="new_content_type_description"
                      value={newContentType.description}
                      onChange={(e) => setNewContentType({ ...newContentType, description: e.target.value })}
                      placeholder="Для чего используется этот тип..."
                    />
                  </div>
                  
                  <div className="space-y-3">
                    <Label>CTA кнопки</Label>
                    {newContentType.cta_urls.map((cta, idx) => (
                      <div key={idx} className="flex gap-2">
                        <Input
                          value={cta.label}
                          onChange={(e) => {
                            const updated = [...newContentType.cta_urls];
                            updated[idx].label = e.target.value;
                            setNewContentType({ ...newContentType, cta_urls: updated });
                          }}
                          placeholder="Текст кнопки (Зарегистрироваться)"
                          className="flex-1"
                        />
                        <Input
                          value={cta.url}
                          onChange={(e) => {
                            const updated = [...newContentType.cta_urls];
                            updated[idx].url = e.target.value;
                            setNewContentType({ ...newContentType, cta_urls: updated });
                          }}
                          placeholder="https://event.com/register"
                          className="flex-1"
                        />
                        {newContentType.cta_urls.length > 1 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              const updated = newContentType.cta_urls.filter((_, i) => i !== idx);
                              setNewContentType({ ...newContentType, cta_urls: updated });
                            }}
                          >
                            <Icon name="X" className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setNewContentType({
                          ...newContentType,
                          cta_urls: [...newContentType.cta_urls, { label: '', url: '' }]
                        });
                      }}
                    >
                      <Icon name="Plus" className="w-3 h-3 mr-1" />
                      Добавить кнопку
                    </Button>
                    <p className="text-xs text-gray-500">
                      UTM-метки будут добавлены автоматически при генерации писем
                    </p>
                  </div>
                  
                  <Button onClick={handleCreateContentType} disabled={loading}>
                    <Icon name={editingContentType ? "Save" : "Plus"} className="w-4 h-4 mr-2" />
                    {editingContentType ? 'Сохранить изменения' : 'Создать тип контента'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="templates" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Шаблоны писем</CardTitle>
                <CardDescription>
                  HTML шаблоны для каждого типа контента
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  {emailTemplates.map((template) => (
                    <div
                      key={template.id}
                      className="p-4 border rounded-lg bg-gray-50"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-semibold">{template.name}</div>
                          <div className="text-sm text-gray-600">
                            Тип: {template.content_type_name}
                          </div>
                          {template.subject_template && (
                            <div className="text-sm text-gray-500 mt-1">
                              Тема: {template.subject_template}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handlePreviewTemplate(template)}
                            disabled={loading}
                            title="Предпросмотр с тестовыми данными"
                          >
                            <Icon name="Eye" className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditTemplate(template)}
                            disabled={loading}
                          >
                            <Icon name="Edit" className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteTemplate(template.id, template.name)}
                            disabled={loading}
                          >
                            <Icon name="Trash2" className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {emailTemplates.length === 0 && (
                    <div className="text-center text-gray-500 py-8">
                      Шаблоны не созданы
                    </div>
                  )}
                </div>

                {contentTypes.length > 0 ? (
                  <div ref={templateFormRef} className="border-t pt-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">
                        {editingTemplate ? 'Редактировать шаблон' : 'Добавить новый шаблон'}
                      </h3>
                      {editingTemplate && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleCancelEdit}
                        >
                          <Icon name="X" className="w-4 h-4 mr-2" />
                          Отмена
                        </Button>
                      )}
                    </div>
                    
                    <div>
                      <Label htmlFor="template_content_type">Тип контента</Label>
                      <Select
                        value={newTemplate.content_type_id}
                        onValueChange={(value) => setNewTemplate({ ...newTemplate, content_type_id: value })}
                      >
                        <SelectTrigger id="template_content_type">
                          <SelectValue placeholder="Выберите тип" />
                        </SelectTrigger>
                        <SelectContent>
                          {contentTypes.map((ct) => (
                            <SelectItem key={ct.id} value={ct.id.toString()}>
                              {ct.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="template_name">Название шаблона</Label>
                      <Input
                        id="template_name"
                        value={newTemplate.name}
                        onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                        placeholder="Шаблон 1, Вариант А..."
                      />
                    </div>

                    <div>
                      <Label htmlFor="template_subject">Шаблон темы письма</Label>
                      <Input
                        id="template_subject"
                        value={newTemplate.subject_template}
                        onChange={(e) => setNewTemplate({ ...newTemplate, subject_template: e.target.value })}
                        placeholder="{{topic}} - не пропустите!"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label htmlFor="template_html">HTML шаблон</Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleGenerateTemplate}
                          disabled={generatingTemplate || !newTemplate.html_template}
                        >
                          {generatingTemplate ? (
                            <>
                              <Icon name="Loader2" className="w-4 h-4 mr-2 animate-spin" />
                              Генерация...
                            </>
                          ) : (
                            <>
                              <Icon name="Sparkles" className="w-4 h-4 mr-2" />
                              Преобразовать в шаблон со слотами
                            </>
                          )}
                        </Button>
                      </div>
                      <Textarea
                        id="template_html"
                        value={newTemplate.html_template}
                        onChange={(e) => setNewTemplate({ ...newTemplate, html_template: e.target.value })}
                        rows={8}
                        placeholder="<html>...</html>"
                        className="font-mono text-sm"
                      />
                      <div className="text-xs text-gray-500 mt-2 p-3 bg-blue-50 rounded border border-blue-200">
                        <div className="font-semibold mb-1">💡 Как использовать генератор:</div>
                        <ol className="list-decimal ml-4 space-y-1">
                          <li>Укажите тип контента и название шаблона</li>
                          <li>Вставьте готовый HTML письма с примером дизайна</li>
                          <li>Нажмите "Преобразовать в шаблон со слотами"</li>
                          <li>Оригинал сохранится как эталон для валидации</li>
                          <li>Будет создан новый шаблон с Mustache слотами</li>
                        </ol>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="template_instructions">Инструкции для ИИ</Label>
                      <Textarea
                        id="template_instructions"
                        value={newTemplate.instructions}
                        onChange={(e) => setNewTemplate({ ...newTemplate, instructions: e.target.value })}
                        rows={3}
                        placeholder="Как ИИ должен использовать этот шаблон..."
                      />
                    </div>

                    <div className="flex gap-2">
                      {editingTemplate ? (
                        <>
                          <Button onClick={handleUpdateTemplate} disabled={loading}>
                            <Icon name="Save" className="w-4 h-4 mr-2" />
                            Сохранить изменения
                          </Button>
                          <Button 
                            onClick={handleGenerateTemplate} 
                            disabled={loading || generatingTemplate}
                            variant="outline"
                          >
                            <Icon name="Wand2" className="w-4 h-4 mr-2" />
                            {generatingTemplate ? 'Преобразование...' : 'Преобразовать со слотами'}
                          </Button>
                          <Button variant="outline" onClick={handleCancelEdit}>
                            Отмена
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button onClick={handleCreateTemplate} disabled={loading}>
                            <Icon name="Plus" className="w-4 h-4 mr-2" />
                            Создать шаблон
                          </Button>
                          <Button 
                            onClick={handleGenerateTemplate} 
                            disabled={loading || generatingTemplate}
                            variant="outline"
                          >
                            <Icon name="Wand2" className="w-4 h-4 mr-2" />
                            {generatingTemplate ? 'Преобразование...' : 'Преобразовать со слотами'}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="border-t pt-4 text-center text-gray-500">
                    Сначала создайте типы контента
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>

      {previewTemplate && (
        <Dialog open={!!previewTemplate} onOpenChange={() => { setPreviewTemplate(null); setPreviewHtml(''); }}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Предпросмотр: {previewTemplate.name}</DialogTitle>
              <div className="text-sm text-gray-500">
                Шаблон с тестовыми данными
              </div>
            </DialogHeader>
            <div className="border rounded-lg p-4 bg-gray-50">
              <div className="mb-4 pb-4 border-b">
                <div className="text-sm font-semibold text-gray-700">Тема письма:</div>
                <div className="text-sm text-gray-600 mt-1">
                  {renderMustache(previewTemplate.subject_template, generateTestData(previewTemplate.subject_template))}
                </div>
              </div>
              <div 
                className="bg-white border rounded overflow-auto"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Dialog>
  );
}