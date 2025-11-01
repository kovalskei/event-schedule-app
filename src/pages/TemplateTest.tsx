import { useState } from 'react';
import { Upload } from 'lucide-react';
import Icon from '@/components/ui/icon';

const TemplateTest = () => {
  const [originalHTML, setOriginalHTML] = useState('');
  const [convertedHTML, setConvertedHTML] = useState('');
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState('');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setOriginalHTML(content);
      setConvertedHTML('');
    };
    reader.readAsText(file);
  };

  const handleConvert = async () => {
    if (!originalHTML) return;

    setLoading(true);
    try {
      const response = await fetch('https://functions.poehali.dev/616d6890-24c3-49c8-8b29-692dd342933b', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          html_content: originalHTML,
          test_mode: true
        })
      });

      const data = await response.json();
      setConvertedHTML(data.template_content || '');
    } catch (error: any) {
      alert(`Ошибка: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">🧪 Преобразователь HTML в Mustache</h1>
        
        <div className="mb-6 flex gap-4 items-center">
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
            onClick={handleConvert}
            disabled={loading || !originalHTML}
            className="bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white px-6 py-3 rounded-lg font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Преобразую...' : 'Преобразовать'}
          </button>
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