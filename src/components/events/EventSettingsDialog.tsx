import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import Icon from '@/components/ui/icon';

import { Event, EmailTemplate, ContentType } from './types';
import EventGeneralSettings from './EventGeneralSettings';
import ContentTypesManager from './ContentTypesManager';
import EmailTemplatesManager from './EmailTemplatesManager';

import { useEventAPI } from './hooks/useEventAPI';
import { useContentTypesAPI } from './hooks/useContentTypesAPI';
import { useTemplatesAPI } from './hooks/useTemplatesAPI';
import { useLibraryAPI } from './hooks/useLibraryAPI';

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

  // State for content types and templates
  const [contentTypes, setContentTypes] = useState<ContentType[]>([]);
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);
  
  // Content Type state
  const [newContentType, setNewContentType] = useState({ 
    name: '', 
    description: '', 
    cta_urls: [{ label: '', url: '' }] 
  });
  const [editingContentType, setEditingContentType] = useState<ContentType | null>(null);
  
  // Template state
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
  
  // Library state
  const [showLibraryDialog, setShowLibraryDialog] = useState(false);
  const [selectedLibraryTemplate, setSelectedLibraryTemplate] = useState<any>(null);
  const [linkContentTypeId, setLinkContentTypeId] = useState<string>('');

  // Initialize API hooks
  const eventAPI = useEventAPI({ eventId, toast, onUpdate });
  const contentTypesAPI = useContentTypesAPI({ eventId, toast, onUpdate: loadData });
  const templatesAPI = useTemplatesAPI({ eventId, toast, onUpdate: loadData });
  const libraryAPI = useLibraryAPI({ eventId, toast, onUpdate: loadData });

  // Load all data
  async function loadData() {
    const data = await eventAPI.loadEventSettings();
    if (data) {
      setContentTypes(data.content_types);
      setEmailTemplates(data.email_templates);
    }
  }

  useEffect(() => {
    if (open && eventId) {
      loadData();
      libraryAPI.loadLibraryTemplates();
    }
  }, [open, eventId]);

  // Template preview functions
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

  const handlePreviewTemplate = (template: EmailTemplate) => {
    const testData = generateTestData(template.html_template);
    const renderedHtml = renderMustache(template.html_template, testData);
    setPreviewTemplate(template);
    setPreviewHtml(renderedHtml);
  };

  // Content Type handlers
  const handleCreateContentType = async () => {
    const success = await contentTypesAPI.handleCreateContentType(newContentType, editingContentType);
    if (success) {
      setNewContentType({ name: '', description: '', cta_urls: [{ label: '', url: '' }] });
      setEditingContentType(null);
    }
  };

  // Template handlers
  const handleCreateTemplate = async () => {
    const success = await templatesAPI.handleCreateTemplate(newTemplate);
    if (success) {
      setNewTemplate({
        content_type_id: '',
        name: '',
        html_template: '',
        subject_template: '',
        instructions: '',
      });
    }
  };

  const handleUpdateTemplate = async () => {
    if (!editingTemplate) return;
    const success = await templatesAPI.handleUpdateTemplate(editingTemplate, newTemplate);
    if (success) {
      setNewTemplate({
        content_type_id: '',
        name: '',
        html_template: '',
        subject_template: '',
        instructions: '',
      });
      setEditingTemplate(null);
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

  const handleGenerateTemplate = async () => {
    const success = await templatesAPI.handleGenerateTemplate(newTemplate, editingTemplate);
    if (success) {
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
    }
  };

  // Library handlers
  const handleLinkLibraryTemplate = async () => {
    const success = await libraryAPI.handleLinkLibraryTemplate(selectedLibraryTemplate, linkContentTypeId);
    if (success) {
      setShowLibraryDialog(false);
      setSelectedLibraryTemplate(null);
      setLinkContentTypeId('');
    }
  };

  if (!eventAPI.event) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon name="Settings" className="w-5 h-5" />
            Настройки мероприятия: {eventAPI.event.name}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="general">Основные</TabsTrigger>
            <TabsTrigger value="content-types">Типы контента</TabsTrigger>
            <TabsTrigger value="templates">Шаблоны писем</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-4">
            <EventGeneralSettings
              event={eventAPI.event}
              onEventChange={eventAPI.setEvent}
              onLogoUpload={(e) => eventAPI.handleLogoUpload(e, eventAPI.event!)}
              logoUploading={eventAPI.logoUploading}
              onIndexKnowledge={eventAPI.handleIndexKnowledge}
              indexing={eventAPI.indexing}
              onSave={() => eventAPI.handleUpdateEvent(eventAPI.event!)}
              loading={eventAPI.loading}
            />
          </TabsContent>

          <TabsContent value="content-types" className="space-y-4">
            <ContentTypesManager
              contentTypes={contentTypes}
              newContentType={newContentType}
              onNewContentTypeChange={setNewContentType}
              editingContentType={editingContentType}
              onEditContentType={setEditingContentType}
              onCreateContentType={handleCreateContentType}
              loading={contentTypesAPI.loading}
            />
          </TabsContent>

          <TabsContent value="templates" className="space-y-4">
            <EmailTemplatesManager
              emailTemplates={emailTemplates}
              contentTypes={contentTypes}
              newTemplate={newTemplate}
              onNewTemplateChange={setNewTemplate}
              editingTemplate={editingTemplate}
              onPreviewTemplate={handlePreviewTemplate}
              onEditTemplate={handleEditTemplate}
              onDeleteTemplate={templatesAPI.handleDeleteTemplate}
              onCancelEdit={handleCancelEdit}
              onCreateTemplate={editingTemplate ? handleUpdateTemplate : handleCreateTemplate}
              onGenerateTemplate={handleGenerateTemplate}
              generatingTemplate={templatesAPI.generatingTemplate}
              onShowLibrary={() => setShowLibraryDialog(true)}
              loading={templatesAPI.loading}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>

      {/* Library Template Dialog */}
      <Dialog open={showLibraryDialog} onOpenChange={setShowLibraryDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Библиотека шаблонов</DialogTitle>
            <DialogDescription>
              Выберите шаблон и тип контента для привязки к мероприятию
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>Тип контента</Label>
              <Select value={linkContentTypeId} onValueChange={setLinkContentTypeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите тип контента" />
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

            <div className="space-y-2">
              <Label>Доступные шаблоны</Label>
              {libraryAPI.libraryTemplates.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  Библиотека шаблонов пуста
                </div>
              ) : (
                <div className="grid gap-2">
                  {libraryAPI.libraryTemplates.map((template) => (
                    <Card
                      key={template.id}
                      className={`cursor-pointer transition-all ${
                        selectedLibraryTemplate?.id === template.id
                          ? 'ring-2 ring-blue-500 bg-blue-50'
                          : 'hover:bg-gray-50'
                      }`}
                      onClick={() => setSelectedLibraryTemplate(template)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="font-semibold">{template.name}</div>
                            {template.description && (
                              <div className="text-sm text-gray-600 mt-1">
                                {template.description}
                              </div>
                            )}
                            <div className="flex items-center gap-2 mt-2">
                              <Icon name="Braces" className="w-3 h-3 text-gray-400" />
                              <span className="text-xs text-gray-500">
                                {template.variables_count || 0} переменных
                              </span>
                            </div>
                          </div>
                          {selectedLibraryTemplate?.id === template.id && (
                            <Icon name="CheckCircle2" className="w-5 h-5 text-blue-600" />
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => {
                setShowLibraryDialog(false);
                setSelectedLibraryTemplate(null);
                setLinkContentTypeId('');
              }}>
                Отмена
              </Button>
              <Button
                onClick={handleLinkLibraryTemplate}
                disabled={!selectedLibraryTemplate || !linkContentTypeId || libraryAPI.loading}
              >
                <Icon name="Link" className="w-4 h-4 mr-2" />
                Привязать шаблон
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Template Preview Dialog */}
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