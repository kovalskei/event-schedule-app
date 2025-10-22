import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Icon from '@/components/ui/icon';

interface UniSenderList {
  id: string;
  title: string;
}

interface LinkListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unisenderLists: UniSenderList[];
  selectedUnisenderList: {
    list_id: string;
    list_name: string;
    utm_source: string;
    utm_medium: string;
    utm_campaign: string;
    utm_term: string;
    utm_content: string;
  };
  onListChange: (list: any) => void;
  onLinkList: () => void;
}

export default function LinkListDialog({
  open,
  onOpenChange,
  unisenderLists,
  selectedUnisenderList,
  onListChange,
  onLinkList,
}: LinkListDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Icon name="Link" className="w-4 h-4 mr-2" />
          Привязать список UniSender
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Привязать список UniSender</DialogTitle>
          <DialogDescription>
            Выберите список и настройте UTM-метки
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="unisender_list">Список UniSender</Label>
            <Select
              value={selectedUnisenderList.list_id}
              onValueChange={(value) => {
                const list = unisenderLists.find(l => l.id === value);
                onListChange({
                  ...selectedUnisenderList,
                  list_id: value,
                  list_name: list?.title || '',
                });
              }}
            >
              <SelectTrigger id="unisender_list">
                <SelectValue placeholder="Выберите список" />
              </SelectTrigger>
              <SelectContent>
                {unisenderLists.map((list) => (
                  <SelectItem key={list.id} value={list.id}>
                    {list.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="p-4 bg-gray-50 rounded-lg space-y-3">
            <h4 className="font-medium">UTM-метки по умолчанию</h4>
            
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="utm_source">utm_source</Label>
                <Input
                  id="utm_source"
                  value={selectedUnisenderList.utm_source}
                  onChange={(e) => onListChange({ ...selectedUnisenderList, utm_source: e.target.value })}
                  placeholder="email"
                />
              </div>
              
              <div>
                <Label htmlFor="utm_medium">utm_medium</Label>
                <Input
                  id="utm_medium"
                  value={selectedUnisenderList.utm_medium}
                  onChange={(e) => onListChange({ ...selectedUnisenderList, utm_medium: e.target.value })}
                  placeholder="newsletter"
                />
              </div>
              
              <div>
                <Label htmlFor="utm_campaign">utm_campaign</Label>
                <Input
                  id="utm_campaign"
                  value={selectedUnisenderList.utm_campaign}
                  onChange={(e) => onListChange({ ...selectedUnisenderList, utm_campaign: e.target.value })}
                  placeholder="hr_conf_2024"
                />
              </div>
              
              <div>
                <Label htmlFor="utm_term">utm_term (опционально)</Label>
                <Input
                  id="utm_term"
                  value={selectedUnisenderList.utm_term}
                  onChange={(e) => onListChange({ ...selectedUnisenderList, utm_term: e.target.value })}
                  placeholder="vip"
                />
              </div>
              
              <div className="md:col-span-2">
                <Label htmlFor="utm_content">utm_content (опционально)</Label>
                <Input
                  id="utm_content"
                  value={selectedUnisenderList.utm_content}
                  onChange={(e) => onListChange({ ...selectedUnisenderList, utm_content: e.target.value })}
                  placeholder="cta_button"
                />
              </div>
            </div>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button onClick={onLinkList}>
            Привязать список
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
