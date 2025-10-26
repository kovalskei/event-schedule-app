import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

interface ContentPlanItem {
  id: number;
  scheduled_date: string;
  content_type_name: string;
  subject: string;
  key_message: string;
  status: string;
}

interface MailingList {
  id: number;
  unisender_list_id: string;
  unisender_list_name: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
}

interface ScheduleRule {
  id: number;
  list_id: number;
  list_name: string;
  content_plan_item_id: number;
  scheduled_date: string;
  content_type: string;
  subject: string;
  status: string;
}

interface ScheduledCampaignsProps {
  eventId: number;
  contentPlan: ContentPlanItem[];
  mailingLists: MailingList[];
  schedules: ScheduleRule[];
  onCreateSchedule: (listId: number, contentPlanItemId: number) => void;
  onLaunchSchedule: (scheduleId: number) => void;
}

export default function ScheduledCampaigns({
  eventId,
  contentPlan,
  mailingLists,
  schedules,
  onCreateSchedule,
  onLaunchSchedule
}: ScheduledCampaignsProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedList, setSelectedList] = useState<number>(0);
  const [selectedContentItem, setSelectedContentItem] = useState<number>(0);

  const handleCreate = () => {
    if (!selectedList || !selectedContentItem) return;
    onCreateSchedule(selectedList, selectedContentItem);
    setSelectedList(0);
    setSelectedContentItem(0);
    setCreateOpen(false);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary">Запланировано</Badge>;
      case 'processing':
        return <Badge variant="default">Обрабатывается</Badge>;
      case 'sent':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Отправлено</Badge>;
      case 'failed':
        return <Badge variant="destructive">Ошибка</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const groupedByList = schedules.reduce((acc, schedule) => {
    if (!acc[schedule.list_name]) {
      acc[schedule.list_name] = [];
    }
    acc[schedule.list_name].push(schedule);
    return acc;
  }, {} as Record<string, ScheduleRule[]>);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Расписание рассылок</CardTitle>
              <CardDescription>
                Привязка контент-плана к спискам рассылки
              </CardDescription>
            </div>
            <Button onClick={() => setCreateOpen(true)}>
              <Icon name="Plus" className="w-4 h-4 mr-2" />
              Добавить расписание
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {schedules.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Icon name="Calendar" className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Нет запланированных рассылок</p>
              <p className="text-sm mt-1">Создайте расписание, чтобы начать автоматическую отправку</p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedByList).map(([listName, items]) => (
                <div key={listName} className="border rounded-lg p-4">
                  <h3 className="font-medium mb-3 flex items-center gap-2">
                    <Icon name="Users" className="w-4 h-4" />
                    {listName}
                  </h3>
                  <div className="space-y-2">
                    {items.map((schedule) => (
                      <div key={schedule.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline">{schedule.content_type}</Badge>
                            {getStatusBadge(schedule.status)}
                          </div>
                          <div className="text-sm font-medium">{schedule.subject}</div>
                          <div className="text-xs text-gray-500 mt-1">
                            Отправка: {new Date(schedule.scheduled_date).toLocaleString('ru-RU')}
                          </div>
                        </div>
                        {schedule.status === 'pending' && (
                          <Button 
                            size="sm" 
                            onClick={() => onLaunchSchedule(schedule.id)}
                          >
                            <Icon name="Play" className="w-3 h-3 mr-1" />
                            Запустить
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Добавить в расписание</DialogTitle>
            <DialogDescription>
              Привяжите письмо из контент-плана к списку рассылки
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="mailing-list">Список рассылки</Label>
              <Select
                value={selectedList.toString()}
                onValueChange={(value) => setSelectedList(parseInt(value))}
              >
                <SelectTrigger id="mailing-list">
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

            <div className="space-y-2">
              <Label htmlFor="content-item">Письмо из контент-плана</Label>
              <Select
                value={selectedContentItem.toString()}
                onValueChange={(value) => setSelectedContentItem(parseInt(value))}
              >
                <SelectTrigger id="content-item">
                  <SelectValue placeholder="Выберите письмо" />
                </SelectTrigger>
                <SelectContent>
                  {contentPlan.map((item) => (
                    <SelectItem key={item.id} value={item.id.toString()}>
                      <div className="flex flex-col">
                        <div className="font-medium">{item.subject || 'Без темы'}</div>
                        <div className="text-xs text-gray-500">
                          {item.content_type_name} • {new Date(item.scheduled_date).toLocaleDateString('ru-RU')}
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-xs text-gray-700">
                <Icon name="Info" className="w-3 h-3 inline mr-1" />
                Письмо будет автоматически сгенерировано и отправлено в указанную дату
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Отмена
            </Button>
            <Button 
              onClick={handleCreate}
              disabled={!selectedList || !selectedContentItem}
            >
              Добавить в расписание
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
