import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import Icon from '@/components/ui/icon';
import { Badge } from '@/components/ui/badge';

interface AdaptedTemplate {
  placeholders: Array<{
    name: string;
    type: string;
    selectorHint?: string;
  }>;
  meta: {
    hasBlocks: string[];
    detectedCtas: Array<{
      textPlaceholder: string;
      urlPlaceholder: string;
    }>;
  };
}

interface RenderFormProps {
  template: AdaptedTemplate;
  onRender: (data: any) => void;
  loading: boolean;
  onBack: () => void;
}

export function RenderForm({ template, onRender, loading, onBack }: RenderFormProps) {
  const [formData, setFormData] = useState<Record<string, any>>(() => {
    const initial: Record<string, any> = {};
    
    template.placeholders.forEach(p => {
      if (p.type === 'block') {
        if (!initial.blocks) initial.blocks = {};
        initial.blocks[p.name] = true;
      } else if (p.name.includes('.')) {
        const [parent, child] = p.name.split('.');
        if (!initial[parent]) initial[parent] = {};
        initial[parent][child] = '';
      } else {
        initial[p.name] = '';
      }
    });
    
    return initial;
  });

  const handleSubmit = () => {
    onRender(formData);
  };

  const setValue = (path: string, value: any) => {
    if (path.includes('.')) {
      const [parent, child] = path.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [path]: value
      }));
    }
  };

  const getValue = (path: string): any => {
    if (path.includes('.')) {
      const [parent, child] = path.split('.');
      return formData[parent]?.[child] || '';
    }
    return formData[path] || '';
  };

  const setBlockValue = (blockName: string, enabled: boolean) => {
    setFormData(prev => ({
      ...prev,
      blocks: {
        ...prev.blocks,
        [blockName]: enabled
      }
    }));
  };

  const getBlockValue = (blockName: string): boolean => {
    return formData.blocks?.[blockName] ?? true;
  };

  const textPlaceholders = template.placeholders.filter(
    p => p.type === 'text' && p.name !== 'preheader'
  );
  const urlPlaceholders = template.placeholders.filter(p => p.type === 'url');
  const blockPlaceholders = template.placeholders.filter(p => p.type === 'block');
  const preheaderPlaceholder = template.placeholders.find(p => p.name === 'preheader');

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Заполните данные шаблона</CardTitle>
          <CardDescription>
            Введите значения для плейсхолдеров
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {preheaderPlaceholder && (
            <div className="space-y-2 p-4 bg-muted/50 rounded-lg">
              <Label htmlFor="preheader" className="flex items-center space-x-2">
                <Icon name="Eye" className="h-4 w-4" />
                <span>Прехедер (превью текст)</span>
              </Label>
              <Input
                id="preheader"
                placeholder="Краткое описание письма (40-100 символов)"
                value={getValue('preheader')}
                onChange={(e) => setValue('preheader', e.target.value)}
                maxLength={100}
              />
              <div className="text-xs text-muted-foreground">
                Отображается в списке писем рядом с темой
              </div>
            </div>
          )}

          {textPlaceholders.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Icon name="Type" className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-medium">Текстовые поля</h3>
                <Badge variant="secondary">{textPlaceholders.length}</Badge>
              </div>
              {textPlaceholders.map((placeholder, index) => (
                <div key={index} className="space-y-2">
                  <Label htmlFor={placeholder.name} className="text-sm">
                    {placeholder.name}
                    {placeholder.selectorHint && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        ({placeholder.selectorHint})
                      </span>
                    )}
                  </Label>
                  {placeholder.name === 'title' || placeholder.name.includes('title') ? (
                    <Input
                      id={placeholder.name}
                      placeholder={`Введите ${placeholder.name}`}
                      value={getValue(placeholder.name)}
                      onChange={(e) => setValue(placeholder.name, e.target.value)}
                    />
                  ) : placeholder.name.includes('text') && placeholder.name.includes('cta') ? (
                    <Input
                      id={placeholder.name}
                      placeholder="Текст кнопки"
                      value={getValue(placeholder.name)}
                      onChange={(e) => setValue(placeholder.name, e.target.value)}
                    />
                  ) : (
                    <Textarea
                      id={placeholder.name}
                      placeholder={`Введите ${placeholder.name}`}
                      value={getValue(placeholder.name)}
                      onChange={(e) => setValue(placeholder.name, e.target.value)}
                      rows={2}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {urlPlaceholders.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Icon name="Link" className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-medium">Ссылки</h3>
                <Badge variant="secondary">{urlPlaceholders.length}</Badge>
              </div>
              {urlPlaceholders.map((placeholder, index) => (
                <div key={index} className="space-y-2">
                  <Label htmlFor={placeholder.name} className="text-sm">
                    {placeholder.name}
                  </Label>
                  <Input
                    id={placeholder.name}
                    type="url"
                    placeholder="https://example.com"
                    value={getValue(placeholder.name)}
                    onChange={(e) => setValue(placeholder.name, e.target.value)}
                  />
                </div>
              ))}
            </div>
          )}

          {blockPlaceholders.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Icon name="Boxes" className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-medium">Блоки (показать/скрыть)</h3>
                <Badge variant="secondary">{blockPlaceholders.length}</Badge>
              </div>
              {blockPlaceholders.map((placeholder, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <Label htmlFor={`block-${placeholder.name}`} className="cursor-pointer">
                    {placeholder.name}
                    {placeholder.selectorHint && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        ({placeholder.selectorHint})
                      </span>
                    )}
                  </Label>
                  <Switch
                    id={`block-${placeholder.name}`}
                    checked={getBlockValue(placeholder.name)}
                    onCheckedChange={(checked) => setBlockValue(placeholder.name, checked)}
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={onBack}>
          <Icon name="ArrowLeft" className="mr-2 h-4 w-4" />
          Назад
        </Button>
        <Button onClick={handleSubmit} disabled={loading} size="lg">
          {loading ? (
            <>
              <Icon name="Loader2" className="mr-2 h-4 w-4 animate-spin" />
              Рендеринг...
            </>
          ) : (
            <>
              Создать письмо
              <Icon name="Mail" className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
