import { useState } from 'react';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { Card } from '@/components/ui/card';
import TemplateEditor from '@/components/TemplateEditor';
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

export default function TemplateManualEditor() {
  const [htmlContent, setHtmlContent] = useState('');
  const [fileName, setFileName] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [savedVariables, setSavedVariables] = useState<TemplateVariable[]>([]);
  const { toast } = useToast();

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setHtmlContent(content);
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
    } catch (error: any) {
      toast({
        title: 'Ошибка сохранения',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">🎨 Визуальный редактор шаблонов</h1>
          <p className="text-gray-600">
            Загрузите HTML, выделите текст мышкой и укажите что генерировать ИИ
          </p>
        </div>

        {!htmlContent ? (
          <Card className="p-12 text-center">
            <Icon name="Upload" size={64} className="mx-auto mb-4 text-gray-400" />
            <h2 className="text-xl font-semibold mb-2">Загрузите HTML шаблон</h2>
            <p className="text-gray-600 mb-6">
              Выберите файл с HTML письма для начала разметки
            </p>
            <label className="inline-flex items-center gap-2 bg-purple-600 text-white px-6 py-3 rounded-lg cursor-pointer hover:bg-purple-700 transition-colors">
              <Icon name="FileText" size={20} />
              <span className="font-medium">Выбрать файл</span>
              <input
                type="file"
                accept=".html,.htm"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </Card>
        ) : (
          <>
            <Card className="p-4 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">
                    Название шаблона
                  </label>
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
              <div className="mt-3 flex items-center gap-3 text-sm text-gray-600">
                <Icon name="FileText" size={16} />
                <span>Файл: {fileName}</span>
              </div>
            </Card>

            <TemplateEditor htmlContent={htmlContent} onSave={handleSaveTemplate} />

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