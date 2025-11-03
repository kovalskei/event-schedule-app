import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import { ScrollArea } from '@/components/ui/scroll-area';

interface AdaptedTemplate {
  originalHtml: string;
  html: string;
  placeholders: Array<{
    name: string;
    type: string;
    selectorHint?: string;
  }>;
  meta: {
    suggestedSubjects: string[];
    supportsPreheader: boolean;
    detectedCtas: Array<{
      textPlaceholder: string;
      urlPlaceholder: string;
      originalText: string;
      originalHref: string;
    }>;
    detectedFooter: boolean;
    hasBlocks: string[];
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
      case 'block': return 'Box';
      case 'image': return 'Image';
      default: return 'Circle';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'text': return 'bg-blue-500/10 text-blue-700 border-blue-200';
      case 'url': return 'bg-green-500/10 text-green-700 border-green-200';
      case 'block': return 'bg-purple-500/10 text-purple-700 border-purple-200';
      case 'image': return 'bg-orange-500/10 text-orange-700 border-orange-200';
      default: return 'bg-gray-500/10 text-gray-700 border-gray-200';
    }
  };

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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center space-x-3 p-4 bg-muted/50 rounded-lg">
              <Icon name="Hash" className="h-8 w-8 text-primary" />
              <div>
                <div className="text-2xl font-bold">{template.placeholders.length}</div>
                <div className="text-sm text-muted-foreground">Плейсхолдеров</div>
              </div>
            </div>

            <div className="flex items-center space-x-3 p-4 bg-muted/50 rounded-lg">
              <Icon name="MousePointerClick" className="h-8 w-8 text-primary" />
              <div>
                <div className="text-2xl font-bold">{template.meta.detectedCtas.length}</div>
                <div className="text-sm text-muted-foreground">CTA кнопок</div>
              </div>
            </div>

            <div className="flex items-center space-x-3 p-4 bg-muted/50 rounded-lg">
              <Icon name="Boxes" className="h-8 w-8 text-primary" />
              <div>
                <div className="text-2xl font-bold">{template.meta.hasBlocks.length}</div>
                <div className="text-sm text-muted-foreground">Блоков</div>
              </div>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {template.meta.supportsPreheader && (
              <div className="flex items-center space-x-2 text-sm">
                <Icon name="CheckCircle2" className="h-4 w-4 text-green-600" />
                <span>Прехедер поддерживается</span>
              </div>
            )}
            {template.meta.detectedFooter && (
              <div className="flex items-center space-x-2 text-sm">
                <Icon name="CheckCircle2" className="h-4 w-4 text-green-600" />
                <span>Футер обнаружен</span>
              </div>
            )}
            {template.meta.hasBlocks.length > 0 && (
              <div className="flex items-center space-x-2 text-sm">
                <Icon name="CheckCircle2" className="h-4 w-4 text-green-600" />
                <span>Блоки: {template.meta.hasBlocks.join(', ')}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Обнаруженные плейсхолдеры</CardTitle>
          <CardDescription>
            Переменные, которые будут заполнены данными
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {template.placeholders.map((placeholder, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <Icon name={getTypeIcon(placeholder.type)} className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="font-mono text-sm font-medium">
                      {`{{${placeholder.name}}}`}
                    </div>
                    {placeholder.selectorHint && (
                      <div className="text-xs text-muted-foreground">
                        {placeholder.selectorHint}
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
        </CardContent>
      </Card>

      {template.meta.detectedCtas.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>CTA Кнопки</CardTitle>
            <CardDescription>
              Обнаруженные кнопки призыва к действию
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {template.meta.detectedCtas.map((cta, index) => (
                <div key={index} className="p-4 border rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">CTA #{index + 1}</span>
                    <Badge variant="secondary">Button</Badge>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex items-start space-x-2">
                      <span className="text-muted-foreground min-w-[80px]">Текст:</span>
                      <span className="font-mono">{`{{${cta.textPlaceholder}}}`}</span>
                      <span className="text-muted-foreground">←</span>
                      <span className="text-muted-foreground">{cta.originalText}</span>
                    </div>
                    <div className="flex items-start space-x-2">
                      <span className="text-muted-foreground min-w-[80px]">URL:</span>
                      <span className="font-mono">{`{{${cta.urlPlaceholder}}}`}</span>
                      <span className="text-muted-foreground">←</span>
                      <span className="text-muted-foreground truncate">{cta.originalHref}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Адаптированный HTML</CardTitle>
          <CardDescription>
            Шаблон с плейсхолдерами вместо оригинального контента
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px] w-full rounded-md border">
            <pre className="p-4 text-xs font-mono">
              {template.html}
            </pre>
          </ScrollArea>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={onReset}>
          <Icon name="RotateCcw" className="mr-2 h-4 w-4" />
          Начать заново
        </Button>
        <Button onClick={onNext} size="lg">
          Заполнить данными
          <Icon name="ArrowRight" className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
