import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';

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

interface ContentPlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: Event;
  mailingLists: MailingList[];
  contentTypes: ContentType[];
  onUpdate: () => void;
}

interface ContentPlanRow {
  title: string;
  content_type: string;
}

export default function ContentPlanDialog({ open, onOpenChange, event, mailingLists, contentTypes, onUpdate }: ContentPlanDialogProps) {
  const [contentPlanUrl, setContentPlanUrl] = useState('');
  const [selectedListId, setSelectedListId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<ContentPlanRow[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  const extractDocId = (url: string): string | null => {
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : null;
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
        `https://functions.poehali.dev/b56e5895-fb22-4d96-b746-b046a9fd2750?action=preview_content_plan&doc_id=${docId}`
      );
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Ошибка загрузки контент-плана');
      }

      setPreview(data.rows || []);
      setShowPreview(true);
      toast.success(`Загружено ${data.rows.length} писем из контент-плана`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Ошибка загрузки');
      console.error('[ContentPlan] Load error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMissingTypes = async (missingTypes: string[]) => {
    setLoading(true);
    try {
      const response = await fetch('https://functions.poehali.dev/b56e5895-fb22-4d96-b746-b046a9fd2750', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_content_types',
          event_id: event.id,
          type_names: missingTypes
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Ошибка создания типов контента');
      }

      toast.success(`Создано типов контента: ${data.created_count}`);
      onUpdate();
      
      // Теперь запускаем генерацию
      await handleGenerateAll();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Ошибка создания типов');
      console.error('[ContentPlan] Create types error:', error);
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
    try {
      const docId = extractDocId(contentPlanUrl);
      const response = await fetch('https://functions.poehali.dev/b56e5895-fb22-4d96-b746-b046a9fd2750', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate_from_content_plan',
          event_id: event.id,
          event_list_id: parseInt(selectedListId),
          content_plan_doc_id: docId
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        if (data.error === 'missing_content_types' && data.missing_types && data.missing_types.length > 0) {
          const missingList = data.missing_types.join(', ');
          toast(
            <div className="space-y-3">
              <div>
                <div className="font-medium mb-1">Отсутствуют типы контента</div>
                <div className="text-sm text-gray-600">Не найдены: {missingList}</div>
              </div>
              <Button 
                size="sm" 
                onClick={() => {
                  toast.dismiss();
                  handleCreateMissingTypes(data.missing_types);
                }}
                className="w-full"
              >
                <Icon name="Plus" className="w-3 h-3 mr-1" />
                Создать и продолжить генерацию
              </Button>
            </div>,
            { duration: 10000 }
          );
          setLoading(false);
          return;
        }
        throw new Error(data.message || data.error || 'Ошибка генерации писем');
      }

      toast.success(`Сгенерировано ${data.generated_count} писем!`);
      onUpdate();
      onOpenChange(false);
      setContentPlanUrl('');
      setSelectedListId('');
      setPreview([]);
      setShowPreview(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Ошибка генерации');
      console.error('[ContentPlan] Generate error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Контент-план для массовой генерации</DialogTitle>
          <DialogDescription>
            Добавьте Google Sheets с заголовками и типами контента для автоматической генерации писем
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label>Ссылка на Google Sheets с контент-планом</Label>
            <Input
              placeholder="https://docs.google.com/spreadsheets/d/..."
              value={contentPlanUrl}
              onChange={(e) => setContentPlanUrl(e.target.value)}
              disabled={loading}
            />
            <p className="text-xs text-gray-500">
              Таблица должна содержать колонки: "Заголовок" и "Тип контента"
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
                  <SelectItem key={list.id} value={list.id.toString()}>
                    {list.unisender_list_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!showPreview && (
            <Button 
              onClick={handleLoadPreview} 
              disabled={loading || !contentPlanUrl || !selectedListId}
              className="w-full"
            >
              <Icon name="Eye" className="w-4 h-4 mr-2" />
              {loading ? 'Загрузка...' : 'Предпросмотр контент-плана'}
            </Button>
          )}

          {showPreview && preview.length > 0 && (
            <>
              <div className="border rounded-lg p-4 space-y-3 max-h-60 overflow-y-auto">
                <h4 className="font-medium text-sm">Будет сгенерировано писем: {preview.length}</h4>
                <div className="space-y-2">
                  {preview.map((row, idx) => (
                    <div key={idx} className="p-3 bg-gray-50 rounded-md text-sm">
                      <div className="font-medium mb-1">{row.title}</div>
                      <div className="text-gray-600 text-xs flex items-center gap-1">
                        <Icon name="Tag" className="w-3 h-3" />
                        {row.content_type}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <Button 
                  onClick={() => {
                    setShowPreview(false);
                    setPreview([]);
                  }}
                  variant="outline"
                  className="flex-1"
                >
                  Назад
                </Button>
                <Button 
                  onClick={handleGenerateAll}
                  disabled={loading}
                  className="flex-1"
                >
                  <Icon name="Sparkles" className="w-4 h-4 mr-2" />
                  {loading ? 'Генерация...' : `Сгенерировать все (${preview.length})`}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}