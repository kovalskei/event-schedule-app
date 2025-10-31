-- Обновляем шаблон "Продажа через боль" с правильной структурой слотов
UPDATE t_p22819116_event_schedule_app.email_templates 
SET 
  html_layout = '<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Human Конференция</title>
</head>
<body style="margin:0; padding:0; font-family: Arial, sans-serif; background-color:#FFF9F2;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" style="background: #FFFFFF; border-radius: 8px; overflow: hidden;">
          <tr>
            <td style="padding: 40px;">
              <h1 style="margin: 0 0 20px; font-size: 32px; color: #333; line-height: 1.2;">{{headline}}</h1>
              <p style="margin: 0 0 30px; font-size: 16px; color: #666; line-height: 1.6;">{{intro_text}}</p>
              
              <div style="margin: 30px 0;">
                {{#speakers}}
                <div style="margin: 20px 0; padding: 20px; background: #FFF9F2; border-radius: 8px;">
                  <img src="{{photo_url}}" alt="{{name}}" style="width: 80px; height: 80px; border-radius: 50%; margin-bottom: 10px;">
                  <h3 style="margin: 10px 0 5px; font-size: 18px; color: #333;">{{name}}</h3>
                  <p style="margin: 0 0 10px; font-size: 14px; color: #999;">{{title}}</p>
                  <p style="margin: 0; font-size: 16px; color: #666; line-height: 1.5;">{{pitch}}</p>
                </div>
                {{/speakers}}
              </div>
              
              <div style="text-align: center; margin: 40px 0;">
                <a href="{{cta_url}}" style="display: inline-block; background: #AE32E3; color: #FFFFFF; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: bold;">{{cta_text}}</a>
              </div>
              
              <p style="margin: 30px 0 0; font-size: 14px; color: #999; text-align: center;">С уважением, команда Human</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>',
  slots_schema = '{"headline": "string", "intro_text": "string", "speakers": [{"name": "string", "title": "string", "pitch": "string", "photo_url": "string"}], "cta_text": "string", "cta_url": "string", "subject": "string"}'::jsonb
WHERE id = 1;