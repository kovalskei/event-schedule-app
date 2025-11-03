import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import Icon from '@/components/ui/icon';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ValidationIssue {
  severity: string;
  category: string;
  message: string;
}

interface EmailPreviewProps {
  html: string;
  text: string;
  onBack: () => void;
  onReset: () => void;
  validation_issues?: ValidationIssue[];
  utm_applied?: boolean;
}

export function EmailPreview({ html, text, onBack, onReset, validation_issues = [], utm_applied = false }: EmailPreviewProps) {
  const [copied, setCopied] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [showZones, setShowZones] = useState(false);

  const highlightedHtml = showZones ? html.replace(
    /<div[^>]*display:none[^>]*>([^<]*)<\/div>/gi,
    '<div style="background:rgba(255,200,0,0.3);padding:8px;border:2px dashed orange;margin:4px;"><strong style="color:orange;">📧 PREHEADER:</strong> $1</div>'
  ).replace(
    /<a([^>]*)(background|btn|button|cta)[^>]*>([^<]*)<\/a>/gi,
    '<a$1 style="outline:3px solid #00ff00;outline-offset:2px;">🎯 $3</a>'
  ) : html;

  const handleCopyHtml = () => {
    navigator.clipboard.writeText(html);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadHtml = () => {
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `email-${Date.now()}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 2000);
  };

  const handleDownloadText = () => {
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `email-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 2000);
  };

  return (
    <div className="space-y-6">
      {copied && (
        <Alert className="bg-green-50 border-green-200">
          <Icon name="CheckCircle2" className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            Скопировано в буфер обмена!
          </AlertDescription>
        </Alert>
      )}

      {downloadSuccess && (
        <Alert className="bg-blue-50 border-blue-200">
          <Icon name="Download" className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            Файл успешно загружен!
          </AlertDescription>
        </Alert>
      )}

      {validation_issues.length > 0 && (
        <Alert variant={validation_issues.some(i => i.severity === 'error') ? 'destructive' : 'default'}>
          <Icon name="AlertTriangle" className="h-4 w-4" />
          <AlertDescription>
            <div className="font-semibold mb-1">
              Обнаружено предупреждений: {validation_issues.length}
            </div>
            {validation_issues.slice(0, 3).map((issue, i) => (
              <div key={i} className="text-sm">
                [{issue.category}] {issue.message}
              </div>
            ))}
          </AlertDescription>
        </Alert>
      )}

      {utm_applied && (
        <Alert className="bg-blue-50 border-blue-200">
          <Icon name="Link" className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            UTM-метки успешно добавлены ко всем ссылкам
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Готовое письмо</CardTitle>
          <CardDescription>
            Письмо успешно создано и готово к отправке
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="preview" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="preview">
                <Icon name="Monitor" className="mr-2 h-4 w-4" />
                Превью
              </TabsTrigger>
              <TabsTrigger value="html">
                <Icon name="Code" className="mr-2 h-4 w-4" />
                HTML
              </TabsTrigger>
              <TabsTrigger value="text">
                <Icon name="FileText" className="mr-2 h-4 w-4" />
                Text
              </TabsTrigger>
            </TabsList>

            <TabsContent value="preview" className="mt-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground">
                      Так письмо будет выглядеть в почтовом клиенте
                    </span>
                    <Button
                      variant={showZones ? "default" : "outline"}
                      size="sm"
                      onClick={() => setShowZones(!showZones)}
                    >
                      <Icon name={showZones ? "EyeOff" : "Eye"} className="mr-2 h-4 w-4" />
                      {showZones ? 'Скрыть зоны' : 'Показать зоны'}
                    </Button>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const win = window.open('', '_blank');
                      if (win) {
                        win.document.write(html);
                        win.document.close();
                      }
                    }}
                  >
                    <Icon name="ExternalLink" className="mr-2 h-4 w-4" />
                    Открыть в новой вкладке
                  </Button>
                </div>

                <div className="border rounded-lg overflow-hidden bg-white">
                  <iframe
                    srcDoc={highlightedHtml}
                    className="w-full h-[600px]"
                    title="Email Preview"
                    sandbox="allow-same-origin"
                  />
                </div>
                {showZones && (
                  <Alert className="bg-yellow-50 border-yellow-200">
                    <Icon name="Lightbulb" className="h-4 w-4 text-yellow-600" />
                    <AlertDescription className="text-yellow-800">
                      <strong>Подсвечены зоны:</strong> 📧 Preheader (скрытый текст), 🎯 CTA кнопки
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </TabsContent>

            <TabsContent value="html" className="mt-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    HTML код письма
                  </span>
                  <div className="flex items-center space-x-2">
                    <Button variant="outline" size="sm" onClick={handleCopyHtml}>
                      <Icon name="Copy" className="mr-2 h-4 w-4" />
                      Копировать
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleDownloadHtml}>
                      <Icon name="Download" className="mr-2 h-4 w-4" />
                      Скачать
                    </Button>
                  </div>
                </div>

                <ScrollArea className="h-[600px] w-full rounded-md border bg-muted/50">
                  <pre className="p-4 text-xs font-mono">
                    {html}
                  </pre>
                </ScrollArea>
              </div>
            </TabsContent>

            <TabsContent value="text" className="mt-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Текстовая версия письма (для почтовых клиентов без HTML)
                  </span>
                  <div className="flex items-center space-x-2">
                    <Button variant="outline" size="sm" onClick={handleCopyText}>
                      <Icon name="Copy" className="mr-2 h-4 w-4" />
                      Копировать
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleDownloadText}>
                      <Icon name="Download" className="mr-2 h-4 w-4" />
                      Скачать
                    </Button>
                  </div>
                </div>

                <ScrollArea className="h-[600px] w-full rounded-md border bg-muted/50">
                  <pre className="p-4 text-sm whitespace-pre-wrap font-sans">
                    {text}
                  </pre>
                </ScrollArea>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Что дальше?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start space-x-3">
            <Icon name="Mail" className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <div className="font-medium">Отправка через UniSender</div>
              <div className="text-sm text-muted-foreground">
                Скопируйте HTML код и создайте письмо в UniSender
              </div>
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <Icon name="Save" className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <div className="font-medium">Сохранить как шаблон</div>
              <div className="text-sm text-muted-foreground">
                Используйте адаптированный шаблон для будущих кампаний
              </div>
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <Icon name="TestTube" className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <div className="font-medium">Тестовая отправка</div>
              <div className="text-sm text-muted-foreground">
                Отправьте письмо себе для проверки отображения
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={onBack}>
          <Icon name="ArrowLeft" className="mr-2 h-4 w-4" />
          Изменить данные
        </Button>
        <Button variant="outline" onClick={onReset}>
          <Icon name="RotateCcw" className="mr-2 h-4 w-4" />
          Создать новое письмо
        </Button>
      </div>
    </div>
  );
}