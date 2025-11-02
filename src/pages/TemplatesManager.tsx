import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import Icon from '@/components/ui/icon';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import TemplateEditor from '@/components/TemplateEditor';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

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
  event_id?: number;
  event_name?: string;
}

export default function TemplatesManager() {
  const [view, setView] = useState<'list' | 'editor' | 'create'>('list');
  const [htmlContent, setHtmlContent] = useState('');
  const [fileName, setFileName] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [savedVariables, setSavedVariables] = useState<TemplateVariable[]>([]);
  const [templates, setTemplates] = useState<SavedTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentTemplateId, setCurrentTemplateId] = useState<number | null>(null);
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
      setView('create');
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
      const url = currentTemplateId
        ? 'https://functions.poehali.dev/50c63c70-0759-47a3-bb3e-22a1b13f28c5'
        : 'https://functions.poehali.dev/cb19fd34-0ded-42ab-862c-3665ec9698d7';

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(currentTemplateId && { template_id: currentTemplateId }),
          name: templateName,
          description: templateDescription,
          html_content: htmlContent,
          manual_variables: variables,
        }),
      });

      if (!response.ok) throw new Error('Ошибка сохранения');

      const data = await response.json();
      setSavedVariables(variables);
      setCurrentTemplateId(data.template_id);

      toast({
        title: 'Успешно сохранено!',
        description: `Шаблон "${templateName}" с ${variables.length} переменными`,
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

  const loadTemplate = async (templateId: number) => {
    setLoading(true);
    try {
      const response = await fetch(
        `https://functions.poehali.dev/b4868cc3-30a0-443e-8c0f-b2de1c5dee8f?template_id=${templateId}`
      );
      if (!response.ok) throw new Error('Ошибка загрузки шаблона');

      const data = await response.json();
      const template = data.template;

      setHtmlContent(template.original_html || template.html_content);
      setTemplateName(template.name);
      setTemplateDescription(template.description || '');
      setFileName(`${template.name}.html`);
      setSavedVariables(template.manual_variables || []);
      setCurrentTemplateId(templateId);
      setView('editor');
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

  const deleteTemplate = async (templateId: number) => {
    if (!confirm('Удалить этот шаблон?')) return;

    try {
      const response = await fetch('https://functions.poehali.dev/6d5f0479-16a9-4d44-8f35-e3e8e8d4da88', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template_id: templateId }),
      });

      if (!response.ok) throw new Error('Ошибка удаления');

      toast({ title: 'Шаблон удалён' });
      await loadTemplates();
    } catch (error: any) {
      toast({
        title: 'Ошибка удаления',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleCreateNew = () => {
    setHtmlContent('');
    setFileName('');
    setTemplateName('');
    setTemplateDescription('');
    setSavedVariables([]);
    setCurrentTemplateId(null);
    setView('create');
  };

  const handleBackToList = () => {
    setView('list');
    setHtmlContent('');
    setFileName('');
    setTemplateName('');
    setTemplateDescription('');
    setSavedVariables([]);
    setCurrentTemplateId(null);
  };

  const loadTemplate = async (templateId: number) => {
    setLoading(true);
    try {
      const response = await fetch('https://functions.poehali.dev/2e3f48d7-0bbc-4c24-983c-6de6f0e0c9b9', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template_id: templateId }),
      });

      if (!response.ok) throw new Error('Ошибка загрузки шаблона');

      const data = await response.json();
      setCurrentTemplateId(data.id);
      setTemplateName(data.name);
      setTemplateDescription(data.description || '');
      setHtmlContent(data.html_content);
      setSavedVariables(data.manual_variables || []);
      setView('create');
    } catch (error: any) {
      toast({
        title: 'Ошибка загрузки шаблона',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading && view === 'list') {
    return (
      <div className="p-8 flex items-center justify-center">
        <Icon name="Loader2" className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (view === 'list') {
    return (
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">Шаблоны писем</h1>
              <p className="text-gray-600">
                Создавайте размеченные шаблоны для использования в разных мероприятиях
              </p>
            </div>
            <Button onClick={handleCreateNew} size="lg">
              <Icon name="Plus" size={20} className="mr-2" />
              Создать шаблон
            </Button>
          </div>

          {templates.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <Icon name="FileText" className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <h3 className="text-xl font-medium mb-2">Нет шаблонов</h3>
                <p className="text-gray-500 mb-6">Создайте первый шаблон для начала работы</p>
                <Button onClick={handleCreateNew}>
                  <Icon name="Plus" size={18} className="mr-2" />
                  Создать первый шаблон
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {templates.map((template) => (
                <Card
                  key={template.id}
                  className="hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => loadTemplate(template.id)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg mb-1">{template.name}</CardTitle>
                        {template.description && (
                          <CardDescription className="text-sm line-clamp-2">
                            {template.description}
                          </CardDescription>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteTemplate(template.id);
                        }}
                      >
                        <Icon name="Trash2" size={16} className="text-red-500" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <Icon name="BracesIcon" size={16} />
                        <span>{template.variables_count} переменных</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Icon name="Calendar" size={16} />
                        <span>{new Date(template.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    {template.event_name && (
                      <div className="mt-3">
                        <Badge variant="secondary">
                          <Icon name="Tag" size={12} className="mr-1" />
                          {template.event_name}
                        </Badge>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (view === 'create') {
    return (
      <div className="p-8">
        <div className="max-w-4xl mx-auto">
          <Button variant="ghost" onClick={handleBackToList} className="mb-6">
            <Icon name="ArrowLeft" size={18} className="mr-2" />
            К списку шаблонов
          </Button>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Загрузить HTML файл</CardTitle>
              <CardDescription>
                Выберите HTML файл письма для разметки переменных
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Input
                type="file"
                accept=".html"
                onChange={handleFileUpload}
                className="cursor-pointer"
              />
              {fileName && (
                <div className="mt-3 flex items-center gap-2 text-sm text-green-600">
                  <Icon name="CheckCircle2" size={16} />
                  <span>Загружен: {fileName}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {htmlContent && (
            <>
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle>Информация о шаблоне</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="template-name">Название шаблона</Label>
                    <Input
                      id="template-name"
                      value={templateName}
                      onChange={(e) => setTemplateName(e.target.value)}
                      placeholder="Например: Анонс спикеров"
                    />
                  </div>
                  <div>
                    <Label htmlFor="template-desc">Описание (опционально)</Label>
                    <Textarea
                      id="template-desc"
                      value={templateDescription}
                      onChange={(e) => setTemplateDescription(e.target.value)}
                      placeholder="Для каких целей используется этот шаблон?"
                      rows={3}
                    />
                  </div>
                </CardContent>
              </Card>

              <TemplateEditor
                htmlContent={htmlContent}
                initialVariables={savedVariables}
                onSave={handleSaveTemplate}
              />

              {savedVariables.length > 0 && (
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
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        <Button variant="ghost" onClick={handleBackToList} className="mb-6">
          <Icon name="ArrowLeft" size={18} className="mr-2" />
          К списку шаблонов
        </Button>

        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-2xl">{templateName}</CardTitle>
                {templateDescription && (
                  <CardDescription className="mt-2">{templateDescription}</CardDescription>
                )}
              </div>
              <Badge variant="outline">{savedVariables.length} переменных</Badge>
            </div>
          </CardHeader>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Информация о шаблоне</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="edit-template-name">Название шаблона</Label>
              <Input
                id="edit-template-name"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="edit-template-desc">Описание</Label>
              <Textarea
                id="edit-template-desc"
                value={templateDescription}
                onChange={(e) => setTemplateDescription(e.target.value)}
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        <TemplateEditor
          htmlContent={htmlContent}
          initialVariables={savedVariables}
          onSave={handleSaveTemplate}
        />
      </div>
    </div>
  );
}