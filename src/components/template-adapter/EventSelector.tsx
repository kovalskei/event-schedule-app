import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const TEMPLATE_ADAPTER_URL = 'https://functions.poehali.dev/9494e2f1-fffb-4efc-9a10-e7763291cd3a';

interface Event {
  id: number;
  name: string;
  description?: string;
  start_date?: string;
  status?: string;
}

interface EventSelectorProps {
  onEventSelect: (eventId: string) => void;
  selectedEventId?: string;
}

export function EventSelector({ onEventSelect, selectedEventId }: EventSelectorProps) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(false);
  const [manualId, setManualId] = useState('');
  const [showManual, setShowManual] = useState(false);

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    setLoading(true);
    try {
      const response = await fetch(TEMPLATE_ADAPTER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'list_events' })
      });

      if (response.ok) {
        const data = await response.json();
        setEvents(data.events || []);
      }
    } catch (err) {
      console.error('Failed to load events:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectEvent = (value: string) => {
    onEventSelect(value);
  };

  const handleManualSubmit = () => {
    if (manualId.trim()) {
      onEventSelect(manualId.trim());
      setShowManual(false);
      setManualId('');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon name="Calendar" className="h-5 w-5" />
          Выбор события
        </CardTitle>
        <CardDescription>
          Выберите событие для автозаполнения данных из базы знаний
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Icon name="Loader2" className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Загрузка событий...</span>
          </div>
        ) : events.length > 0 ? (
          <div className="space-y-2">
            <Label htmlFor="event-select">Активные события</Label>
            <Select value={selectedEventId} onValueChange={handleSelectEvent}>
              <SelectTrigger id="event-select">
                <SelectValue placeholder="Выберите событие" />
              </SelectTrigger>
              <SelectContent>
                {events.map((event) => (
                  <SelectItem key={event.id} value={String(event.id)}>
                    <div className="flex items-center gap-2">
                      <span>{event.name}</span>
                      {event.start_date && (
                        <Badge variant="outline" className="text-xs">
                          {new Date(event.start_date).toLocaleDateString('ru-RU')}
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <Alert>
            <Icon name="Info" className="h-4 w-4" />
            <AlertDescription>
              Нет активных событий. Используйте ручной ввод ID.
            </AlertDescription>
          </Alert>
        )}

        <div className="pt-4 border-t">
          {!showManual ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowManual(true)}
              className="w-full"
            >
              <Icon name="Hash" className="mr-2 h-4 w-4" />
              Ввести ID вручную
            </Button>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="manual-id">ID события</Label>
              <div className="flex gap-2">
                <Input
                  id="manual-id"
                  placeholder="Введите ID события"
                  value={manualId}
                  onChange={(e) => setManualId(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleManualSubmit()}
                />
                <Button onClick={handleManualSubmit} disabled={!manualId.trim()}>
                  <Icon name="Check" className="h-4 w-4" />
                </Button>
                <Button variant="ghost" onClick={() => setShowManual(false)}>
                  <Icon name="X" className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>

        {selectedEventId && (
          <Alert className="bg-green-50 border-green-200">
            <Icon name="CheckCircle2" className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              Выбрано событие ID: {selectedEventId}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
