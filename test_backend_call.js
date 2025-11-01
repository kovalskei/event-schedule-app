const html_content = `<!DOCTYPE html>
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

async function testBackend() {
  try {
    const response = await fetch('https://functions.poehali.dev/616d6890-24c3-49c8-8b29-692dd342933b', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ html_content })
    });

    const data = await response.json();
    console.log(JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testBackend();
