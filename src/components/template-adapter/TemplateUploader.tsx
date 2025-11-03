import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import Icon from '@/components/ui/icon';
import { cn } from '@/lib/utils';

interface TemplateUploaderProps {
  onAdapt: (html: string, options: any) => void;
  loading: boolean;
}

export function TemplateUploader({ onAdapt, loading }: TemplateUploaderProps) {
  const [html, setHtml] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [options, setOptions] = useState({
    ctaStrategy: 'top_bottom',
    preheaderFallback: true,
    preserveComments: false
  });

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = e.dataTransfer.files;
    if (files && files[0]) {
      handleFile(files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      handleFile(files[0]);
    }
  };

  const handleFile = (file: File) => {
    if (!file.name.endsWith('.html') && !file.name.endsWith('.htm')) {
      alert('Пожалуйста, загрузите HTML файл');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setHtml(content);
    };
    reader.readAsText(file);
  };

  const handleSubmit = () => {
    if (!html.trim()) {
      alert('Пожалуйста, загрузите или вставьте HTML код');
      return;
    }
    onAdapt(html, options);
  };

  return (
    <div className="space-y-6">
      <div
        className={cn(
          'border-2 border-dashed rounded-lg p-8 text-center transition-colors',
          dragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25',
          'hover:border-primary/50'
        )}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <Icon name="Upload" className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <div className="text-lg font-medium mb-2">
          Перетащите HTML файл сюда
        </div>
        <div className="text-sm text-muted-foreground mb-4">
          или
        </div>
        <input
          type="file"
          id="file-upload"
          className="hidden"
          accept=".html,.htm"
          onChange={handleFileInput}
        />
        <label htmlFor="file-upload">
          <Button variant="outline" asChild>
            <span>
              <Icon name="FolderOpen" className="mr-2 h-4 w-4" />
              Выбрать файл
            </span>
          </Button>
        </label>
      </div>

      <div className="space-y-2">
        <Label htmlFor="html-input">Или вставьте HTML код:</Label>
        <Textarea
          id="html-input"
          placeholder="<!DOCTYPE html>&#10;<html>&#10;  <head>...</head>&#10;  <body>...</body>&#10;</html>"
          value={html}
          onChange={(e) => setHtml(e.target.value)}
          className="font-mono text-sm min-h-[200px]"
        />
      </div>

      <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
        <div className="font-medium">Настройки адаптации:</div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="cta-strategy">Стратегия CTA-кнопок</Label>
            <div className="text-sm text-muted-foreground">
              Как обрабатывать кнопки в шаблоне
            </div>
          </div>
          <select
            id="cta-strategy"
            value={options.ctaStrategy}
            onChange={(e) => setOptions({ ...options, ctaStrategy: e.target.value })}
            className="border rounded-md px-3 py-2 text-sm"
          >
            <option value="top_bottom">Первая и последняя</option>
            <option value="all">Все кнопки</option>
            <option value="auto">Первые 3</option>
          </select>
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="preheader-fallback">Добавить прехедер</Label>
            <div className="text-sm text-muted-foreground">
              Создать скрытый блок для прехедера, если его нет
            </div>
          </div>
          <Switch
            id="preheader-fallback"
            checked={options.preheaderFallback}
            onCheckedChange={(checked) => setOptions({ ...options, preheaderFallback: checked })}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="preserve-comments">Сохранить комментарии</Label>
            <div className="text-sm text-muted-foreground">
              Оставить HTML комментарии в коде
            </div>
          </div>
          <Switch
            id="preserve-comments"
            checked={options.preserveComments}
            onCheckedChange={(checked) => setOptions({ ...options, preserveComments: checked })}
          />
        </div>
      </div>

      <Button
        onClick={handleSubmit}
        disabled={!html.trim() || loading}
        className="w-full"
        size="lg"
      >
        {loading ? (
          <>
            <Icon name="Loader2" className="mr-2 h-4 w-4 animate-spin" />
            Обработка...
          </>
        ) : (
          <>
            <Icon name="Wand2" className="mr-2 h-4 w-4" />
            Адаптировать шаблон
          </>
        )}
      </Button>
    </div>
  );
}
