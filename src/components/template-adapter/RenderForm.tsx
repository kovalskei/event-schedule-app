import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import Icon from '@/components/ui/icon';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Placeholder {
  name: string;
  type: string;
  description: string;
  default?: string;
  required: boolean;
}

interface AdaptedTemplate {
  placeholders: Placeholder[];
}

interface RenderFormProps {
  template: AdaptedTemplate;
  onRender: (data: { data: Record<string, any>, utm_params: Record<string, string> }) => void;
  loading: boolean;
  onBack: () => void;
}

export function RenderForm({ template, onRender, loading, onBack }: RenderFormProps) {
  const [formData, setFormData] = useState<Record<string, any>>(() => {
    const initial: Record<string, any> = {};
    template.placeholders.forEach(p => {
      initial[p.name] = p.default || (p.type === 'conditional' ? true : '');
    });
    return initial;
  });

  const [utmParams, setUtmParams] = useState({
    utm_source: 'newsletter',
    utm_medium: 'email',
    utm_campaign: ''
  });

  const handleSubmit = () => {
    onRender({
      data: formData,
      utm_params: utmParams
    });
  };

  const setValue = (name: string, value: any) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const renderField = (placeholder: Placeholder) => {
    const value = formData[placeholder.name];

    if (placeholder.type === 'conditional') {
      return (
        <div key={placeholder.name} className="flex items-center justify-between p-3 border rounded-lg">
          <div className="space-y-0.5">
            <Label htmlFor={placeholder.name}>{placeholder.description}</Label>
            <div className="text-xs text-muted-foreground">
              Блок будет {value ? 'показан' : 'скрыт'}
            </div>
          </div>
          <Switch
            id={placeholder.name}
            checked={value}
            onCheckedChange={(checked) => setValue(placeholder.name, checked)}
          />
        </div>
      );
    }

    if (placeholder.name.includes('description') || placeholder.name.includes('content')) {
      return (
        <div key={placeholder.name} className="space-y-2">
          <Label htmlFor={placeholder.name}>
            {placeholder.description}
            {!placeholder.required && <span className="text-muted-foreground ml-1">(опционально)</span>}
          </Label>
          <Textarea
            id={placeholder.name}
            value={value}
            onChange={(e) => setValue(placeholder.name, e.target.value)}
            rows={4}
            placeholder={placeholder.default || `Введите ${placeholder.description.toLowerCase()}`}
            required={placeholder.required}
          />
        </div>
      );
    }

    if (placeholder.type === 'url') {
      return (
        <div key={placeholder.name} className="space-y-2">
          <Label htmlFor={placeholder.name}>
            {placeholder.description}
            {!placeholder.required && <span className="text-muted-foreground ml-1">(опционально)</span>}
          </Label>
          <Input
            id={placeholder.name}
            type="url"
            value={value}
            onChange={(e) => setValue(placeholder.name, e.target.value)}
            placeholder={placeholder.default || 'https://example.com'}
            required={placeholder.required}
          />
        </div>
      );
    }

    return (
      <div key={placeholder.name} className="space-y-2">
        <Label htmlFor={placeholder.name}>
          {placeholder.description}
          {!placeholder.required && <span className="text-muted-foreground ml-1">(опционально)</span>}
        </Label>
        <Input
          id={placeholder.name}
          type="text"
          value={value}
          onChange={(e) => setValue(placeholder.name, e.target.value)}
          placeholder={placeholder.default || `Введите ${placeholder.description.toLowerCase()}`}
          required={placeholder.required}
        />
      </div>
    );
  };

  const textFields = template.placeholders.filter(p => p.type === 'text');
  const urlFields = template.placeholders.filter(p => p.type === 'url');
  const imageFields = template.placeholders.filter(p => p.type === 'image');
  const conditionalFields = template.placeholders.filter(p => p.type === 'conditional');

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Заполните данные</CardTitle>
          <CardDescription>
            Введите контент для всех плейсхолдеров в шаблоне
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px] pr-4">
            <div className="space-y-6">
              {textFields.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Icon name="Type" className="h-5 w-5" />
                    <h3 className="font-semibold">Текстовые поля</h3>
                    <Badge variant="secondary">{textFields.length}</Badge>
                  </div>
                  <div className="space-y-4">
                    {textFields.map(renderField)}
                  </div>
                </div>
              )}

              {urlFields.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Icon name="Link" className="h-5 w-5" />
                    <h3 className="font-semibold">Ссылки</h3>
                    <Badge variant="secondary">{urlFields.length}</Badge>
                  </div>
                  <div className="space-y-4">
                    {urlFields.map(renderField)}
                  </div>
                </div>
              )}

              {imageFields.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Icon name="Image" className="h-5 w-5" />
                    <h3 className="font-semibold">Изображения</h3>
                    <Badge variant="secondary">{imageFields.length}</Badge>
                  </div>
                  <div className="space-y-4">
                    {imageFields.map(renderField)}
                  </div>
                </div>
              )}

              {conditionalFields.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Icon name="ToggleRight" className="h-5 w-5" />
                    <h3 className="font-semibold">Показать/Скрыть блоки</h3>
                    <Badge variant="secondary">{conditionalFields.length}</Badge>
                  </div>
                  <div className="space-y-3">
                    {conditionalFields.map(renderField)}
                  </div>
                </div>
              )}

              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Icon name="BarChart" className="h-5 w-5" />
                  <h3 className="font-semibold">UTM метки</h3>
                  <Badge variant="secondary">Опционально</Badge>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="utm_source">UTM Source</Label>
                    <Input
                      id="utm_source"
                      value={utmParams.utm_source}
                      onChange={(e) => setUtmParams(prev => ({ ...prev, utm_source: e.target.value }))}
                      placeholder="newsletter"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="utm_medium">UTM Medium</Label>
                    <Input
                      id="utm_medium"
                      value={utmParams.utm_medium}
                      onChange={(e) => setUtmParams(prev => ({ ...prev, utm_medium: e.target.value }))}
                      placeholder="email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="utm_campaign">UTM Campaign</Label>
                    <Input
                      id="utm_campaign"
                      value={utmParams.utm_campaign}
                      onChange={(e) => setUtmParams(prev => ({ ...prev, utm_campaign: e.target.value }))}
                      placeholder="summer-sale"
                    />
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button onClick={onBack} variant="outline" disabled={loading}>
          <Icon name="ArrowLeft" className="mr-2 h-4 w-4" />
          Назад
        </Button>
        <Button onClick={handleSubmit} disabled={loading}>
          {loading ? (
            <>
              <Icon name="Loader2" className="mr-2 h-4 w-4 animate-spin" />
              Генерация...
            </>
          ) : (
            <>
              Сгенерировать письмо
              <Icon name="ArrowRight" className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
