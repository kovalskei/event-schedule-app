import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import { Card } from '@/components/ui/card';

interface TemplateVariable {
  id: string;
  name: string;
  description: string;
  source: string;
  startIndex: number;
  endIndex: number;
  content: string;
}

interface TemplateEditorProps {
  htmlContent: string;
  initialVariables?: TemplateVariable[];
  onSave: (variables: TemplateVariable[], annotatedHTML: string) => void;
}

export default function TemplateEditor({ htmlContent, initialVariables = [], onSave }: TemplateEditorProps) {
  const [variables, setVariables] = useState<TemplateVariable[]>(initialVariables);
  const [selectedText, setSelectedText] = useState('');
  const [selectionRange, setSelectionRange] = useState<{ start: number; end: number } | null>(null);
  const [showVariableForm, setShowVariableForm] = useState(false);
  const [editingVariable, setEditingVariable] = useState<TemplateVariable | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    setVariables(initialVariables);
  }, [initialVariables]);

  useEffect(() => {
    if (iframeRef.current && htmlContent) {
      const iframeDoc = iframeRef.current.contentDocument;
      if (iframeDoc) {
        iframeDoc.open();
        iframeDoc.write(htmlContent);
        iframeDoc.close();

        iframeDoc.addEventListener('mouseup', handleTextSelection);
        highlightVariables(iframeDoc);
      }
    }

    return () => {
      if (iframeRef.current) {
        const iframeDoc = iframeRef.current.contentDocument;
        iframeDoc?.removeEventListener('mouseup', handleTextSelection);
      }
    };
  }, [htmlContent, variables]);

  const handleTextSelection = () => {
    const iframeDoc = iframeRef.current?.contentDocument;
    if (!iframeDoc) return;

    const selection = iframeDoc.getSelection();
    if (!selection || selection.isCollapsed) return;

    const text = selection.toString().trim();
    if (!text) return;

    const range = selection.getRangeAt(0);
    const preSelectionRange = range.cloneRange();
    preSelectionRange.selectNodeContents(iframeDoc.body);
    preSelectionRange.setEnd(range.startContainer, range.startOffset);
    const start = preSelectionRange.toString().length;
    const end = start + text.length;

    setSelectedText(text);
    setSelectionRange({ start, end });
    setShowVariableForm(true);
    setEditingVariable(null);
  };

  const highlightVariables = (doc: Document) => {
    variables.forEach((variable) => {
      const bodyText = doc.body.innerText || doc.body.textContent || '';
      
      if (variable.startIndex >= 0 && variable.endIndex <= bodyText.length) {
        const range = doc.createRange();
        const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
        
        let currentOffset = 0;
        let startNode: Node | null = null;
        let startOffset = 0;
        let endNode: Node | null = null;
        let endOffset = 0;

        while (walker.nextNode()) {
          const node = walker.currentNode;
          const nodeLength = node.textContent?.length || 0;

          if (!startNode && currentOffset + nodeLength > variable.startIndex) {
            startNode = node;
            startOffset = variable.startIndex - currentOffset;
          }

          if (!endNode && currentOffset + nodeLength >= variable.endIndex) {
            endNode = node;
            endOffset = variable.endIndex - currentOffset;
            break;
          }

          currentOffset += nodeLength;
        }

        if (startNode && endNode) {
          try {
            range.setStart(startNode, startOffset);
            range.setEnd(endNode, endOffset);

            const span = doc.createElement('span');
            span.style.backgroundColor = '#fef3c7';
            span.style.borderBottom = '2px solid #f59e0b';
            span.style.cursor = 'pointer';
            span.title = `${variable.name}: ${variable.description}`;
            span.dataset.variableId = variable.id;
            
            span.addEventListener('click', (e) => {
              e.preventDefault();
              handleEditVariable(variable);
            });

            range.surroundContents(span);
          } catch (err) {
            console.error('Failed to highlight variable:', err);
          }
        }
      }
    });
  };

  const handleAddVariable = (formData: { name: string; description: string; source: string }) => {
    if (!selectionRange || !selectedText) return;

    const newVariable: TemplateVariable = {
      id: `var_${Date.now()}`,
      name: formData.name,
      description: formData.description,
      source: formData.source,
      startIndex: selectionRange.start,
      endIndex: selectionRange.end,
      content: selectedText,
    };

    setVariables([...variables, newVariable]);
    setShowVariableForm(false);
    setSelectedText('');
    setSelectionRange(null);
  };

  const handleEditVariable = (variable: TemplateVariable) => {
    setEditingVariable(variable);
    setShowVariableForm(true);
  };

  const handleUpdateVariable = (formData: { name: string; description: string; source: string }) => {
    if (!editingVariable) return;

    setVariables(variables.map(v => 
      v.id === editingVariable.id 
        ? { ...v, ...formData }
        : v
    ));
    setShowVariableForm(false);
    setEditingVariable(null);
  };

  const handleDeleteVariable = (id: string) => {
    setVariables(variables.filter(v => v.id !== id));
    if (editingVariable?.id === id) {
      setShowVariableForm(false);
      setEditingVariable(null);
    }
  };

  const handleSaveTemplate = () => {
    const annotatedHTML = htmlContent;
    onSave(variables, annotatedHTML);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
      <div className="flex flex-col gap-4">
        <div className="bg-white rounded-lg border p-4">
          <h3 className="font-semibold mb-2 flex items-center gap-2">
            <Icon name="Code" size={20} />
            HTML Шаблон (выделите текст для разметки)
          </h3>
          <div className="border rounded overflow-hidden" style={{ height: '500px' }}>
            <iframe
              ref={iframeRef}
              className="w-full h-full"
              title="HTML Preview"
              sandbox="allow-same-origin"
            />
          </div>
        </div>

        {showVariableForm && (
          <VariableForm
            initialData={editingVariable}
            selectedText={selectedText}
            existingVariables={variables}
            onSubmit={editingVariable ? handleUpdateVariable : handleAddVariable}
            onCancel={() => {
              setShowVariableForm(false);
              setEditingVariable(null);
            }}
            onDelete={editingVariable ? () => handleDeleteVariable(editingVariable.id) : undefined}
          />
        )}
      </div>

      <div className="flex flex-col gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Icon name="Tags" size={20} />
              Размеченные переменные ({variables.length})
            </h3>
            <Button onClick={handleSaveTemplate} disabled={variables.length === 0}>
              <Icon name="Save" size={18} className="mr-2" />
              Сохранить шаблон
            </Button>
          </div>

          {variables.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Icon name="MousePointer2" size={48} className="mx-auto mb-3 opacity-50" />
              <p>Выделите текст в шаблоне слева, чтобы создать переменную</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {variables.map((variable) => (
                <Card
                  key={variable.id}
                  className="p-3 cursor-pointer hover:border-amber-400 transition-colors"
                  onClick={() => handleEditVariable(variable)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="font-mono text-sm font-semibold text-purple-600">
                        {'{{'}{variable.name}{'}}'}
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{variable.description}</p>
                      <div className="text-xs text-gray-500 mt-2">
                        <span className="font-medium">Источник:</span> {variable.source}
                      </div>
                      <div className="text-xs text-gray-400 mt-1 bg-gray-50 p-2 rounded border">
                        "{variable.content.substring(0, 60)}..."
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteVariable(variable.id);
                      }}
                    >
                      <Icon name="Trash2" size={16} />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

interface VariableFormProps {
  initialData: TemplateVariable | null;
  selectedText: string;
  existingVariables: TemplateVariable[];
  onSubmit: (data: { name: string; description: string; source: string }) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

function VariableForm({ initialData, selectedText, existingVariables, onSubmit, onCancel, onDelete }: VariableFormProps) {
  const [mode, setMode] = useState<'new' | 'existing'>(initialData ? 'new' : 'new');
  const [selectedExistingVar, setSelectedExistingVar] = useState<string>('');
  const [name, setName] = useState(initialData?.name || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [source, setSource] = useState(initialData?.source || 'user_input');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (mode === 'existing' && selectedExistingVar) {
      const existingVar = existingVariables.find(v => v.id === selectedExistingVar);
      if (existingVar) {
        onSubmit({ 
          name: existingVar.name, 
          description: existingVar.description, 
          source: existingVar.source 
        });
      }
      return;
    }
    
    if (!name || !description) return;
    onSubmit({ name, description, source });
  };

  const availableVariables = existingVariables.filter(v => v.id !== initialData?.id);

  return (
    <Card className="p-4 border-2 border-purple-300 bg-purple-50">
      <h4 className="font-semibold mb-3 flex items-center gap-2">
        <Icon name="Settings" size={18} />
        {initialData ? 'Редактировать переменную' : 'Новая переменная'}
      </h4>

      {!initialData && selectedText && (
        <div className="mb-3 p-2 bg-white rounded border text-sm">
          <span className="font-medium text-gray-600">Выбранный текст:</span>
          <div className="mt-1 text-gray-800">"{selectedText.substring(0, 100)}..."</div>
        </div>
      )}

      {!initialData && availableVariables.length > 0 && (
        <div className="mb-4 flex gap-2">
          <Button
            type="button"
            variant={mode === 'new' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setMode('new')}
            className="flex-1"
          >
            <Icon name="Plus" size={16} className="mr-2" />
            Создать новую
          </Button>
          <Button
            type="button"
            variant={mode === 'existing' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setMode('existing')}
            className="flex-1"
          >
            <Icon name="Copy" size={16} className="mr-2" />
            Использовать существующую
          </Button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        {mode === 'existing' && availableVariables.length > 0 ? (
          <div>
            <Label htmlFor="existing-var">Выберите переменную</Label>
            <select
              id="existing-var"
              value={selectedExistingVar}
              onChange={(e) => setSelectedExistingVar(e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
              required
            >
              <option value="">-- Выберите --</option>
              {availableVariables.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} — {v.description.substring(0, 50)}...
                </option>
              ))}
            </select>
            {selectedExistingVar && (
              <div className="mt-2 p-2 bg-blue-50 rounded border border-blue-200 text-sm">
                <div className="font-medium text-blue-900">
                  {availableVariables.find(v => v.id === selectedExistingVar)?.name}
                </div>
                <div className="text-blue-700 mt-1">
                  {availableVariables.find(v => v.id === selectedExistingVar)?.description}
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
        <div>
          <Label htmlFor="var-name">Имя переменной</Label>
          <Input
            id="var-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="event_title"
            required
          />
        </div>

        <div>
          <Label htmlFor="var-desc">Описание для ИИ (что генерировать)</Label>
          <Textarea
            id="var-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Название мероприятия из базы знаний. Пример: Конференция HR Tech 2024"
            rows={3}
            required
          />
        </div>

        <div>
          <Label htmlFor="var-source">Источник данных</Label>
          <select
            id="var-source"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="w-full px-3 py-2 border rounded-md"
          >
            <option value="user_input">Ввод пользователя</option>
            <option value="knowledge_base">База знаний</option>
            <option value="ai_generated">Генерация ИИ</option>
            <option value="database">База данных</option>
          </select>
        </div>
        </>
        )}

        <div className="flex gap-2 pt-2">
          <Button type="submit" className="flex-1">
            <Icon name="Check" size={18} className="mr-2" />
            {mode === 'existing' ? 'Применить' : initialData ? 'Обновить' : 'Добавить'}
          </Button>
          <Button type="button" variant="outline" onClick={onCancel}>
            Отмена
          </Button>
          {onDelete && (
            <Button type="button" variant="destructive" onClick={onDelete}>
              <Icon name="Trash2" size={18} />
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
}