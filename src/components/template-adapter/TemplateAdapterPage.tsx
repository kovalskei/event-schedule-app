import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Icon from '@/components/ui/icon';
import { TemplateUploader } from './TemplateUploader';
import { AdaptedTemplateView } from './AdaptedTemplateView';
import { RenderForm } from './RenderForm';
import { EmailPreview } from './EmailPreview';

const TEMPLATE_ADAPTER_URL = 'https://functions.poehali.dev/9494e2f1-fffb-4efc-9a10-e7763291cd3a';

interface Placeholder {
  name: string;
  type: string;
  description: string;
  default?: string;
  required: boolean;
}

interface CTAButton {
  placeholder_url: string;
  placeholder_text: string;
  position: string;
  original_url: string;
  original_text: string;
}

interface ValidationIssue {
  severity: string;
  category: string;
  message: string;
  details?: any;
}

interface AdaptedTemplate {
  adapted_html: string;
  placeholders: Placeholder[];
  cta_buttons: CTAButton[];
  validation_issues: ValidationIssue[];
  stats: {
    total_placeholders: number;
    cta_count: number;
    text_placeholders: number;
    url_placeholders: number;
    image_placeholders: number;
  };
}

interface RenderResult {
  rendered_html: string;
  plain_text: string;
  validation_issues: ValidationIssue[];
  utm_applied: boolean;
}

export default function TemplateAdapterPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adaptedTemplate, setAdaptedTemplate] = useState<AdaptedTemplate | null>(null);
  const [renderResult, setRenderResult] = useState<RenderResult | null>(null);
  const [activeTab, setActiveTab] = useState('upload');

  const handleAdapt = async (html: string, options: any) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(TEMPLATE_ADAPTER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'adapt',
          html,
          options
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setAdaptedTemplate(data);
      setActiveTab('adapted');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleRender = async (renderData: any) => {
    if (!adaptedTemplate) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(TEMPLATE_ADAPTER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'render',
          template: adaptedTemplate.adapted_html,
          data: renderData.data,
          eventId: renderData.eventId
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setRenderResult(data);
      setActiveTab('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setAdaptedTemplate(null);
    setRenderResult(null);
    setError(null);
    setActiveTab('upload');
  };

  return (
    <div className="container mx-auto py-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Template AI Adapter</h1>
        <p className="text-muted-foreground">
          Загрузите HTML-шаблон письма и автоматически превратите его в шаблон с плейсхолдерами
        </p>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <Icon name="AlertCircle" className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="upload">
            <Icon name="Upload" className="mr-2 h-4 w-4" />
            Загрузка
          </TabsTrigger>
          <TabsTrigger value="adapted" disabled={!adaptedTemplate}>
            <Icon name="FileText" className="mr-2 h-4 w-4" />
            Шаблон
          </TabsTrigger>
          <TabsTrigger value="render" disabled={!adaptedTemplate}>
            <Icon name="Edit" className="mr-2 h-4 w-4" />
            Заполнение
          </TabsTrigger>
          <TabsTrigger value="preview" disabled={!renderResult}>
            <Icon name="Eye" className="mr-2 h-4 w-4" />
            Превью
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Загрузите HTML шаблон</CardTitle>
              <CardDescription>
                Поддерживаются файлы .html или вставьте HTML-код напрямую
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TemplateUploader onAdapt={handleAdapt} loading={loading} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="adapted" className="mt-6">
          {adaptedTemplate && (
            <AdaptedTemplateView
              template={adaptedTemplate}
              onNext={() => setActiveTab('render')}
              onReset={handleReset}
            />
          )}
        </TabsContent>

        <TabsContent value="render" className="mt-6">
          {adaptedTemplate && (
            <RenderForm
              template={adaptedTemplate}
              onRender={handleRender}
              loading={loading}
              onBack={() => setActiveTab('adapted')}
            />
          )}
        </TabsContent>

        <TabsContent value="preview" className="mt-6">
          {renderResult && (
            <EmailPreview
              html={renderResult.rendered_html}
              text={renderResult.plain_text}
              validation_issues={renderResult.validation_issues}
              utm_applied={renderResult.utm_applied}
              onBack={() => setActiveTab('render')}
              onReset={handleReset}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}