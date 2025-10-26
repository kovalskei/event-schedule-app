import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Icon from '@/components/ui/icon';

interface CreateEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  newEvent: {
    name: string;
    description: string;
    start_date: string;
    end_date: string;
    program_doc_id: string;
    pain_doc_id: string;
    default_tone: string;
    email_template_examples: string;
  };
  onEventChange: (event: any) => void;
  onCreateEvent: () => void;
}

export default function CreateEventDialog({
  open,
  onOpenChange,
  newEvent,
  onEventChange,
  onCreateEvent,
}: CreateEventDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="lg">
          <Icon name="Plus" className="w-4 h-4 mr-2" />
          Создать мероприятие
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Новое мероприятие</DialogTitle>
          <DialogDescription>
            Создайте мероприятие для управления email-кампаниями
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="name">Название мероприятия</Label>
            <Input
              id="name"
              value={newEvent.name}
              onChange={(e) => onEventChange({ ...newEvent, name: e.target.value })}
              placeholder="HR Conference 2024"
            />
          </div>
          
          <div>
            <Label htmlFor="description">Описание</Label>
            <Textarea
              id="description"
              value={newEvent.description}
              onChange={(e) => onEventChange({ ...newEvent, description: e.target.value })}
              placeholder="Конференция для HR-специалистов"
            />
          </div>
          
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="start_date">Дата начала</Label>
              <Input
                id="start_date"
                type="date"
                value={newEvent.start_date}
                onChange={(e) => onEventChange({ ...newEvent, start_date: e.target.value })}
              />
            </div>
            
            <div>
              <Label htmlFor="end_date">Дата окончания</Label>
              <Input
                id="end_date"
                type="date"
                value={newEvent.end_date}
                onChange={(e) => onEventChange({ ...newEvent, end_date: e.target.value })}
              />
            </div>
          </div>
          
          <div>
            <Label htmlFor="program_doc_id">ID документа с программой</Label>
            <Input
              id="program_doc_id"
              value={newEvent.program_doc_id}
              onChange={(e) => onEventChange({ ...newEvent, program_doc_id: e.target.value })}
              placeholder="1abc2def3ghi..."
            />
          </div>
          
          <div>
            <Label htmlFor="pain_doc_id">ID документа с болями ЦА</Label>
            <Input
              id="pain_doc_id"
              value={newEvent.pain_doc_id}
              onChange={(e) => onEventChange({ ...newEvent, pain_doc_id: e.target.value })}
              placeholder="4jkl5mno6pqr..."
            />
          </div>
          
          <div>
            <Label htmlFor="default_tone">Тон писем по умолчанию</Label>
            <Select
              value={newEvent.default_tone}
              onValueChange={(value) => onEventChange({ ...newEvent, default_tone: value })}
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
            <Label htmlFor="email_template_examples">Примеры шаблонов писем</Label>
            <Textarea
              id="email_template_examples"
              value={newEvent.email_template_examples}
              onChange={(e) => onEventChange({ ...newEvent, email_template_examples: e.target.value })}
              placeholder="Примеры успешных писем, референсы дизайна, tone of voice..." 
              rows={5}
            />
            <p className="text-xs text-gray-500 mt-1">Эти примеры будут использоваться ИИ при генерации писем</p>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button onClick={onCreateEvent}>
            Создать мероприятие
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}