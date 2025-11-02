import { useState } from 'react';

const LIBRARY_URL = 'https://functions.poehali.dev/b5791965-754f-416c-9998-028b60051e40';
const EVENTS_MANAGER_URL = 'https://functions.poehali.dev/b56e5895-fb22-4d96-b746-b046a9fd2750';

interface UseLibraryAPIProps {
  eventId: number | null;
  toast: any;
  onUpdate?: () => void;
}

export function useLibraryAPI({ eventId, toast, onUpdate }: UseLibraryAPIProps) {
  const [loading, setLoading] = useState(false);
  const [libraryTemplates, setLibraryTemplates] = useState<any[]>([]);

  const loadLibraryTemplates = async () => {
    try {
      const response = await fetch(LIBRARY_URL);
      if (!response.ok) throw new Error('Ошибка загрузки библиотеки');
      const data = await response.json();
      setLibraryTemplates(data.templates || []);
    } catch (error: any) {
      console.error('Library load error:', error);
    }
  };

  const handleLinkLibraryTemplate = async (
    selectedLibraryTemplate: any,
    linkContentTypeId: string
  ) => {
    if (!selectedLibraryTemplate || !linkContentTypeId || !eventId) {
      toast({
        title: 'Ошибка',
        description: 'Выберите шаблон и тип контента',
        variant: 'destructive',
      });
      return false;
    }

    setLoading(true);
    try {
      const res = await fetch(EVENTS_MANAGER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'link_library_template',
          event_id: eventId,
          template_id: selectedLibraryTemplate.id,
          content_type_id: parseInt(linkContentTypeId),
        }),
      });

      const data = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }

      toast({
        title: 'Шаблон привязан',
        description: selectedLibraryTemplate.name,
      });

      if (onUpdate) onUpdate();
      return true;
    } catch (error: any) {
      toast({
        title: 'Ошибка привязки',
        description: error.message,
        variant: 'destructive',
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    libraryTemplates,
    loadLibraryTemplates,
    handleLinkLibraryTemplate,
  };
}
