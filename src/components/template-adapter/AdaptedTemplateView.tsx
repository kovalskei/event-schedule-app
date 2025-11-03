import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import Icon from '@/components/ui/icon';
import { ScrollArea } from '@/components/ui/scroll-area';

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

interface AdaptedTemplateViewProps {
  template: AdaptedTemplate;
  onNext: () => void;
  onReset: () => void;
}

export function AdaptedTemplateView({ template, onNext, onReset }: AdaptedTemplateViewProps) {
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'text': return 'Type';
      case 'url': return 'Link';
      case 'image': return 'Image';
      case 'conditional': return 'ToggleRight';
      default: return 'Circle';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'text': return 'bg-blue-500/10 text-blue-700 border-blue-200';
      case 'url': return 'bg-green-500/10 text-green-700 border-green-200';
      case 'image': return 'bg-orange-500/10 text-orange-700 border-orange-200';
      case 'conditional': return 'bg-purple-500/10 text-purple-700 border-purple-200';
      default: return 'bg-gray-500/10 text-gray-700 border-gray-200';
    }
  };

  const warnings = template.validation_issues.filter(i => i.severity === 'warning');
  const errors = template.validation_issues.filter(i => i.severity === 'error');

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Результаты адаптации</CardTitle>
          <CardDescription>
            Шаблон успешно обработан и готов к заполнению данными
          </CardDescription>
        </CardHeader>
        <CardContent>
          {warnings.length > 0 && (
            <Alert className="mb-4">
              <Icon name="AlertTriangle" className="h-4 w-4" />
              <AlertDescription>
                <div className="font-semibold mb-1">Предупреждения ({warnings.length})</div>
                {warnings.slice(0, 3).map((w, i) => (
                  <div key={i} className="text-sm">{w.message}</div>
                ))}
              </AlertDescription>
            </Alert>
          )}

          {errors.length > 0 && (
            <Alert variant="destructive" className="mb-4">
              <Icon name="AlertCircle" className="h-4 w-4" />
              <AlertDescription>
                <div className="font-semibold mb-1">Ошибки ({errors.length})</div>
                {errors.slice(0, 3).map((e, i) => (
                  <div key={i} className="text-sm">{e.message}</div>
                ))}
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="flex items-center space-x-3 p-4 bg-muted/50 rounded-lg">
              <Icon name="Hash" className="h-8 w-8 text-primary" />
              <div>
                <div className="text-2xl font-bold">{template.stats.total_placeholders}</div>
                <div className="text-sm text-muted-foreground">Всего полей</div>
              </div>
            </div>

            <div className="flex items-center space-x-3 p-4 bg-muted/50 rounded-lg">
              <Icon name="MousePointerClick" className="h-8 w-8 text-primary" />
              <div>
                <div className="text-2xl font-bold">{template.stats.cta_count}</div>
                <div className="text-sm text-muted-foreground">CTA кнопок</div>
              </div>
            </div>

            <div className="flex items-center space-x-3 p-4 bg-muted/50 rounded-lg">
              <Icon name="Type" className="h-8 w-8 text-primary" />
              <div>
                <div className="text-2xl font-bold">{template.stats.text_placeholders}</div>
                <div className="text-sm text-muted-foreground">Текстовых</div>
              </div>
            </div>

            <div className="flex items-center space-x-3 p-4 bg-muted/50 rounded-lg">
              <Icon name="Link" className="h-8 w-8 text-primary" />
              <div>
                <div className="text-2xl font-bold">{template.stats.url_placeholders}</div>
                <div className="text-sm text-muted-foreground">Ссылок</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Плейсхолдеры</CardTitle>
            <CardDescription>Поля для заполнения в шаблоне</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-3">
                {template.placeholders.map((placeholder, idx) => (
                  <div key={idx} className="flex items-start justify-between p-3 border rounded-lg">
                    <div className="flex items-start space-x-3">
                      <Icon name={getTypeIcon(placeholder.type)} className="h-5 w-5 mt-0.5 text-muted-foreground" />
                      <div>
                        <div className="font-mono text-sm font-semibold">{placeholder.name}</div>
                        <div className="text-sm text-muted-foreground">{placeholder.description}</div>
                        {placeholder.default && (
                          <div className="text-xs text-muted-foreground mt-1">
                            Default: {placeholder.default}
                          </div>
                        )}
                      </div>
                    </div>
                    <Badge variant="outline" className={getTypeColor(placeholder.type)}>
                      {placeholder.type}
                    </Badge>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {template.cta_buttons.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>CTA Кнопки</CardTitle>
              <CardDescription>Обнаруженные призывы к действию</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-4">
                  {template.cta_buttons.map((cta, idx) => (
                    <div key={idx} className="border rounded-lg p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <Badge variant="secondary">Позиция: {cta.position}</Badge>
                      </div>
                      <div className="space-y-1">
                        <div className="text-sm">
                          <span className="font-semibold">Текст:</span>{' '}
                          <code className="text-xs bg-muted px-1 py-0.5 rounded">{cta.placeholder_text}</code>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Оригинал: "{cta.original_text}"
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-sm">
                          <span className="font-semibold">URL:</span>{' '}
                          <code className="text-xs bg-muted px-1 py-0.5 rounded">{cta.placeholder_url}</code>
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          Оригинал: {cta.original_url}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Адаптированный HTML</CardTitle>
          <CardDescription>Шаблон с плейсхолдерами {`{{...}}`}</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[300px]">
            <pre className="text-xs bg-muted p-4 rounded-lg overflow-x-auto">
              <code>{template.adapted_html}</code>
            </pre>
          </ScrollArea>
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button onClick={onReset} variant="outline">
          <Icon name="RotateCcw" className="mr-2 h-4 w-4" />
          Начать заново
        </Button>
        <Button onClick={onNext}>
          Заполнить данные
          <Icon name="ArrowRight" className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
