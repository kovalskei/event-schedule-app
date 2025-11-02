import { useState } from 'react';
import { toast as sonnerToast } from 'sonner';
import { Event, EVENTS_MANAGER_URL, IMAGE_UPLOADER_URL, INDEX_KNOWLEDGE_URL } from '../types';

interface UseEventAPIProps {
  eventId: number | null;
  toast: any;
  onUpdate?: () => void;
}

export function useEventAPI({ eventId, toast, onUpdate }: UseEventAPIProps) {
  const [loading, setLoading] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [indexing, setIndexing] = useState(false);
  const [event, setEvent] = useState<Event | null>(null);

  const loadEventSettings = async () => {
    if (!eventId) return { event: null, content_types: [], email_templates: [] };
    
    setLoading(true);
    try {
      const res = await fetch(`${EVENTS_MANAGER_URL}?action=get_event&event_id=${eventId}`);
      const data = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setEvent(data.event);
      return {
        event: data.event,
        content_types: data.content_types || [],
        email_templates: data.email_templates || [],
      };
    } catch (error: any) {
      toast({
        title: 'Ошибка загрузки',
        description: error.message,
        variant: 'destructive',
      });
      return { event: null, content_types: [], email_templates: [] };
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateEvent = async (eventData: Event) => {
    if (!eventData) return;

    setLoading(true);
    try {
      const res = await fetch(EVENTS_MANAGER_URL, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_event',
          event_id: eventData.id,
          ...eventData,
        }),
      });

      const data = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }

      toast({
        title: 'Настройки обновлены',
        description: 'Изменения сохранены',
      });

      if (onUpdate) onUpdate();
    } catch (error: any) {
      toast({
        title: 'Ошибка обновления',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleIndexKnowledge = async () => {
    if (!eventId) return;
    
    setIndexing(true);
    try {
      const res = await fetch(INDEX_KNOWLEDGE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: eventId }),
      });
      
      const data = await res.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      sonnerToast.success(`Проиндексировано ${data.indexed_count} элементов знаний`);
    } catch (error: any) {
      sonnerToast.error(`Ошибка индексации: ${error.message}`);
    } finally {
      setIndexing(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>, currentEvent: Event) => {
    const file = e.target.files?.[0];
    if (!file || !currentEvent) return;

    if (!file.type.startsWith('image/')) {
      sonnerToast.error('Пожалуйста, выберите изображение');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      sonnerToast.error('Размер файла не должен превышать 2 МБ');
      return;
    }

    setLogoUploading(true);

    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        
        try {
          const uploadRes = await fetch(IMAGE_UPLOADER_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              image: base64,
              filename: file.name,
            }),
          });

          const uploadData = await uploadRes.json();

          if (uploadData.error) {
            throw new Error(uploadData.error);
          }

          const imageUrl = uploadData.url;
          setEvent({ ...currentEvent, logo_url: imageUrl });

          const updateRes = await fetch(EVENTS_MANAGER_URL, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'update_event',
              event_id: currentEvent.id,
              logo_url: imageUrl,
            }),
          });

          const updateData = await updateRes.json();

          if (updateData.error) {
            throw new Error(updateData.error);
          }

          sonnerToast.success('Логотип загружен и сохранён');
          if (onUpdate) onUpdate();
        } catch (error: any) {
          sonnerToast.error(error.message || 'Ошибка загрузки логотипа');
        } finally {
          setLogoUploading(false);
        }
      };
      reader.onerror = () => {
        sonnerToast.error('Ошибка чтения файла');
        setLogoUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      sonnerToast.error('Ошибка загрузки логотипа');
      setLogoUploading(false);
    }
  };

  return {
    loading,
    logoUploading,
    indexing,
    event,
    setEvent,
    loadEventSettings,
    handleUpdateEvent,
    handleIndexKnowledge,
    handleLogoUpload,
  };
}
