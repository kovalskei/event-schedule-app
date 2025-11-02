import { useState } from 'react';
import { ContentType, EVENTS_MANAGER_URL } from '../types';

interface UseContentTypesAPIProps {
  eventId: number | null;
  toast: any;
  onUpdate?: () => void;
}

export function useContentTypesAPI({ eventId, toast, onUpdate }: UseContentTypesAPIProps) {
  const [loading, setLoading] = useState(false);
  const [contentTypes, setContentTypes] = useState<ContentType[]>([]);

  const handleCreateContentType = async (
    newContentType: { name: string; description: string; cta_urls: Array<{ label: string; url: string }> },
    editingContentType: ContentType | null
  ) => {
    if (!newContentType.name || !eventId) {
      toast({
        title: 'Ошибка',
        description: 'Укажите название типа контента',
        variant: 'destructive',
      });
      return false;
    }

    setLoading(true);
    try {
      const action = editingContentType ? 'update_content_type' : 'create_content_type';
      const body: any = {
        action,
        event_id: eventId,
        ...newContentType,
      };

      if (editingContentType) {
        body.content_type_id = editingContentType.id;
      }

      const res = await fetch(EVENTS_MANAGER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }

      toast({
        title: editingContentType ? 'Тип контента обновлён' : 'Тип контента создан',
        description: newContentType.name,
      });

      if (onUpdate) onUpdate();
      return true;
    } catch (error: any) {
      toast({
        title: editingContentType ? 'Ошибка обновления' : 'Ошибка создания',
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
    contentTypes,
    setContentTypes,
    handleCreateContentType,
  };
}
