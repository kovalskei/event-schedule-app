import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import Icon from '@/components/ui/icon';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';

const TEMPLATE_ADAPTER_URL = 'https://functions.poehali.dev/9494e2f1-fffb-4efc-9a10-e7763291cd3a';

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

interface KnowledgeData {
  brand: Record<string, any>;
  defaults: Record<string, any>;
  event?: Record<string, any>;
  content?: Record<string, any>;
}

interface RenderFormProps {
  template: AdaptedTemplate;
  onRender: (data: { data: Record<string, any>, utm_params: Record<string, string>, eventId?: string }) => void;
  loading: boolean;
  onBack: () => void;
}

export function RenderForm({ template, onRender, loading, onBack }: RenderFormProps) {
  const [knowledge, setKnowledge] = useState<KnowledgeData | null>(null);
  const [loadingKnowledge, setLoadingKnowledge] = useState(false);
  const [eventId, setEventId] = useState('');
  
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

  const loadKnowledge = async (evtId?: string) => {
    setLoadingKnowledge(true);
    try {
      const response = await fetch(TEMPLATE_ADAPTER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'knowledge',
          eventId: evtId || eventId
        })
      });

      if (response.ok) {
        const data = await response.json();
        setKnowledge(data);
        
        applyKnowledgeDefaults(data);
      }
    } catch (err) {
      console.error('Failed to load knowledge:', err);
    } finally {
      setLoadingKnowledge(false);
    }
  };

  const applyKnowledgeDefaults = (knowledgeData: KnowledgeData) => {
    const updates: Record<string, any> = {};
    
    if (knowledgeData.defaults?.preheader && !formData.preheader) {
      updates.preheader = knowledgeData.defaults.preheader;
    }
    
    if (knowledgeData.defaults?.cta_top_text && !formData.cta_top_text) {
      updates.cta_top_text = knowledgeData.defaults.cta_top_text;
    }
    
    if (knowledgeData.defaults?.cta_bottom_text && !formData.cta_bottom_text) {
      updates.cta_bottom_text = knowledgeData.defaults.cta_bottom_text;
    }
    
    if (knowledgeData.brand) {
      Object.keys(knowledgeData.brand).forEach(key => {
        const fullKey = `brand.${key}`;
        if (template.placeholders.some(p => p.name === fullKey) && !formData[fullKey]) {
          updates[fullKey] = knowledgeData.brand[key];
        }
      });
    }
    
    if (knowledgeData.content?.claims) {
      Object.keys(knowledgeData.content.claims).forEach(key => {
        if (template.placeholders.some(p => p.name === key) && !formData[key]) {
          updates[key] = knowledgeData.content.claims[key];
        }
      });
    }
    
    if (knowledgeData.event?.title && !formData.title) {
      updates.title = knowledgeData.event.title;
    }
    
    if (Object.keys(updates).length > 0) {
      setFormData(prev => ({ ...prev, ...updates }));
    }
    
    if (knowledgeData.defaults?.utm) {
      setUtmParams(prev => ({
        ...prev,
        ...knowledgeData.defaults.utm
      }));
    }
  };

  useEffect(() => {
    loadKnowledge();
  }, []);

  const handleSubmit = () => {
    onRender({
      data: formData,
      utm_params: utmParams,
      eventId: eventId || undefined
    });
  };

  const setValue = (name: string, value: any) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const isFieldFilled = (placeholder: Placeholder): boolean => {
    const value = formData[placeholder.name];
    if (placeholder.type === 'conditional') return true;
    return Boolean(value && String(value).trim());
  };

  const renderField = (placeholder: Placeholder, showFilled: boolean = false) => {
    const value = formData[placeholder.name];
    const filled = isFieldFilled(placeholder);

    if (showFilled !== filled) return null;

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
          <Label htmlFor={placeholder.name} className="flex items-center gap-2">
            {filled && <Icon name="CheckCircle2" className="h-4 w-4 text-green-600" />}
            {!filled && placeholder.required && <Icon name="AlertCircle" className="h-4 w-4 text-orange-600" />}
            {placeholder.description}
            {!placeholder.required && <span className="text-muted-foreground">(опционально)</span>}
          </Label>
          <Textarea
            id={placeholder.name}
            value={value || ''}
            onChange={(e) => setValue(placeholder.name, e.target.value)}
            rows={4}
            placeholder={placeholder.default || `Введите ${placeholder.description.toLowerCase()}`}
            required={placeholder.required}
            className={filled ? 'border-green-200' : ''}
          />
        </div>
      );
    }

    if (placeholder.type === 'url') {
      return (
        <div key={placeholder.name} className="space-y-2">
          <Label htmlFor={placeholder.name} className="flex items-center gap-2">
            {filled && <Icon name="CheckCircle2" className="h-4 w-4 text-green-600" />}
            {!filled && placeholder.required && <Icon name="AlertCircle" className="h-4 w-4 text-orange-600" />}
            {placeholder.description}
            {!placeholder.required && <span className="text-muted-foreground">(опционально)</span>}
          </Label>
          <Input
            id={placeholder.name}
            type="url"
            value={value || ''}
            onChange={(e) => setValue(placeholder.name, e.target.value)}
            placeholder={placeholder.default || 'https://example.com'}
            required={placeholder.required}
            className={filled ? 'border-green-200' : ''}
          />
        </div>
      );
    }

    return (
      <div key={placeholder.name} className="space-y-2">
        <Label htmlFor={placeholder.name} className="flex items-center gap-2">
          {filled && <Icon name="CheckCircle2" className="h-4 w-4 text-green-600" />}
          {!filled && placeholder.required && <Icon name="AlertCircle" className="h-4 w-4 text-orange-600" />}
          {placeholder.description}
          {!placeholder.required && <span className="text-muted-foreground">(опционально)</span>}
        </Label>
        <Input
          id={placeholder.name}
          type="text"
          value={value || ''}
          onChange={(e) => setValue(placeholder.name, e.target.value)}
          placeholder={placeholder.default || `Введите ${placeholder.description.toLowerCase()}`}
          required={placeholder.required}
          className={filled ? 'border-green-200' : ''}
        />
      </div>
    );
  };

  const unfilledRequired = template.placeholders.filter(p => p.required && !isFieldFilled(p));
  const filledFields = template.placeholders.filter(p => isFieldFilled(p) && p.type !== 'conditional');
  const unfilledFields = template.placeholders.filter(p => !isFieldFilled(p) && p.type !== 'conditional');
  const conditionalFields = template.placeholders.filter(p => p.type === 'conditional');
  const collectionFields = template.placeholders.filter(p => p.type === 'collection');

  return (
    <div className="space-y-6">
      {knowledge && (
        <Alert className="bg-blue-50 border-blue-200">
          <Icon name="Database" className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            Загружены данные из Knowledge Store: {filledFields.length} полей предзаполнены автоматически
          </AlertDescription>
        </Alert>
      )}

      {unfilledRequired.length > 0 && (
        <Alert variant="default" className="border-orange-200">
          <Icon name="AlertTriangle" className="h-4 w-4 text-orange-600" />
          <AlertDescription>
            Осталось заполнить обязательных полей: {unfilledRequired.length}
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Заполните данные</CardTitle>
          <CardDescription>
            {filledFields.length} из {template.placeholders.length - conditionalFields.length} полей заполнены
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 mb-6">
            <div className="flex gap-2">
              <Input
                placeholder="Event ID (optional)"
                value={eventId}
                onChange={(e) => setEventId(e.target.value)}
              />
              <Button
                onClick={() => loadKnowledge(eventId)}
                disabled={loadingKnowledge}
                variant="outline"
              >
                {loadingKnowledge ? (
                  <Icon name="Loader2" className="h-4 w-4 animate-spin" />
                ) : (
                  <Icon name="RefreshCw" className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          <ScrollArea className="h-[600px] pr-4">
            <div className="space-y-6">
              {unfilledFields.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Icon name="AlertCircle" className="h-5 w-5 text-orange-600" />
                    <h3 className="font-semibold">Требуют заполнения</h3>
                    <Badge variant="destructive">{unfilledFields.length}</Badge>
                  </div>
                  <div className="space-y-4">
                    {unfilledFields.map(p => renderField(p, false))}
                  </div>
                </div>
              )}

              {filledFields.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Icon name="CheckCircle2" className="h-5 w-5 text-green-600" />
                    <h3 className="font-semibold">Заполнено</h3>
                    <Badge variant="secondary">{filledFields.length}</Badge>
                  </div>
                  <div className="space-y-4">
                    {filledFields.map(p => renderField(p, true))}
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
                    {conditionalFields.map(p => renderField(p))}
                  </div>
                </div>
              )}

              {collectionFields.length > 0 && (
                <Alert>
                  <Icon name="Users" className="h-4 w-4" />
                  <AlertDescription>
                    Обнаружены коллекции: {collectionFields.map(p => p.name).join(', ')}. 
                    Данные будут загружены из Knowledge Store автоматически.
                  </AlertDescription>
                </Alert>
              )}

              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Icon name="BarChart" className="h-5 w-5" />
                  <h3 className="font-semibold">UTM метки</h3>
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
                      placeholder="event-name"
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
        <Button onClick={handleSubmit} disabled={loading || unfilledRequired.length > 0}>
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
