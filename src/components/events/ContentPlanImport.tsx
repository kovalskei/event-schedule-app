import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import { useToast } from '@/hooks/use-toast';

interface ContentPlanImportProps {
  eventId: number;
  onImportComplete: () => void;
}

export default function ContentPlanImport({ eventId, onImportComplete }: ContentPlanImportProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [sheetUrl, setSheetUrl] = useState('');

  const handleImport = async () => {
    if (!sheetUrl.trim()) {
      toast({
        title: 'Ошибка',
        description: 'Укажите ссылку на Google Таблицу',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('https://functions.poehali.dev/b56e5895-fb22-4d96-b746-b046a9fd2750', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'import_content_plan',
          event_id: eventId,
          sheet_url: sheetUrl,
        }),
      });

      const data = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }

      toast({
        title: 'Контент-план загружен',
        description: `Импортировано ${data.imported_count} записей`,
      });

      setSheetUrl('');
      onImportComplete();
    } catch (error: any) {
      toast({
        title: 'Ошибка импорта',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon name="FileSpreadsheet" className="w-5 h-5" />
          Импорт контент-плана
        </CardTitle>
        <CardDescription>
          Загрузите контент-план из Google Таблицы
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="sheet-url">Ссылка на Google Таблицу</Label>
          <Input
            id="sheet-url"
            placeholder="https://docs.google.com/spreadsheets/d/..."
            value={sheetUrl}
            onChange={(e) => setSheetUrl(e.target.value)}
            disabled={loading}
          />
          <p className="text-xs text-gray-500">
            Таблица должна содержать столбцы: Дата, Тип контента, Тема, Ключевое сообщение, CTA
          </p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
            <Icon name="Info" className="w-4 h-4 text-blue-600" />
            Формат таблицы
          </h4>
          <div className="text-xs text-gray-700 space-y-1">
            <div><strong>Дата:</strong> 2025-11-20 или 20.11.2025</div>
            <div><strong>Тип контента:</strong> Название типа из настроек мероприятия</div>
            <div><strong>Тема:</strong> Тема письма</div>
            <div><strong>Ключевое сообщение:</strong> Основная мысль (опционально)</div>
            <div><strong>CTA:</strong> Призыв к действию (опционально)</div>
          </div>
        </div>

        <Button 
          onClick={handleImport} 
          disabled={loading || !sheetUrl.trim()}
          className="w-full"
        >
          {loading ? (
            <>
              <Icon name="Loader2" className="w-4 h-4 mr-2 animate-spin" />
              Импортирую...
            </>
          ) : (
            <>
              <Icon name="Download" className="w-4 h-4 mr-2" />
              Импортировать контент-план
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
