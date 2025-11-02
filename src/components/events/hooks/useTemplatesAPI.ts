import { useState } from 'react';
import { toast as sonnerToast } from 'sonner';
import { EmailTemplate, EVENTS_MANAGER_URL, TEMPLATE_GENERATOR_URL } from '../types';

interface UseTemplatesAPIProps {
  eventId: number | null;
  toast: any;
  onUpdate?: () => void;
}

export function useTemplatesAPI({ eventId, toast, onUpdate }: UseTemplatesAPIProps) {
  const [loading, setLoading] = useState(false);
  const [generatingTemplate, setGeneratingTemplate] = useState(false);
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);

  const handleCreateTemplate = async (newTemplate: {
    content_type_id: string;
    name: string;
    html_template: string;
    subject_template: string;
    instructions: string;
  }) => {
    if (!newTemplate.content_type_id || !newTemplate.name || !newTemplate.html_template || !eventId) {
      toast({
        title: 'Ошибка',
        description: 'Заполните обязательные поля',
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
          action: 'create_email_template',
          event_id: eventId,
          ...newTemplate,
        }),
      });

      const data = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }

      toast({
        title: 'Шаблон создан',
        description: newTemplate.name,
      });

      if (onUpdate) onUpdate();
      return true;
    } catch (error: any) {
      toast({
        title: 'Ошибка создания шаблона',
        description: error.message,
        variant: 'destructive',
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateTemplate = async (
    editingTemplate: EmailTemplate,
    newTemplate: {
      content_type_id: string;
      name: string;
      html_template: string;
      subject_template: string;
      instructions: string;
    }
  ) => {
    if (!editingTemplate || !eventId) {
      console.log('❌ Cannot update: editingTemplate or eventId missing', { editingTemplate, eventId });
      return false;
    }

    console.log('🔄 Updating template:', { template_id: editingTemplate.id, newTemplate });
    setLoading(true);
    try {
      const requestBody = {
        action: 'update_email_template',
        template_id: editingTemplate.id,
        ...newTemplate,
      };
      console.log('📤 Request body:', requestBody);
      
      const res = await fetch(EVENTS_MANAGER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const data = await res.json();
      console.log('📥 Response:', data);

      if (data.error) {
        console.error('❌ Error from backend:', data.error);
        throw new Error(data.error);
      }

      console.log('✅ Template updated successfully');
      toast({
        title: 'Шаблон обновлён',
        description: newTemplate.name,
      });

      if (onUpdate) onUpdate();
      return true;
    } catch (error: any) {
      toast({
        title: 'Ошибка обновления шаблона',
        description: error.message,
        variant: 'destructive',
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTemplate = async (templateId: number, templateName: string) => {
    const confirmed = window.confirm(
      `Удалить шаблон "${templateName}"?\n\nЭто действие нельзя отменить.`
    );
    
    if (!confirmed) return false;

    setLoading(true);
    try {
      const res = await fetch(EVENTS_MANAGER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete_email_template',
          template_id: templateId,
        }),
      });

      const data = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }

      toast({
        title: 'Шаблон удалён',
        description: templateName,
      });

      if (onUpdate) onUpdate();
      return true;
    } catch (error: any) {
      toast({
        title: 'Ошибка удаления',
        description: error.message,
        variant: 'destructive',
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateTemplate = async (
    newTemplate: {
      content_type_id: string;
      name: string;
      html_template: string;
      subject_template: string;
      instructions: string;
    },
    editingTemplate: EmailTemplate | null
  ) => {
    if (!newTemplate.html_template) {
      sonnerToast.error('Вставьте HTML для преобразования');
      return false;
    }

    if (!newTemplate.content_type_id || !newTemplate.name) {
      sonnerToast.error('Укажите тип контента и название шаблона');
      return false;
    }

    setGeneratingTemplate(true);
    try {
      const requestBody = { 
        html_content: newTemplate.html_template,
        event_id: eventId,
        content_type_id: parseInt(newTemplate.content_type_id),
        name: newTemplate.name + ' (со слотами)'
      };
      
      console.log('[FRONTEND] Sending to template-generator:', {
        html_length: requestBody.html_content?.length || 0,
        html_preview: requestBody.html_content?.substring(0, 200) || 'EMPTY',
        event_id: requestBody.event_id,
        content_type_id: requestBody.content_type_id
      });
      
      const res = await fetch(TEMPLATE_GENERATOR_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const data = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }

      sonnerToast.success(editingTemplate ? 'Шаблон преобразован!' : 'Новый шаблон создан!', {
        description: `Оригинал сохранён как пример для валидации. ${data.notes || ''}`,
      });

      if (onUpdate) onUpdate();
      return true;
    } catch (error: any) {
      sonnerToast.error(`Ошибка генерации: ${error.message}`);
      return false;
    } finally {
      setGeneratingTemplate(false);
    }
  };

  return {
    loading,
    generatingTemplate,
    emailTemplates,
    setEmailTemplates,
    handleCreateTemplate,
    handleUpdateTemplate,
    handleDeleteTemplate,
    handleGenerateTemplate,
  };
}
