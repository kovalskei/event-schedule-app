import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { mockSessions } from './types';

interface SessionFiltersProps {
  selectedTags: string[];
  onTagToggle: (tag: string) => void;
  filtersOpen: boolean;
  onFiltersToggle: () => void;
}

export default function SessionFilters({ selectedTags, onTagToggle, filtersOpen, onFiltersToggle }: SessionFiltersProps) {
  const allTags = Array.from(new Set(mockSessions.flatMap(s => s.tags))).sort();

  return (
    <Collapsible open={filtersOpen} onOpenChange={onFiltersToggle}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Фильтры</h3>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm">
            <Icon name={filtersOpen ? 'ChevronUp' : 'ChevronDown'} className="w-4 h-4" />
          </Button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent>
        <div className="space-y-3 mb-4">
          <div>
            <p className="text-sm font-medium mb-2">Теги</p>
            <div className="flex flex-wrap gap-2">
              {allTags.map(tag => (
                <Badge
                  key={tag}
                  variant={selectedTags.includes(tag) ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => onTagToggle(tag)}
                >
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
          {selectedTags.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => selectedTags.forEach(tag => onTagToggle(tag))}
            >
              <Icon name="X" className="w-3 h-3 mr-1" />
              Очистить фильтры
            </Button>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
