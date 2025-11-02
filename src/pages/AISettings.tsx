import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

const models = [
  {
    provider: 'OpenAI',
    models: [
      {
        name: 'GPT-4o Mini',
        id: 'gpt-4o-mini',
        description: 'Быстрая и экономичная модель для стандартных рассылок',
        speed: 'fast',
        cost: 'low',
        quality: 'good',
        useCase: 'Массовые рассылки, A/B тесты, регулярные кампании',
      },
      {
        name: 'GPT-4o',
        id: 'gpt-4o',
        description: 'Продвинутая модель с высоким качеством генерации',
        speed: 'medium',
        cost: 'medium',
        quality: 'excellent',
        useCase: 'Важные кампании, персонализированные рассылки',
      },
      {
        name: 'o1-preview',
        id: 'o1-preview',
        description: 'Модель с расширенным reasoning для сложных задач',
        speed: 'slow',
        cost: 'high',
        quality: 'excellent',
        useCase: 'Стратегический анализ, глубокая персонализация',
      },
      {
        name: 'Custom Assistant',
        id: 'custom',
        description: 'Ваш настроенный ассистент с файлами и инструкциями',
        speed: 'medium',
        cost: 'variable',
        quality: 'custom',
        useCase: 'Брендированный контент, специфические требования',
      },
    ],
  },
  {
    provider: 'Anthropic Claude',
    models: [
      {
        name: 'Claude 3.5 Sonnet',
        id: 'claude-3-5-sonnet-20241022',
        description: 'Лучшая модель для большинства задач с эмпатией',
        speed: 'medium',
        cost: 'medium',
        quality: 'excellent',
        useCase: 'Универсальный выбор, эмоциональный контент',
      },
      {
        name: 'Claude 3 Opus',
        id: 'claude-3-opus-20240229',
        description: 'Максимальное качество и креативность',
        speed: 'slow',
        cost: 'high',
        quality: 'best',
        useCase: 'Премиум-кампании, креативные рассылки',
      },
      {
        name: 'Claude 3 Haiku',
        id: 'claude-3-haiku-20240307',
        description: 'Быстрая модель для простых задач',
        speed: 'fast',
        cost: 'low',
        quality: 'good',
        useCase: 'Простые рассылки, быстрые тесты',
      },
    ],
  },
];

const getSpeedBadge = (speed: string) => {
  const colors = {
    fast: 'bg-green-500',
    medium: 'bg-yellow-500',
    slow: 'bg-red-500',
  };
  return colors[speed as keyof typeof colors] || 'bg-gray-500';
};

const getCostBadge = (cost: string) => {
  const colors = {
    low: 'bg-green-500',
    medium: 'bg-yellow-500',
    high: 'bg-red-500',
    variable: 'bg-blue-500',
  };
  return colors[cost as keyof typeof colors] || 'bg-gray-500';
};

export default function AISettings() {
  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              Настройка ИИ-моделей
            </h1>
            <p className="text-lg text-gray-600">
              Выбирайте модель под каждую задачу для оптимальных результатов
            </p>
          </div>
          <Link to="/">
            <Button>
              <Icon name="ArrowLeft" className="w-4 h-4 mr-2" />
              К рассылкам
            </Button>
          </Link>
        </div>

        <Card className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Icon name="Lightbulb" className="w-5 h-5" />
              Как выбрать модель?
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-blue-50">
            <p>🎯 <strong>Для стандартных рассылок:</strong> GPT-4o Mini или Claude 3.5 Sonnet</p>
            <p>🚀 <strong>Для важных кампаний:</strong> GPT-4o или Claude 3 Opus</p>
            <p>🧠 <strong>Для сложных задач:</strong> o1-preview (анализ и стратегия)</p>
            <p>⚙️ <strong>Для кастомизации под бренд:</strong> Custom Assistant с файлами</p>
          </CardContent>
        </Card>

        {models.map((provider) => (
          <div key={provider.provider}>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Icon name="Cpu" className="w-6 h-6" />
              {provider.provider}
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              {provider.models.map((model) => (
                <Card key={model.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      {model.name}
                      <div className="flex gap-2">
                        <Badge className={getSpeedBadge(model.speed)}>
                          {model.speed === 'fast' && '⚡ Быстро'}
                          {model.speed === 'medium' && '⚡⚡ Средне'}
                          {model.speed === 'slow' && '🐌 Медленно'}
                        </Badge>
                        <Badge className={getCostBadge(model.cost)}>
                          {model.cost === 'low' && '💰 Дёшево'}
                          {model.cost === 'medium' && '💰💰 Средне'}
                          {model.cost === 'high' && '💰💰💰 Дорого'}
                          {model.cost === 'variable' && '💰 Гибко'}
                        </Badge>
                      </div>
                    </CardTitle>
                    <CardDescription>{model.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-start gap-2">
                      <Icon name="Target" className="w-4 h-4 text-gray-500 mt-1" />
                      <div>
                        <p className="text-xs text-gray-500">Применение:</p>
                        <p className="text-sm">{model.useCase}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Icon name="Award" className="w-4 h-4 text-gray-500" />
                      <div>
                        <p className="text-xs text-gray-500">Качество:</p>
                        <p className="text-sm font-medium capitalize">{model.quality}</p>
                      </div>
                    </div>
                    {model.id === 'custom' && (
                      <div className="mt-4 p-3 bg-blue-50 rounded border border-blue-200">
                        <p className="text-xs text-blue-900 mb-2 font-medium">
                          Как создать Custom Assistant:
                        </p>
                        <ol className="text-xs text-blue-800 space-y-1 ml-4 list-decimal">
                          <li>Откройте platform.openai.com/assistants</li>
                          <li>Создайте ассистента с инструкциями</li>
                          <li>Загрузите файлы (шаблоны, примеры)</li>
                          <li>Скопируйте Assistant ID (asst_...)</li>
                          <li>Используйте в расширенных настройках</li>
                        </ol>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Icon name="BarChart3" className="w-5 h-5" />
              Сравнение стоимости (на 1000 писем)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center p-2 hover:bg-gray-50 rounded">
                <span>GPT-4o Mini</span>
                <Badge variant="outline" className="bg-green-50">~$0.15</Badge>
              </div>
              <div className="flex justify-between items-center p-2 hover:bg-gray-50 rounded">
                <span>Claude 3 Haiku</span>
                <Badge variant="outline" className="bg-green-50">~$0.25</Badge>
              </div>
              <div className="flex justify-between items-center p-2 hover:bg-gray-50 rounded">
                <span>GPT-4o</span>
                <Badge variant="outline" className="bg-yellow-50">~$2.50</Badge>
              </div>
              <div className="flex justify-between items-center p-2 hover:bg-gray-50 rounded">
                <span>Claude 3.5 Sonnet</span>
                <Badge variant="outline" className="bg-yellow-50">~$3.00</Badge>
              </div>
              <div className="flex justify-between items-center p-2 hover:bg-gray-50 rounded">
                <span>o1-preview</span>
                <Badge variant="outline" className="bg-red-50">~$15.00</Badge>
              </div>
              <div className="flex justify-between items-center p-2 hover:bg-gray-50 rounded">
                <span>Claude 3 Opus</span>
                <Badge variant="outline" className="bg-red-50">~$15.00</Badge>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-4">
              * Цены ориентировочные, зависят от длины контента и настроек
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-purple-600 to-pink-600 text-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Icon name="TrendingUp" className="w-5 h-5" />
              Рекомендация: A/B тестирование
            </CardTitle>
          </CardHeader>
          <CardContent className="text-purple-50">
            <p className="mb-2">
              Создавайте несколько версий писем разными моделями и тестируйте на аудитории:
            </p>
            <ul className="space-y-1 ml-4 list-disc">
              <li>GPT-4o: структурный и детальный подход</li>
              <li>Claude 3.5 Sonnet: эмпатия и естественность</li>
              <li>Custom Assistant: фирменный стиль</li>
            </ul>
            <p className="mt-4 text-sm">
              Собирайте метрики (open rate, click rate) и выбирайте победителя!
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}