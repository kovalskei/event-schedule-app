import { useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import Icon from '@/components/ui/icon';
import { ContentType } from './types';

interface ContentTypesManagerProps {
  contentTypes: ContentType[];
  newContentType: {
    name: string;
    description: string;
    cta_urls: Array<{ label: string; url: string }>;
  };
  onNewContentTypeChange: (contentType: any) => void;
  editingContentType: ContentType | null;
  onEditContentType: (contentType: ContentType | null) => void;
  onCreateContentType: () => void;
  loading: boolean;
}

export default function ContentTypesManager({
  contentTypes,
  newContentType,
  onNewContentTypeChange,
  editingContentType,
  onEditContentType,
  onCreateContentType,
  loading,
}: ContentTypesManagerProps) {
  const contentTypeFormRef = useRef<HTMLDivElement>(null);

  return (
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
                    onEditContentType(ct);
                    onNewContentTypeChange({
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
                  onEditContentType(null);
                  onNewContentTypeChange({ 
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
              onChange={(e) => onNewContentTypeChange({ ...newContentType, name: e.target.value })}
              placeholder="Анонс, Напоминание, Итоги..."
            />
          </div>
          <div>
            <Label htmlFor="new_content_type_description">Описание</Label>
            <Textarea
              id="new_content_type_description"
              value={newContentType.description}
              onChange={(e) => onNewContentTypeChange({ ...newContentType, description: e.target.value })}
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
                    onNewContentTypeChange({ ...newContentType, cta_urls: updated });
                  }}
                  placeholder="Текст кнопки (Зарегистрироваться)"
                  className="flex-1"
                />
                <Input
                  value={cta.url}
                  onChange={(e) => {
                    const updated = [...newContentType.cta_urls];
                    updated[idx].url = e.target.value;
                    onNewContentTypeChange({ ...newContentType, cta_urls: updated });
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
                      onNewContentTypeChange({ ...newContentType, cta_urls: updated });
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
                onNewContentTypeChange({
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
          
          <Button onClick={onCreateContentType} disabled={loading}>
            <Icon name={editingContentType ? "Save" : "Plus"} className="w-4 h-4 mr-2" />
            {editingContentType ? 'Сохранить изменения' : 'Создать тип контента'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
