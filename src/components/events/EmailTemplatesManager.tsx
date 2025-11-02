import { useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Icon from '@/components/ui/icon';
import { EmailTemplate, ContentType } from './types';

interface EmailTemplatesManagerProps {
  emailTemplates: EmailTemplate[];
  contentTypes: ContentType[];
  newTemplate: {
    content_type_id: string;
    name: string;
    html_template: string;
    subject_template: string;
    instructions: string;
  };
  onNewTemplateChange: (template: any) => void;
  editingTemplate: EmailTemplate | null;
  onPreviewTemplate: (template: EmailTemplate) => void;
  onEditTemplate: (template: EmailTemplate) => void;
  onDeleteTemplate: (id: number, name: string) => void;
  onCancelEdit: () => void;
  onCreateTemplate: () => void;
  onGenerateTemplate: () => void;
  generatingTemplate: boolean;
  onShowLibrary: () => void;
  loading: boolean;
}

export default function EmailTemplatesManager({
  emailTemplates,
  contentTypes,
  newTemplate,
  onNewTemplateChange,
  editingTemplate,
  onPreviewTemplate,
  onEditTemplate,
  onDeleteTemplate,
  onCancelEdit,
  onCreateTemplate,
  onGenerateTemplate,
  generatingTemplate,
  onShowLibrary,
  loading,
}: EmailTemplatesManagerProps) {
  const templateFormRef = useRef<HTMLDivElement>(null);

  return (
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
                    onClick={() => onPreviewTemplate(template)}
                    disabled={loading}
                    title="Предпросмотр с тестовыми данными"
                  >
                    <Icon name="Eye" className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEditTemplate(template)}
                    disabled={loading}
                  >
                    <Icon name="Edit" className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDeleteTemplate(template.id, template.name)}
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
          <>
            <div className="border-t pt-4">
              <Button
                onClick={onShowLibrary}
                variant="outline"
                className="w-full"
              >
                <Icon name="Library" className="w-4 h-4 mr-2" />
                Выбрать шаблон из библиотеки
              </Button>
            </div>

            <div ref={templateFormRef} className="border-t pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">
                  {editingTemplate ? 'Редактировать шаблон' : 'Добавить новый шаблон'}
                </h3>
                {editingTemplate && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onCancelEdit}
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
                  onValueChange={(value) => onNewTemplateChange({ ...newTemplate, content_type_id: value })}
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
                  onChange={(e) => onNewTemplateChange({ ...newTemplate, name: e.target.value })}
                  placeholder="Шаблон 1, Вариант А..."
                />
              </div>

              <div>
                <Label htmlFor="template_subject">Шаблон темы письма</Label>
                <Input
                  id="template_subject"
                  value={newTemplate.subject_template}
                  onChange={(e) => onNewTemplateChange({ ...newTemplate, subject_template: e.target.value })}
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
                    onClick={onGenerateTemplate}
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
                  onChange={(e) => onNewTemplateChange({ ...newTemplate, html_template: e.target.value })}
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
                  onChange={(e) => onNewTemplateChange({ ...newTemplate, instructions: e.target.value })}
                  rows={3}
                  placeholder="Как ИИ должен использовать этот шаблон..."
                />
              </div>

              <Button onClick={onCreateTemplate} disabled={loading}>
                <Icon name={editingTemplate ? "Save" : "Plus"} className="w-4 h-4 mr-2" />
                {editingTemplate ? 'Сохранить изменения' : 'Создать шаблон'}
              </Button>
            </div>
          </>
        ) : (
          <div className="text-center text-yellow-600 py-4 bg-yellow-50 rounded border border-yellow-200">
            Создайте тип контента, чтобы добавить шаблон
          </div>
        )}
      </CardContent>
    </Card>
  );
}
