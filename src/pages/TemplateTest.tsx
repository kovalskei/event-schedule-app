import { useState } from 'react';
import Icon from '@/components/ui/icon';

const DEMO_HTML = `<!DOCTYPE html>
<html>
<head>
<style>
.gradient-header {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    padding: 40px;
}
.stats-card {
    border: 2px solid #e5e7eb;
    border-radius: 12px;
    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
}
</style>
</head>
<body>
<table width="600" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
  <tr>
    <td style="padding: 40px; text-align: center;">
      <h1 style="color: #ffffff; font-size: 32px; margin: 0;">Революция в HR-подборе</h1>
      <p style="color: #f3f4f6; font-size: 18px; margin-top: 16px;">
        Увеличьте скорость найма на 300% с помощью ИИ-ассистента
      </p>
    </td>
  </tr>
</table>

<table width="600" style="margin-top: 32px;">
  <tr>
    <td class="stats-card" style="padding: 24px; border: 2px solid #e5e7eb; border-radius: 12px;">
      <h2 style="color: #1f2937; font-size: 48px; margin: 0;">2,500+</h2>
      <p style="color: #6b7280; font-size: 16px;">HR-менеджеров уже используют</p>
    </td>
  </tr>
</table>

<table width="600" style="margin-top: 24px;">
  <tr>
    <td style="text-align: center; padding: 16px;">
      <a href="https://example.com/demo" style="background: linear-gradient(90deg, #667eea, #764ba2); color: white; padding: 16px 32px; border-radius: 8px; text-decoration: none; display: inline-block; font-weight: bold;">
        Начать использовать бесплатно
      </a>
    </td>
  </tr>
</table>
</body>
</html>`;

const TemplateTest = () => {
  const [originalHTML, setOriginalHTML] = useState('');
  const [convertedHTML, setConvertedHTML] = useState('');
  const [variables, setVariables] = useState<Record<string, any>>({});
  const [slotsSchema, setSlotsSchema] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState('');
  const [mode, setMode] = useState<'regex' | 'hybrid' | 'legacy'>('regex');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      
      if (content.length > 15000) {
        alert('⚠️ Файл слишком большой (>15KB). O1-mini может не успеть обработать за 60 секунд.\n\nПопробуйте упростить HTML или используйте меньший файл.');
      }
      
      setOriginalHTML(content);
      setConvertedHTML('');
    };
    reader.readAsText(file);
  };

  const handleConvert = async () => {
    if (!originalHTML) return;

    setLoading(true);
    setConvertedHTML('');
    try {
      const response = await fetch('https://functions.poehali.dev/616d6890-24c3-49c8-8b29-692dd342933b', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          html_content: originalHTML,
          test_mode: true,
          use_ai: mode === 'legacy',
          hybrid_ai: mode === 'hybrid'
        })
      });

      if (!response.ok) {
        throw new Error(`Ошибка сервера: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      setConvertedHTML(data.template || data.template_content || '');
      setVariables(data.variables || {});
      setSlotsSchema(data.slots_schema || {});
    } catch (error: any) {
      alert(`Ошибка преобразования: ${error.message}\n\nВозможно файл слишком большой (>20KB). Попробуйте меньший файл.`);
      console.error('Conversion error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">🧪 Преобразователь HTML в Mustache</h1>
        
        <div className="mb-6 flex gap-4 items-center flex-wrap">
          <label className="bg-white border-2 border-dashed border-gray-300 rounded-lg px-6 py-3 cursor-pointer hover:border-purple-500 transition-colors flex items-center gap-2">
            <Icon name="Upload" size={20} />
            <span className="font-medium">{fileName || 'Загрузить HTML файл'}</span>
            <input 
              type="file" 
              accept=".html,.htm" 
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>

          <button
            onClick={() => {
              setOriginalHTML(DEMO_HTML);
              setFileName('demo.html');
              setConvertedHTML('');
            }}
            className="bg-white border-2 border-gray-300 text-gray-700 px-6 py-3 rounded-lg font-semibold hover:border-gray-400 transition-colors"
          >
            📋 Загрузить демо
          </button>

          <div className="flex items-center gap-2 bg-white border-2 border-gray-300 px-4 py-2 rounded-lg">
            <span className="text-sm font-medium text-gray-600">Режим:</span>
            <div className="flex gap-1">
              <button
                onClick={() => setMode('regex')}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  mode === 'regex' 
                    ? 'bg-purple-600 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                ⚡ Regex
              </button>
              <button
                onClick={() => setMode('hybrid')}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  mode === 'hybrid' 
                    ? 'bg-purple-600 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                🧠 Hybrid AI
              </button>
              <button
                onClick={() => setMode('legacy')}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  mode === 'legacy' 
                    ? 'bg-purple-600 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                🤖 Legacy AI
              </button>
            </div>
          </div>

          <button
            onClick={handleConvert}
            disabled={loading || !originalHTML}
            className="bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white px-6 py-3 rounded-lg font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '⏳ Преобразую...' : '⚡ Преобразовать'}
          </button>
          
          {loading && (
            <span className="text-sm text-gray-500">
              {mode === 'regex' && '⚡ Быстрая regex-замена...'}
              {mode === 'hybrid' && '🧠 AI анализ + regex замена...'}
              {mode === 'legacy' && '🤖 Полная генерация через AI...'}
            </span>
          )}
          
          <div className="w-full text-xs text-gray-500 bg-gray-100 px-3 py-2 rounded">
            {mode === 'regex' && '⚡ Regex: мгновенно, бесплатно, находит циклы автоматически'}
            {mode === 'hybrid' && '🧠 Hybrid AI: AI анализирует → regex применяет (быстрее Legacy, точнее Regex)'}
            {mode === 'legacy' && '🤖 Legacy AI: полная генерация кода через Claude (медленно, дорого)'}
          </div>
        </div>

        {originalHTML && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">📄 Оригинальный HTML</h2>
              
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <div className="bg-gray-100 px-4 py-2 border-b border-gray-200">
                  <span className="text-sm font-medium text-gray-600">Код</span>
                </div>
                <pre className="p-4 text-xs overflow-auto max-h-[300px] font-mono">
                  {originalHTML}
                </pre>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <div className="bg-gray-100 px-4 py-2 border-b border-gray-200">
                  <span className="text-sm font-medium text-gray-600">Превью</span>
                </div>
                <div className="p-4 overflow-auto max-h-[400px]">
                  <iframe
                    srcDoc={originalHTML}
                    className="w-full h-[400px] border-0"
                    title="Original Preview"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-xl font-semibold">✨ Преобразованный Mustache</h2>
              
              {convertedHTML ? (
                <>
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <div className="bg-gray-100 px-4 py-2 border-b border-gray-200">
                      <span className="text-sm font-medium text-gray-600">Код с переменными</span>
                    </div>
                    <pre className="p-4 text-xs overflow-auto max-h-[300px] font-mono">
                      {convertedHTML}
                    </pre>
                  </div>

                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <div className="bg-gray-100 px-4 py-2 border-b border-gray-200">
                      <span className="text-sm font-medium text-gray-600">Превью (с переменными)</span>
                    </div>
                    <div className="p-4 overflow-auto max-h-[400px]">
                      <iframe
                        srcDoc={convertedHTML}
                        className="w-full h-[400px] border-0"
                        title="Converted Preview"
                      />
                    </div>
                  </div>

                  {Object.keys(variables).length > 0 && (
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                      <div className="bg-gray-100 px-4 py-2 border-b border-gray-200">
                        <span className="text-sm font-medium text-gray-600">📋 Переменные ({Object.keys(variables).length})</span>
                      </div>
                      <div className="p-4 overflow-auto max-h-[300px]">
                        <table className="w-full text-sm">
                          <thead className="border-b">
                            <tr className="text-left">
                              <th className="pb-2 font-semibold">Имя</th>
                              <th className="pb-2 font-semibold">Значение</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Object.entries(variables).map(([key, value]) => (
                              <tr key={key} className="border-b last:border-0">
                                <td className="py-2 font-mono text-purple-600">{`{{ ${key} }}`}</td>
                                <td className="py-2 text-gray-700">
                                  {typeof value === 'object' ? (
                                    <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                                      {Array.isArray(value) ? `Массив (${value.length})` : 'Объект'}
                                    </span>
                                  ) : (
                                    <span className="truncate block max-w-xs">{String(value)}</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {Object.keys(slotsSchema).length > 0 && (
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                      <div className="bg-gray-100 px-4 py-2 border-b border-gray-200">
                        <span className="text-sm font-medium text-gray-600">🗂️ Slots Schema</span>
                      </div>
                      <div className="p-4">
                        <pre className="text-xs font-mono bg-gray-50 p-3 rounded overflow-auto">
                          {JSON.stringify(slotsSchema, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center text-gray-400">
                  Нажмите "Преобразовать" чтобы увидеть результат
                </div>
              )}
            </div>
          </div>
        )}

        {!originalHTML && (
          <div className="bg-white rounded-lg shadow-sm border-2 border-dashed border-gray-300 p-12 text-center">
            <Icon name="Upload" size={48} className="mx-auto mb-4 text-gray-400" />
            <p className="text-gray-500 text-lg">Загрузите HTML файл чтобы начать</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TemplateTest;