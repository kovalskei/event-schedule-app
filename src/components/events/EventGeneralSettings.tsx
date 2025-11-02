import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { Event } from './types';

interface EventGeneralSettingsProps {
  event: Event;
  onEventChange: (event: Event) => void;
  onLogoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  logoUploading: boolean;
  onIndexKnowledge: () => void;
  indexing: boolean;
  onSave: () => void;
  loading: boolean;
}

export default function EventGeneralSettings({
  event,
  onEventChange,
  onLogoUpload,
  logoUploading,
  onIndexKnowledge,
  indexing,
  onSave,
  loading,
}: EventGeneralSettingsProps) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Основная информация</CardTitle>
          <CardDescription>Настройки мероприятия и документов</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="name">Название</Label>
            <Input
              id="name"
              value={event.name}
              onChange={(e) => onEventChange({ ...event, name: e.target.value })}
            />
          </div>

          <div>
            <Label htmlFor="description">Описание</Label>
            <Textarea
              id="description"
              value={event.description || ''}
              onChange={(e) => onEventChange({ ...event, description: e.target.value })}
            />
          </div>

          <div>
            <Label htmlFor="logo">Логотип для шапки писем</Label>
            <div className="space-y-2">
              {event.logo_url && (
                <div className="border rounded-lg p-4 bg-gray-50">
                  <img 
                    src={event.logo_url} 
                    alt="Event logo" 
                    className="h-16 object-contain"
                  />
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="mt-2"
                    onClick={() => onEventChange({ ...event, logo_url: '' })}
                  >
                    <Icon name="X" className="w-3 h-3 mr-1" />
                    Удалить
                  </Button>
                </div>
              )}
              <Input
                id="logo"
                type="file"
                accept="image/*"
                onChange={onLogoUpload}
                disabled={logoUploading}
              />
              <p className="text-xs text-gray-500">
                {logoUploading ? 'Загрузка...' : 'Рекомендуемый размер: 600x100px, максимум 2 МБ'}
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="start_date">Дата начала</Label>
              <Input
                id="start_date"
                type="date"
                value={event.start_date}
                onChange={(e) => onEventChange({ ...event, start_date: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="end_date">Дата окончания</Label>
              <Input
                id="end_date"
                type="date"
                value={event.end_date}
                onChange={(e) => onEventChange({ ...event, end_date: e.target.value })}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="program_doc_id">ID документа с программой</Label>
            <Input
              id="program_doc_id"
              value={event.program_doc_id || ''}
              onChange={(e) => onEventChange({ ...event, program_doc_id: e.target.value })}
              placeholder="1abc2def3ghi..."
            />
          </div>

          <div>
            <Label htmlFor="pain_doc_id">ID документа с болями ЦА</Label>
            <Input
              id="pain_doc_id"
              value={event.pain_doc_id || ''}
              onChange={(e) => onEventChange({ ...event, pain_doc_id: e.target.value })}
              placeholder="4jkl5mno6pqr..."
            />
          </div>

          <div>
            <Label htmlFor="default_tone">Тон писем по умолчанию</Label>
            <Select
              value={event.default_tone}
              onValueChange={(value) => onEventChange({ ...event, default_tone: value })}
            >
              <SelectTrigger id="default_tone">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="professional">Профессиональный</SelectItem>
                <SelectItem value="friendly">Дружелюбный</SelectItem>
                <SelectItem value="formal">Официальный</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="cta_base_url">Базовая CTA ссылка</Label>
            <Input
              id="cta_base_url"
              value={event.cta_base_url || ''}
              onChange={(e) => onEventChange({ ...event, cta_base_url: e.target.value })}
              placeholder="https://example.com/register"
            />
            <p className="text-xs text-gray-500 mt-1">
              UTM-метки будут добавлены автоматически при генерации писем
            </p>
          </div>

          <Card className="border-2 border-blue-200 bg-blue-50">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Icon name="Sparkles" className="w-5 h-5 text-blue-600" />
                V2 Pipeline (Новая система генерации)
              </CardTitle>
              <CardDescription>
                Двухпроходная генерация с RAG, строгими шаблонами и QA-валидацией
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-white rounded-lg">
                <div>
                  <div className="font-medium">Использовать V2 Pipeline</div>
                  <div className="text-xs text-gray-600">
                    {(event as any).use_v2_pipeline 
                      ? '✅ Включено — письма генерируются через V2' 
                      : '⚠️ Выключено — используется старая система (V1)'}
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={(event as any).use_v2_pipeline || false}
                    onChange={(e) => onEventChange({ ...event, use_v2_pipeline: e.target.checked } as any)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <div className="text-xs text-gray-700 space-y-1 bg-white p-3 rounded-lg">
                <div className="font-semibold mb-2">Преимущества V2:</div>
                <div>✅ Двухпроходная генерация (план → тексты слотов)</div>
                <div>✅ RAG: семантический поиск вместо обрезки по символам</div>
                <div>✅ Строгие HTML-шаблоны (табличная вёрстка)</div>
                <div>✅ QA-валидация (subject, alt, links, размер)</div>
                <div>✅ A/B варианты subject из одного запроса</div>
              </div>

              <Button 
                onClick={onIndexKnowledge} 
                disabled={indexing || !event?.use_v2_pipeline}
                className="w-full"
                variant="outline"
              >
                <Icon name={indexing ? "Loader2" : "Database"} className={`w-4 h-4 mr-2 ${indexing ? 'animate-spin' : ''}`} />
                {indexing ? 'Индексация...' : 'Индексировать знания'}
              </Button>
              
              {!event?.use_v2_pipeline && (
                <div className="text-xs text-yellow-700 bg-yellow-50 p-2 rounded">
                  Включите V2 Pipeline для использования индексации
                </div>
              )}
            </CardContent>
          </Card>

          <Button onClick={onSave} disabled={loading} className="w-full">
            <Icon name={loading ? "Loader2" : "Save"} className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Сохранение...' : 'Сохранить настройки'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
