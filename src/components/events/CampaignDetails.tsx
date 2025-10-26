import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Campaign {
  id: number;
  event_id: number;
  name: string;
  status: string;
  demo_mode: boolean;
  scheduled_start: string | null;
  actual_start: string | null;
  completed_at: string | null;
  items_count: number;
  created_at: string;
}

interface ContentPlanItem {
  id: number;
  campaign_id: number;
  content_type_id: number;
  content_type_name: string;
  scheduled_date: string;
  subject: string;
  key_message: string;
  cta_text: string;
  status: string;
  generated_html: string | null;
  sent_at: string | null;
  created_at: string;
}

interface ContentType {
  id: number;
  name: string;
}

interface CampaignDetailsProps {
  campaign: Campaign;
  contentPlan: ContentPlanItem[];
  contentTypes: ContentType[];
  onBack: () => void;
  onAddItem: (item: Partial<ContentPlanItem>) => void;
  onLaunchCampaign: () => void;
}

export default function CampaignDetails({
  campaign,
  contentPlan,
  contentTypes,
  onBack,
  onAddItem,
  onLaunchCampaign
}: CampaignDetailsProps) {
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [newItem, setNewItem] = useState({
    content_type_id: 0,
    scheduled_date: '',
    subject: '',
    key_message: '',
    cta_text: ''
  });

  const handleAddItem = () => {
    if (!newItem.content_type_id || !newItem.scheduled_date) return;
    onAddItem(newItem);
    setNewItem({
      content_type_id: 0,
      scheduled_date: '',
      subject: '',
      key_message: '',
      cta_text: ''
    });
    setAddItemOpen(false);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary">Ожидает</Badge>;
      case 'generated':
        return <Badge variant="outline">Сгенерировано</Badge>;
      case 'sent':
        return <Badge variant="default">Отправлено</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const canLaunch = campaign.status === 'draft' && contentPlan.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onBack}>
          <Icon name="ArrowLeft" className="w-4 h-4 mr-2" />
          Назад к кампаниям
        </Button>

        {campaign.demo_mode && (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            <Icon name="Info" className="w-3 h-3 mr-1" />
            ДЕМО-РЕЖИМ
          </Badge>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-2xl">{campaign.name}</CardTitle>
              <CardDescription className="mt-2">
                {campaign.demo_mode 
                  ? 'Кампания в демо-режиме — письма не отправляются' 
                  : 'Боевая кампания — письма отправляются в UniSender'}
              </CardDescription>
            </div>
            <Badge variant={campaign.status === 'running' ? 'default' : 'secondary'}>
              {campaign.status === 'draft' && 'Черновик'}
              {campaign.status === 'running' && 'Запущена'}
              {campaign.status === 'completed' && 'Завершена'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            {campaign.actual_start && (
              <div className="text-sm">
                <span className="text-gray-500">Запущена:</span>{' '}
                {new Date(campaign.actual_start).toLocaleString('ru-RU')}
              </div>
            )}
            {campaign.completed_at && (
              <div className="text-sm">
                <span className="text-gray-500">Завершена:</span>{' '}
                {new Date(campaign.completed_at).toLocaleString('ru-RU')}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Контент-план</CardTitle>
              <CardDescription>
                Запланированные письма кампании
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setAddItemOpen(true)} variant="outline">
                <Icon name="Plus" className="w-4 h-4 mr-2" />
                Добавить письмо
              </Button>
              {canLaunch && (
                <Button onClick={onLaunchCampaign}>
                  <Icon name="Play" className="w-4 h-4 mr-2" />
                  Запустить кампанию
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {contentPlan.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Icon name="FileText" className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Добавьте первое письмо в контент-план</p>
            </div>
          ) : (
            <div className="space-y-4">
              {contentPlan.map((item) => (
                <div key={item.id} className="p-4 border rounded-lg">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline">{item.content_type_name}</Badge>
                        {getStatusBadge(item.status)}
                      </div>
                      <h4 className="font-medium">{item.subject || 'Без темы'}</h4>
                      <p className="text-sm text-gray-500 mt-1">
                        Отправка: {new Date(item.scheduled_date).toLocaleDateString('ru-RU')}
                      </p>
                    </div>
                  </div>

                  {item.key_message && (
                    <div className="text-sm mb-2">
                      <span className="font-medium">Ключевое сообщение:</span>{' '}
                      {item.key_message}
                    </div>
                  )}

                  {item.cta_text && (
                    <div className="text-sm">
                      <span className="font-medium">CTA:</span> {item.cta_text}
                    </div>
                  )}

                  {item.sent_at && (
                    <div className="text-xs text-gray-400 mt-2">
                      Отправлено: {new Date(item.sent_at).toLocaleString('ru-RU')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={addItemOpen} onOpenChange={setAddItemOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Добавить письмо</DialogTitle>
            <DialogDescription>
              Добавьте новое письмо в контент-план кампании
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="content-type">Тип контента</Label>
              <Select
                value={newItem.content_type_id.toString()}
                onValueChange={(value) => setNewItem({ ...newItem, content_type_id: parseInt(value) })}
              >
                <SelectTrigger id="content-type">
                  <SelectValue placeholder="Выберите тип" />
                </SelectTrigger>
                <SelectContent>
                  {contentTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id.toString()}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="scheduled-date">Дата отправки</Label>
              <Input
                id="scheduled-date"
                type="datetime-local"
                value={newItem.scheduled_date}
                onChange={(e) => setNewItem({ ...newItem, scheduled_date: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="subject">Тема письма (опционально)</Label>
              <Input
                id="subject"
                placeholder="Напоминание о мероприятии"
                value={newItem.subject}
                onChange={(e) => setNewItem({ ...newItem, subject: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="key-message">Ключевое сообщение (опционально)</Label>
              <Textarea
                id="key-message"
                placeholder="Основная мысль письма"
                value={newItem.key_message}
                onChange={(e) => setNewItem({ ...newItem, key_message: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cta">Призыв к действию (опционально)</Label>
              <Input
                id="cta"
                placeholder="Зарегистрироваться сейчас"
                value={newItem.cta_text}
                onChange={(e) => setNewItem({ ...newItem, cta_text: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddItemOpen(false)}>
              Отмена
            </Button>
            <Button 
              onClick={handleAddItem}
              disabled={!newItem.content_type_id || !newItem.scheduled_date}
            >
              Добавить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
