import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

const CAMPAIGN_MANAGER_URL = 'https://functions.poehali.dev/e54890ac-fb38-4f4d-aca0-425c559bce45';

interface Campaign {
  id: number;
  name: string;
  program_doc_id: string;
  pain_doc_id: string;
  tone: string;
  status: string;
  created_at: string;
  email_count: number;
}

export default function CampaignHistory() {
  const { toast } = useToast();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCampaigns();
  }, []);

  const loadCampaigns = async () => {
    setLoading(true);
    try {
      const res = await fetch(CAMPAIGN_MANAGER_URL);
      const data = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setCampaigns(data.campaigns);
    } catch (error: any) {
      toast({
        title: 'Ошибка загрузки',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-500';
      case 'generated': return 'bg-blue-500';
      case 'sent': return 'bg-green-500';
      case 'failed': return 'bg-red-500';
      default: return 'bg-gray-400';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'draft': return 'Черновик';
      case 'generated': return 'Сгенерировано';
      case 'sent': return 'Отправлено';
      case 'failed': return 'Ошибка';
      default: return status;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              История кампаний
            </h1>
            <p className="text-lg text-gray-600">
              Все созданные рассылки и их статистика
            </p>
          </div>
          <Link to="/">
            <Button>
              <Icon name="Plus" className="w-4 h-4 mr-2" />
              Новая кампания
            </Button>
          </Link>
        </div>

        {loading ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Icon name="Loader2" className="w-8 h-8 animate-spin mx-auto mb-4 text-gray-400" />
              <p className="text-gray-600">Загрузка...</p>
            </CardContent>
          </Card>
        ) : campaigns.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Icon name="Inbox" className="w-16 h-16 mx-auto mb-4 text-gray-400" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Пока нет кампаний
              </h3>
              <p className="text-gray-600 mb-4">
                Создайте первую кампанию для автоматической генерации рассылок
              </p>
              <Link to="/">
                <Button>
                  <Icon name="Plus" className="w-4 h-4 mr-2" />
                  Создать кампанию
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {campaigns.map((campaign) => (
              <Card key={campaign.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-xl mb-2">
                        {campaign.name || `Кампания #${campaign.id}`}
                      </CardTitle>
                      <CardDescription>
                        Создана: {new Date(campaign.created_at).toLocaleString('ru-RU')}
                      </CardDescription>
                    </div>
                    <Badge className={getStatusColor(campaign.status)}>
                      {getStatusText(campaign.status)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="flex items-center gap-2">
                      <Icon name="FileText" className="w-4 h-4 text-gray-500" />
                      <div>
                        <p className="text-xs text-gray-500">Документы</p>
                        <p className="text-sm font-medium">
                          {campaign.program_doc_id.substring(0, 8)}...
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Icon name="Palette" className="w-4 h-4 text-gray-500" />
                      <div>
                        <p className="text-xs text-gray-500">Тон</p>
                        <p className="text-sm font-medium capitalize">
                          {campaign.tone}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Icon name="Mail" className="w-4 h-4 text-gray-500" />
                      <div>
                        <p className="text-xs text-gray-500">Писем</p>
                        <p className="text-sm font-medium">
                          {campaign.email_count}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Icon name="BarChart3" className="w-4 h-4 text-gray-500" />
                      <div>
                        <p className="text-xs text-gray-500">Открытия</p>
                        <p className="text-sm font-medium">
                          0%
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Card className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Icon name="Info" className="w-5 h-5" />
              Статистика собирается автоматически
            </CardTitle>
            <CardDescription className="text-blue-100">
              Метрики открытий и кликов обновляются в реальном времени через webhooks UniSender
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}
