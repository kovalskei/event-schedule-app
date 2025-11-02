import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';

interface TemplateGenerateFormProps {
  templateId: number;
  templateName: string;
  onGenerate: (html: string, variables: Record<string, string>) => void;
}

export default function TemplateGenerateForm({ 
  templateId, 
  templateName,
  onGenerate 
}: TemplateGenerateFormProps) {
  const [topic, setTopic] = useState('');
  const [knowledgeContext, setKnowledgeContext] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    if (!topic.trim()) {
      setError('Укажите тему письма');
      return;
    }

    setGenerating(true);
    setError('');

    try {
      const response = await fetch('https://functions.poehali.dev/d1b65152-b43b-4be4-8611-8ba8ea54d5c2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_id: templateId,
          topic: topic.trim(),
          knowledge_context: knowledgeContext.trim(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Ошибка генерации');
      }

      const data = await response.json();
      onGenerate(data.generated_html, data.variables_filled);
    } catch (err: any) {
      setError(err.message || 'Не удалось сгенерировать письмо');
      console.error('Generation error:', err);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Card className="p-6 border-2 border-blue-300 bg-blue-50">
      <div className="mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Icon name="Sparkles" size={20} />
          Генерация письма из шаблона
        </h3>
        <p className="text-sm text-gray-600 mt-1">
          Шаблон: <span className="font-medium">{templateName}</span>
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <Label htmlFor="topic">Тема письма *</Label>
          <Textarea
            id="topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="HR Tech Conference 2024: AI в подборе персонала"
            rows={2}
            className="bg-white"
          />
          <p className="text-xs text-gray-500 mt-1">
            О чём письмо? ИИ заполнит переменные на основе этой темы
          </p>
        </div>

        <div>
          <Label htmlFor="context">Контекст из базы знаний (необязательно)</Label>
          <Textarea
            id="context"
            value={knowledgeContext}
            onChange={(e) => setKnowledgeContext(e.target.value)}
            placeholder="Спикеры: Иван Петров (Яндекс, AI в HR), Мария Сидорова (Ozon, Автоматизация)..."
            rows={4}
            className="bg-white"
          />
          <p className="text-xs text-gray-500 mt-1">
            Дополнительная информация для более точной генерации
          </p>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">
            <Icon name="AlertCircle" size={16} className="inline mr-2" />
            {error}
          </div>
        )}

        <Button 
          onClick={handleGenerate} 
          disabled={generating || !topic.trim()}
          className="w-full"
          size="lg"
        >
          {generating ? (
            <>
              <div className="animate-spin mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
              Генерирую письмо...
            </>
          ) : (
            <>
              <Icon name="Wand2" size={18} className="mr-2" />
              Сгенерировать письмо
            </>
          )}
        </Button>
      </div>
    </Card>
  );
}
