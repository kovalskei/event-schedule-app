UPDATE t_p22819116_event_schedule_app.email_templates 
SET html_template = '
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <title>Human. Подбор персонала</title>
</head>
<body style="margin:0; padding:0; font-family: Arial, sans-serif; background-color:#f5f5f5;">
  <table align="center" width="100%" cellpadding="0" cellspacing="0" bgcolor="#f5f5f5">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="margin-top: 40px; margin-bottom: 40px; border-radius: 8px; overflow: hidden;">

          <tr>
            <td align="center" style="padding: 20px 0 10px 0; color: #9A9A9A; font-size: 14px;">
              Больше чем конференция по персоналу
            </td>
          </tr>
          <tr>
            <td align="center">
              <img src="https://potokconf.ru/upload/email/human_logo.png" alt="HUMAN" width="120">
            </td>
          </tr>

          <tr>
            <td style="padding: 30px 40px 10px 40px; font-size: 16px; color: #333333; line-height: 1.5;">
              Здравствуйте,<br><br>
              {pain_points}
            </td>
          </tr>

          <tr>
            <td style="padding: 0 40px; font-size: 16px; color: #000000; font-weight: bold; line-height: 1.5;">
              На конференции Human. Подбор Персонала говорим о том, как удерживать и развивать персонал с помощью нематериальной мотивации.
            </td>
          </tr>

          <tr>
            <td align="center" style="padding: 30px 40px 20px 40px;">
              <a href="#" style="display: inline-block; background-color: #AE32E3; color: #ffffff; text-decoration: none; font-size: 16px; padding: 12px 28px; border-radius: 8px;">
                Посмотреть программу
              </a>
            </td>
          </tr>

          <tr>
            <td style="padding: 10px 40px 20px 40px; font-size: 16px; color: #333333; font-weight: bold;">
              Вот некоторые спикеры, которые говорят об этом:
            </td>
          </tr>

          <tr>
            <td style="padding: 20px 40px; font-size: 16px; color: #333333; line-height: 1.6;">
              {program_topics}
            </td>
          </tr>

          <tr>
            <td align="center" style="padding: 30px 40px 40px 40px;">
              <a href="#" style="display: inline-block; background-color: #AE32E3; color: #ffffff; text-decoration: none; font-size: 16px; padding: 12px 28px; border-radius: 8px;">
                Посмотреть программу
              </a>
            </td>
          </tr>

          <tr>
            <td style="padding: 20px 40px; font-size: 14px; color: #999999; line-height: 1.5;">
              Присоединяйтесь к комьюнити, где HR заботятся друг о друге,<br>
              Команда HUMAN<br>
              e-mail: <a href="mailto:tickets@potokconf.ru" style="color: #999999; text-decoration: none;">tickets@potokconf.ru</a><br>
              тел: +7 (495) 241-02-68
            </td>
          </tr>
          <tr>
            <td style="padding: 10px 40px 40px 40px; font-size: 12px; color: #cccccc;">
              Вы получили это письмо, потому что проходили регистрацию на конференции Human, конференцию ПОТОК или на конференцию HUMAN. Если вы больше не планируете посещать наши мероприятия и получать от нас письма, то <a href="#" style="color: #cccccc; text-decoration: underline;">отпишитесь</a>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
',
subject_template = '{pain_points} - Конференция Human'
WHERE id = 1;