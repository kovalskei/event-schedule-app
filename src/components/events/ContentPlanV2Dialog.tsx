import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';

interface Event {
  id: number;
  name: string;
  program_doc_id: string;
  pain_doc_id: string;
}

interface MailingList {
  id: number;
  unisender_list_id: string;
  unisender_list_name: string;
}

interface ContentType {
  id: number;
  name: string;
  description: string;
}

interface Template {
  id: number;
  name: string;
  content_type_id: number;
}

interface ContentPlanV2DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: Event;
  mailingLists: MailingList[];
  contentTypes: ContentType[];
  onUpdate: () => void;
}

interface ContentPlanRow {
  theme: string;
  content_type: string;
}

const EVENTS_MANAGER_URL = 'https://functions.poehali.dev/b56e5895-fb22-4d96-b746-b046a9fd2750';
const GENERATE_EMAIL_URL = 'https://functions.poehali.dev/d2a2e722-c697-4c1e-a3c7-af2366b408af';

export default function ContentPlanV2Dialog({ open, onOpenChange, event, mailingLists, contentTypes, onUpdate }: ContentPlanV2DialogProps) {
  const [contentPlanUrl, setContentPlanUrl] = useState('');
  const [selectedListId, setSelectedListId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [generatingProgress, setGeneratingProgress] = useState<{current: number, total: number, status: string} | null>(null);
  const [preview, setPreview] = useState<ContentPlanRow[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);

  const extractDocId = (url: string): string | null => {
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : null;
  };

  const loadTemplates = async () => {
    try {
      const response = await fetch(`${EVENTS_MANAGER_URL}?action=get_templates&event_id=${event.id}`);
      const data = await response.json();
      if (response.ok && data.templates) {
        setTemplates(data.templates);
      }
    } catch (error) {
      console.error('[ContentPlanV2] Load templates error:', error);
    }
  };

  const handleLoadPreview = async () => {
    const docId = extractDocId(contentPlanUrl);
    if (!docId) {
      toast.error('Неверная ссылка на Google Sheets');
      return;
    }

    if (!selectedListId) {
      toast.error('Выберите список рассылки');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `${EVENTS_MANAGER_URL}?action=preview_content_plan&doc_id=${docId}`
      );
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Ошибка загрузки контент-плана');
      }

      setPreview(data.rows || []);
      setShowPreview(true);
      await loadTemplates();
      toast.success(`Загружено ${data.rows.length} тем из контент-плана`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Ошибка загрузки');
      console.error('[ContentPlanV2] Load error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateAll = async () => {
    if (preview.length === 0) {
      toast.error('Сначала загрузите контент-план');
      return;
    }

    setLoading(true);
    setGeneratingProgress({ current: 0, total: preview.length, status: 'Начинаем генерацию V2...' });
    
    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];
    
    try {
      for (let i = 0; i < preview.length; i++) {
        const item = preview[i];
        
        setGeneratingProgress({ 
          current: i, 
          total: preview.length, 
          status: `Генерируем V2: ${item.theme}` 
        });

        try {
          // Найти подходящий шаблон для типа контента
          const contentType = contentTypes.find(ct => ct.name === item.content_type);
          if (!contentType) {
            throw new Error(`Тип контента "${item.content_type}" не найден`);
          }

          const template = templates.find(t => t.content_type_id === contentType.id);
          if (!template) {
            throw new Error(`Шаблон для типа "${item.content_type}" не найден`);
          }

          // Генерируем через новый бэкенд /generate-email
          const generateResponse = await fetch(GENERATE_EMAIL_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              theme: item.theme,
              event_id: event.id,
              template_id: template.id
            })
          });

          const generateData = await generateResponse.json();
          
          if (!generateResponse.ok) {
            throw new Error(generateData.error || 'Ошибка генерации');
          }

          // Сохраняем сгенерированное письмо как черновик
          const saveResponse = await fetch(EVENTS_MANAGER_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'save_draft',
              event_list_id: parseInt(selectedListId),
              subject: item.theme,
              html_content: generateData.rendered_html,
              content_type_id: contentType.id,
              metadata: {
                ai_reasoning: generateData.ai_reasoning,
                selected_speakers: generateData.selected_speakers,
                generated_via: 'content_plan_v2'
              }
            })
          });

          const saveData = await saveResponse.json();
          
          if (!saveResponse.ok) {
            throw new Error(saveData.error || 'Ошибка сохранения');
          }

          successCount++;
          console.log(`[V2] Generated: ${item.theme}`, generateData.ai_reasoning);
          
        } catch (itemError) {
          errorCount++;
          const errorMsg = itemError instanceof Error ? itemError.message : 'Unknown error';
          errors.push(`${item.theme}: ${errorMsg}`);
          console.error(`[V2] Error generating ${item.theme}:`, itemError);
        }
        
        setGeneratingProgress({ 
          current: i + 1, 
          total: preview.length, 
          status: `Завершено: ${i + 1} из ${preview.length}` 
        });
      }

      setGeneratingProgress({ 
        current: preview.length, 
        total: preview.length, 
        status: 'Генерация V2 завершена!' 
      });
      
      setTimeout(() => {
        let message = `Создано: ${successCount}`;
        if (errorCount > 0) message += `, ошибок: ${errorCount}`;
        
        toast.success(message);
        if (errors.length > 0) {
          console.error('[V2] Errors:', errors);
        }
        
        onUpdate();
        onOpenChange(false);
        setContentPlanUrl('');
        setSelectedListId('');
        setPreview([]);
        setShowPreview(false);
        setGeneratingProgress(null);
      }, 1500);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Ошибка генерации V2');
      console.error('[ContentPlanV2] Generate error:', error);
      setGeneratingProgress(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon name="Sparkles" className="w-5 h-5 text-blue-600" />
            Контент-план V2 (с оригинальными шаблонами)
          </DialogTitle>
          <DialogDescription>
            Улучшенная генерация с учётом оригинального HTML-шаблона для каждого типа контента
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
            <div className="flex items-start gap-2">
              <Icon name="Info" className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-blue-900">
                <strong>V2:</strong> ИИ видит оригинальный дизайн шаблона и генерирует контент в том же стиле (длина текста, тон, эмодзи).
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Ссылка на Google Sheets с контент-планом</Label>
            <Input
              placeholder="https://docs.google.com/spreadsheets/d/..."
              value={contentPlanUrl}
              onChange={(e) => setContentPlanUrl(e.target.value)}
              disabled={loading}
            />
            <p className="text-xs text-gray-500">
              Таблица должна содержать колонки: "Заголовок" (тема письма) и "Тип контента"
            </p>
          </div>

          <div className="space-y-2">
            <Label>Список рассылки</Label>
            <Select value={selectedListId} onValueChange={setSelectedListId} disabled={loading}>
              <SelectTrigger>
                <SelectValue placeholder="Выберите список" />
              </SelectTrigger>
              <SelectContent>
                {mailingLists.map((list) => (
                  <SelectItem key={list.id} value={String(list.id)}>
                    {list.unisender_list_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button 
            onClick={handleLoadPreview} 
            disabled={loading || !contentPlanUrl || !selectedListId}
            className="w-full"
          >
            <Icon name="FileSearch" className="w-4 h-4 mr-2" />
            Загрузить контент-план
          </Button>

          {showPreview && preview.length > 0 && (
            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium flex items-center gap-2">
                  <Icon name="Eye" className="w-4 h-4" />
                  Предпросмотр ({preview.length} писем)
                </h4>
                <Badge variant="outline" className="border-blue-500 text-blue-600">
                  V2 Engine
                </Badge>
              </div>
              
              <div className="max-h-60 overflow-y-auto space-y-2">
                {preview.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm p-2 bg-gray-50 rounded">
                    <Badge variant="secondary" className="shrink-0">{idx + 1}</Badge>
                    <span className="flex-1 font-medium">{item.theme}</span>
                    <Badge variant="outline">{item.content_type}</Badge>
                  </div>
                ))}
              </div>

              <Button 
                onClick={handleGenerateAll} 
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                <Icon name="Wand2" className="w-4 h-4 mr-2" />
                Сгенерировать все письма (V2)
              </Button>
            </div>
          )}

          {generatingProgress && (
            <div className="border border-blue-200 rounded-lg p-4 bg-blue-50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-blue-900">
                  {generatingProgress.status}
                </span>
                <span className="text-sm text-blue-700">
                  {generatingProgress.current}/{generatingProgress.total}
                </span>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(generatingProgress.current / generatingProgress.total) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
