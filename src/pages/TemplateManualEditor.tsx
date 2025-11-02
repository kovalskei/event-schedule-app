import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import TemplateEditor from '@/components/TemplateEditor';
import TemplateGenerateForm from '@/components/TemplateGenerateForm';
import { useToast } from '@/hooks/use-toast';

interface TemplateVariable {
  id: string;
  name: string;
  description: string;
  source: string;
  startIndex: number;
  endIndex: number;
  content: string;
}

interface SavedTemplate {
  id: number;
  name: string;
  description: string;
  created_at: string;
  variables_count: number;
}

export default function TemplateManualEditor() {
  const [view, setView] = useState<'list' | 'editor'>('list');
  const [htmlContent, setHtmlContent] = useState('');
  const [fileName, setFileName] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [savedVariables, setSavedVariables] = useState<TemplateVariable[]>([]);
  const [templates, setTemplates] = useState<SavedTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentTemplateId, setCurrentTemplateId] = useState<number | null>(null);
  const [generatedHtml, setGeneratedHtml] = useState('');
  const [generatedVariables, setGeneratedVariables] = useState<Record<string, string>>({});
  const [showPreview, setShowPreview] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [testLoading, setTestLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const response = await fetch('https://functions.poehali.dev/b5791965-754f-416c-9998-028b60051e40');
      if (!response.ok) throw new Error('Ошибка загрузки');
      const data = await response.json();
      setTemplates(data.templates || []);
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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setHtmlContent(content);
      setView('editor');
    };
    reader.readAsText(file);
  };

  const handleSaveTemplate = async (variables: TemplateVariable[], annotatedHTML: string) => {
    if (!templateName) {
      toast({
        title: 'Ошибка',
        description: 'Укажите название шаблона',
        variant: 'destructive',
      });
      return;
    }

    try {
      const response = await fetch('https://functions.poehali.dev/cb19fd34-0ded-42ab-862c-3665ec9698d7', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: templateName,
          description: templateDescription,
          html_content: htmlContent,
          manual_variables: variables,
        }),
      });

      if (!response.ok) throw new Error('Ошибка сохранения');

      setSavedVariables(variables);
      toast({
        title: 'Успешно сохранено',
        description: `Шаблон "${templateName}" с ${variables.length} переменными сохранён`,
      });

      await loadTemplates();
    } catch (error: any) {
      toast({
        title: 'Ошибка сохранения',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleViewTemplate = async (templateId: number) => {
    try {
      const response = await fetch(
        `https://functions.poehali.dev/b5791965-754f-416c-9998-028b60051e40?template_id=${templateId}`
      );
      if (!response.ok) throw new Error('Ошибка загрузки шаблона');

      const data = await response.json();
      const template = data.template;

      // Всегда используем original_html для корректного отображения
      const htmlToDisplay = template.original_html || template.html_content;
      if (!template.original_html) {
        console.warn('[TemplateEditor] Missing original_html, using html_content (may contain {{placeholders}})');
      }
      
      setHtmlContent(htmlToDisplay);
      setTemplateName(template.name);
      setTemplateDescription(template.description || '');
      setFileName(`${template.name}.html`);
      setSavedVariables(template.manual_variables || []);
      setCurrentTemplateId(templateId);
      setView('editor');
    } catch (error: any) {
      toast({
        title: 'Ошибка',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleNewTemplate = () => {
    setHtmlContent('');
    setFileName('');
    setTemplateName('');
    setTemplateDescription('');
    setSavedVariables([]);
    setView('list');
  };

  const handleQuickTest = async () => {
    if (!currentTemplateId) {
      toast({
        title: 'Ошибка',
        description: 'Сначала сохраните шаблон',
        variant: 'destructive',
      });
      return;
    }

    setTestLoading(true);
    try {
      const response = await fetch('https://functions.poehali.dev/d1b65152-b43b-4be4-8611-8ba8ea54d5c2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_id: currentTemplateId,
          topic: 'Анонс конференции по маркетингу: тренды 2025',
          knowledge_context: 'Маркетинговое мероприятие для специалистов',
        }),
      });

      if (!response.ok) throw new Error('Ошибка генерации');

      const data = await response.json();
      setPreviewHtml(data.generated_html);
      setShowPreview(true);
      
      toast({
        title: '✅ Письмо сгенерировано',
        description: `Использовано ${Object.keys(data.variables_filled || {}).length} переменных`,
      });
    } catch (error: any) {
      toast({
        title: 'Ошибка теста',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setTestLoading(false);
    }
  };

  const handleAutoAnalyze = async () => {
    if (!htmlContent) {
      toast({
        title: 'Ошибка',
        description: 'Нет HTML для анализа',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('https://functions.poehali.dev/2a3fec21-8459-418c-a548-5bd1c9f2ff51', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          html_content: htmlContent,
        }),
      });

      if (!response.ok) throw new Error('Ошибка анализа');

      const data = await response.json();
      
      // Преобразуем переменные в формат TemplateVariable
      const autoVariables: TemplateVariable[] = data.variables.map((v: any, index: number) => ({
        id: `auto_${Date.now()}_${index}`,
        name: v.name,
        description: v.description,
        source: v.source,
        startIndex: 0,
        endIndex: 0,
        content: v.default_value || '',
      }));

      setSavedVariables(autoVariables);
      
      // Сразу сохраняем автошаблон
      if (!templateName) {
        toast({
          title: 'Укажите название',
          description: 'Введите название шаблона перед автоанализом',
          variant: 'destructive',
        });
        return;
      }

      const saveResponse = await fetch('https://functions.poehali.dev/cb19fd34-0ded-42ab-862c-3665ec9698d7', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: templateName,
          description: templateDescription || 'Автоматически размеченный шаблон',
          html_content: data.template_html, // Шаблон с {{плейсхолдерами}}
          original_html: data.original_html, // Оригинал
          manual_variables: autoVariables,
        }),
      });

      if (!saveResponse.ok) throw new Error('Ошибка сохранения');

      const saveData = await saveResponse.json();
      setCurrentTemplateId(saveData.template_id);

      toast({
        title: '✨ Автошаблон создан',
        description: `${data.variables_count} переменных: ${data.suggestions.has_speakers ? 'спикеры, ' : ''}${data.suggestions.has_intro ? 'вступление, ' : ''}${data.suggestions.has_cta ? 'CTA' : ''}`,
      });

      await loadTemplates();
    } catch (error: any) {
      toast({
        title: 'Ошибка',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (view === 'list') {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-5xl mx-auto">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">📚 Размеченные шаблоны</h1>
              <p className="text-gray-600">Все сохранённые шаблоны с переменными для ИИ</p>
            </div>
            <label className="inline-flex items-center gap-2 bg-purple-600 text-white px-6 py-3 rounded-lg cursor-pointer hover:bg-purple-700 transition-colors">
              <Icon name="Plus" size={20} />
              <span className="font-medium">Новый шаблон</span>
              <input type="file" accept=".html,.htm" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>

          {loading ? (
            <Card className="p-12 text-center">
              <div className="animate-spin mx-auto mb-4 w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full"></div>
              <p className="text-gray-600">Загрузка шаблонов...</p>
            </Card>
          ) : templates.length === 0 ? (
            <Card className="p-12 text-center">
              <Icon name="FileText" size={64} className="mx-auto mb-4 text-gray-400" />
              <h2 className="text-xl font-semibold mb-2">Нет сохранённых шаблонов</h2>
              <p className="text-gray-600 mb-6">Загрузите HTML и сделайте разметку переменных</p>
              <label className="inline-flex items-center gap-2 bg-purple-600 text-white px-6 py-3 rounded-lg cursor-pointer hover:bg-purple-700 transition-colors">
                <Icon name="Upload" size={20} />
                <span className="font-medium">Загрузить первый шаблон</span>
                <input type="file" accept=".html,.htm" onChange={handleFileUpload} className="hidden" />
              </label>
            </Card>
          ) : (
            <div className="grid gap-4">
              {templates.map((template) => (
                <Card
                  key={template.id}
                  className="p-4 hover:border-purple-400 transition-all cursor-pointer"
                  onClick={() => handleViewTemplate(template.id)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg mb-1">{template.name}</h3>
                      {template.description && (
                        <p className="text-sm text-gray-600 mb-2">{template.description}</p>
                      )}
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Icon name="Tags" size={14} />
                          {template.variables_count} переменных
                        </span>
                        <span className="flex items-center gap-1">
                          <Icon name="Calendar" size={14} />
                          {new Date(template.created_at).toLocaleDateString('ru-RU')}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewTemplate(template.id);
                        }}
                      >
                        <Icon name="Eye" size={16} className="mr-2" />
                        Открыть
                      </Button>
                      <Button 
                        variant="default" 
                        size="sm"
                        onClick={async (e) => {
                          e.stopPropagation();
                          setCurrentTemplateId(template.id);
                          await handleQuickTest();
                        }}
                      >
                        <Icon name="Play" size={16} className="mr-2" />
                        Тест
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">🎨 Визуальный редактор шаблонов</h1>
            <p className="text-gray-600">Выделите текст мышкой и укажите что генерировать ИИ</p>
          </div>
          <Button variant="outline" onClick={handleNewTemplate}>
            <Icon name="ArrowLeft" size={18} className="mr-2" />
            К списку шаблонов
          </Button>
        </div>

        {!htmlContent ? (
          <Card className="p-12 text-center">
            <Icon name="Upload" size={64} className="mx-auto mb-4 text-gray-400" />
            <h2 className="text-xl font-semibold mb-2">Загрузите HTML шаблон</h2>
            <p className="text-gray-600 mb-6">Выберите файл с HTML письма для начала разметки</p>
            <label className="inline-flex items-center gap-2 bg-purple-600 text-white px-6 py-3 rounded-lg cursor-pointer hover:bg-purple-700 transition-colors">
              <Icon name="FileText" size={20} />
              <span className="font-medium">Выбрать файл</span>
              <input type="file" accept=".html,.htm" onChange={handleFileUpload} className="hidden" />
            </label>
          </Card>
        ) : (
          <>
            <Card className="p-4 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Название шаблона</label>
                  <input
                    type="text"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="HR Tech Конференция"
                    className="w-full px-3 py-2 border rounded-md"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-gray-700 mb-1 block">
                    Описание (необязательно)
                  </label>
                  <input
                    type="text"
                    value={templateDescription}
                    onChange={(e) => setTemplateDescription(e.target.value)}
                    placeholder="Приглашение на конференцию с программой и спикерами"
                    className="w-full px-3 py-2 border rounded-md"
                  />
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <Icon name="FileText" size={16} />
                  <span>Файл: {fileName}</span>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleAutoAnalyze}
                  className="gap-2"
                >
                  <Icon name="Sparkles" size={16} />
                  Автоматическая разметка
                </Button>
              </div>
            </Card>

            {savedVariables.length > 0 && currentTemplateId && (
              <TemplateGenerateForm
                templateId={currentTemplateId}
                templateName={templateName}
                onGenerate={(html, vars) => {
                  setGeneratedHtml(html);
                  setGeneratedVariables(vars);
                  toast({
                    title: 'Письмо сгенерировано!',
                    description: 'Результат ниже',
                  });
                }}
              />
            )}

            <TemplateEditor 
              htmlContent={htmlContent} 
              initialVariables={savedVariables}
              onSave={handleSaveTemplate} 
            />

            {generatedHtml && (
              <Card className="mt-6 p-6 border-2 border-green-400">
                <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                  <Icon name="CheckCircle2" size={20} className="text-green-600" />
                  Сгенерированное письмо
                </h3>
                
                <div className="mb-4 p-3 bg-gray-50 rounded border">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Заполненные переменные:</h4>
                  <div className="space-y-1 text-sm">
                    {Object.entries(generatedVariables).map(([key, value]) => (
                      <div key={key} className="flex gap-2">
                        <span className="font-mono text-purple-600 font-semibold">{key}:</span>
                        <span className="text-gray-800">{value.substring(0, 80)}...</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border rounded p-4 bg-white overflow-auto max-h-96">
                  <iframe
                    srcDoc={generatedHtml}
                    className="w-full h-96 border-0"
                    title="Generated Email"
                    sandbox="allow-same-origin"
                  />
                </div>
              </Card>
            )}

            {savedVariables.length > 0 && !generatedHtml && (
              <Card className="mt-6 p-4 bg-green-50 border-green-200">
                <div className="flex items-center gap-2 text-green-800">
                  <Icon name="CheckCircle2" size={20} />
                  <span className="font-semibold">
                    Шаблон сохранён с {savedVariables.length} переменными
                  </span>
                </div>
              </Card>
            )}
          </>
        )}
      </div>

      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon name="Mail" size={24} />
              Предпросмотр письма
            </DialogTitle>
            <DialogDescription>
              Тестовая генерация для проверки работы шаблона
            </DialogDescription>
          </DialogHeader>
          
          <div className="mt-4">
            <div className="border rounded-lg overflow-hidden bg-white">
              <iframe
                srcDoc={previewHtml}
                className="w-full h-[600px] border-0"
                title="Email Preview"
                sandbox="allow-same-origin"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowPreview(false)}>
              Закрыть
            </Button>
            <Button 
              onClick={() => {
                const blob = new Blob([previewHtml], { type: 'text/html' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `test-email-${Date.now()}.html`;
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              <Icon name="Download" size={16} className="mr-2" />
              Скачать HTML
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}