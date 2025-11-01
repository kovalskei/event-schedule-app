import { useState } from 'react';

const TemplateTest = () => {
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);

  const testHTML = `<!DOCTYPE html>
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

  const testConversion = async () => {
    setLoading(true);
    setOutput('⏳ Отправляю запрос...');

    try {
      const response = await fetch('https://functions.poehali.dev/616d6890-24c3-49c8-8b29-692dd342933b', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          html_content: testHTML
        })
      });

      const data = await response.json();
      const template = data.template_content || '';

      const checks = [
        {
          name: 'Градиент в <style> (135deg)',
          passed: template.includes('linear-gradient(135deg, #667eea 0%, #764ba2 100%)')
        },
        {
          name: 'Градиент в table inline (135deg)',
          passed: template.includes('style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%)')
        },
        {
          name: 'Градиент в ссылке (90deg)',
          passed: template.includes('linear-gradient(90deg, #667eea, #764ba2)')
        },
        {
          name: 'box-shadow сохранён',
          passed: template.includes('box-shadow: 0 4px 6px rgba(0,0,0,0.1)')
        },
        {
          name: 'border-radius сохранён',
          passed: template.includes('border-radius: 12px')
        }
      ];

      const allPassed = checks.every(c => c.passed);
      
      let result = `📊 РЕЗУЛЬТАТЫ ПРОВЕРКИ:\n\n`;
      checks.forEach(check => {
        result += `${check.passed ? '✅' : '❌'} ${check.name}\n`;
      });
      result += `\n${allPassed ? '🎉 ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ!' : '⚠️ ЕСТЬ ПРОБЛЕМЫ'}\n\n`;
      result += `📄 ПОЛНЫЙ ОТВЕТ:\n${JSON.stringify(data, null, 2)}`;

      setOutput(result);
    } catch (error: any) {
      setOutput(`❌ Ошибка: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">🧪 Template Generator Test</h1>
        
        <button
          onClick={testConversion}
          disabled={loading}
          className="bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white px-6 py-3 rounded-lg font-semibold hover:opacity-90 disabled:opacity-50"
        >
          {loading ? 'Тестирую...' : 'Запустить тест'}
        </button>

        {output && (
          <pre className="mt-6 bg-white p-6 rounded-lg shadow-sm whitespace-pre-wrap font-mono text-sm overflow-auto max-h-[600px]">
            {output}
          </pre>
        )}
      </div>
    </div>
  );
};

export default TemplateTest;
