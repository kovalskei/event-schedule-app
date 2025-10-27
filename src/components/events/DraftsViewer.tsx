import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const EVENTS_MANAGER_URL = 'https://functions.poehali.dev/b56e5895-fb22-4d96-b746-b046a9fd2750';

interface Draft {
  id: number;
  subject: string;
  html_content: string;
  status: string;
  created_at: string;
  content_type_name?: string;
}

interface DraftsViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventListId: number | null;
  listName: string;
}

export default function DraftsViewer({ open, onOpenChange, eventListId, listName }: DraftsViewerProps) {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [selectedDraft, setSelectedDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);

  useEffect(() => {
    if (open && eventListId) {
      loadDrafts();
    }
  }, [open, eventListId]);

  const loadDrafts = async () => {
    if (!eventListId) return;

    setLoading(true);
    try {
      const response = await fetch(
        `${EVENTS_MANAGER_URL}?action=get_drafts&event_list_id=${eventListId}`
      );
      const data = await response.json();
      setDrafts(data.drafts || []);
      if (data.drafts?.length > 0) {
        setSelectedDraft(data.drafts[0]);
      }
    } catch (error) {
      console.error('Failed to load drafts:', error);
      toast.error('Ошибка загрузки черновиков');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDraft = async (draftId: number) => {
    setDeleting(true);
    try {
      const response = await fetch(
        `${EVENTS_MANAGER_URL}?action=delete_draft&draft_id=${draftId}`,
        { method: 'DELETE' }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Ошибка удаления');
      }

      toast.success('Черновик удалён');
      setSelectedDraft(null);
      loadDrafts();
    } catch (error: any) {
      toast.error(error.message || 'Ошибка удаления черновика');
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteAll = async () => {
    if (!eventListId) return;

    setDeleting(true);
    try {
      const response = await fetch(
        `${EVENTS_MANAGER_URL}?action=delete_all_drafts&list_id=${eventListId}`,
        { method: 'DELETE' }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Ошибка удаления');
      }

      toast.success(`Удалено черновиков: ${data.count || 0}`);
      setSelectedDraft(null);
      setDeleteAllOpen(false);
      loadDrafts();
    } catch (error: any) {
      toast.error(error.message || 'Ошибка удаления черновиков');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>Черновики писем — {listName}</DialogTitle>
              <DialogDescription>
                Просмотр сгенерированных писем для списка рассылки
              </DialogDescription>
            </div>
            {drafts.length > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setDeleteAllOpen(true)}
                disabled={deleting}
              >
                <Icon name="Trash2" className="w-4 h-4 mr-2" />
                Удалить все
              </Button>
            )}
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Icon name="Loader2" className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : drafts.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Icon name="Inbox" className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Нет черновиков</p>
            <p className="text-sm mt-1">Создайте черновики в настройках списка рассылки</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4 flex-1 min-h-0">
            {/* Список черновиков */}
            <ScrollArea className="col-span-1 border rounded-lg">
              <div className="p-2 space-y-2">
                {drafts.map((draft) => (
                  <div
                    key={draft.id}
                    className={`p-3 rounded-lg cursor-pointer transition-colors ${
                      selectedDraft?.id === draft.id
                        ? 'bg-blue-50 border-blue-200 border'
                        : 'hover:bg-gray-50 border border-transparent'
                    }`}
                    onClick={() => setSelectedDraft(draft)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <Badge variant="outline" className="text-xs">
                        {draft.status}
                      </Badge>
                      <span className="text-xs text-gray-500">
                        {new Date(draft.created_at).toLocaleDateString('ru-RU')}
                      </span>
                    </div>
                    <div className="font-medium text-sm line-clamp-2">{draft.subject}</div>
                    {draft.content_type_name && (
                      <div className="text-xs text-gray-500 mt-1">{draft.content_type_name}</div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>

            {/* Предпросмотр */}
            <div className="col-span-2 border rounded-lg flex flex-col overflow-hidden">
              {selectedDraft ? (
                <>
                  <div className="p-4 border-b bg-gray-50 flex-shrink-0">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="secondary">{selectedDraft.status}</Badge>
                          {selectedDraft.content_type_name && (
                            <Badge variant="outline">{selectedDraft.content_type_name}</Badge>
                          )}
                        </div>
                        <div className="font-medium text-sm text-gray-600">Тема:</div>
                        <div className="font-semibold">{selectedDraft.subject}</div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline">
                          <Icon name="Edit" className="w-4 h-4 mr-2" />
                          Редактировать
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeleteDraft(selectedDraft.id)}
                          disabled={deleting}
                        >
                          <Icon name="Trash2" className="w-4 h-4 mr-2" />
                          Удалить
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4">
                    <div
                      className="prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: selectedDraft.html_content }}
                    />
                  </div>

                  <div className="p-4 border-t bg-gray-50 flex items-center justify-between flex-shrink-0">
                    <div className="text-sm text-gray-500">
                      Создано: {new Date(selectedDraft.created_at).toLocaleString('ru-RU')}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline">
                        <Icon name="Send" className="w-4 h-4 mr-2" />
                        Тест
                      </Button>
                      <Button size="sm">
                        <Icon name="Check" className="w-4 h-4 mr-2" />
                        Утвердить
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-gray-400">
                  Выберите черновик для просмотра
                </div>
              )}
            </div>
          </div>
        )}

        <AlertDialog open={deleteAllOpen} onOpenChange={setDeleteAllOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Удалить все черновики?</AlertDialogTitle>
              <AlertDialogDescription>
                Будут удалены все {drafts.length} черновиков для этого списка рассылки.
                Это действие необратимо.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Отмена</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteAll}
                disabled={deleting}
                className="bg-red-600 hover:bg-red-700"
              >
                {deleting ? 'Удаление...' : 'Удалить все'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}