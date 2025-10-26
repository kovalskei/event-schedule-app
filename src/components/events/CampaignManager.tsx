import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

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

interface CampaignManagerProps {
  eventId: number;
  campaigns: Campaign[];
  onCreateCampaign: (name: string, demoMode: boolean) => void;
  onSelectCampaign: (campaign: Campaign) => void;
}

export default function CampaignManager({ 
  eventId, 
  campaigns, 
  onCreateCampaign, 
  onSelectCampaign 
}: CampaignManagerProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [newCampaignName, setNewCampaignName] = useState('');
  const [demoMode, setDemoMode] = useState(true);

  const handleCreate = () => {
    if (!newCampaignName.trim()) return;
    onCreateCampaign(newCampaignName, demoMode);
    setNewCampaignName('');
    setDemoMode(true);
    setCreateOpen(false);
  };

  const getStatusBadge = (status: string, demoMode: boolean) => {
    if (demoMode) {
      return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">ДЕМО</Badge>;
    }
    
    switch (status) {
      case 'draft':
        return <Badge variant="secondary">Черновик</Badge>;
      case 'running':
        return <Badge variant="default">Запущена</Badge>;
      case 'completed':
        return <Badge variant="outline">Завершена</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold">Кампании</h3>
          <p className="text-sm text-gray-500 mt-1">Управление email-кампаниями мероприятия</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Icon name="Plus" className="w-4 h-4 mr-2" />
          Создать кампанию
        </Button>
      </div>

      {campaigns.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Icon name="Mail" className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h4 className="text-lg font-medium mb-2">Нет кампаний</h4>
            <p className="text-gray-500 mb-4">Создайте первую кампанию для начала работы</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {campaigns.map((campaign) => (
            <Card 
              key={campaign.id} 
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => onSelectCampaign(campaign)}
            >
              <CardHeader>
                <div className="flex items-start justify-between mb-2">
                  <CardTitle className="text-lg">{campaign.name}</CardTitle>
                  {getStatusBadge(campaign.status, campaign.demo_mode)}
                </div>
                <CardDescription>
                  {campaign.items_count} писем в контент-плане
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-sm space-y-1">
                  {campaign.actual_start && (
                    <div className="text-gray-600">
                      Запущена: {new Date(campaign.actual_start).toLocaleDateString('ru-RU')}
                    </div>
                  )}
                  {campaign.completed_at && (
                    <div className="text-gray-600">
                      Завершена: {new Date(campaign.completed_at).toLocaleDateString('ru-RU')}
                    </div>
                  )}
                  <div className="text-gray-400 text-xs mt-2">
                    Создана: {new Date(campaign.created_at).toLocaleDateString('ru-RU')}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Создать кампанию</DialogTitle>
            <DialogDescription>
              Создайте новую email-кампанию для мероприятия
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="campaign-name">Название кампании</Label>
              <Input
                id="campaign-name"
                placeholder="Основная кампания"
                value={newCampaignName}
                onChange={(e) => setNewCampaignName(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg bg-blue-50">
              <div className="space-y-1">
                <Label htmlFor="demo-mode" className="text-sm font-medium">
                  Демо-режим
                </Label>
                <p className="text-xs text-gray-600">
                  В демо-режиме письма не отправляются в UniSender
                </p>
              </div>
              <Switch
                id="demo-mode"
                checked={demoMode}
                onCheckedChange={setDemoMode}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleCreate} disabled={!newCampaignName.trim()}>
              Создать
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
