// ─── Telegram уведомления ──────────────────────────────────────────────────────

const TELEGRAM_API = 'https://api.telegram.org';

// Отправить сообщение в Telegram
async function sendTelegram(chatId, text, botToken) {
  const token = botToken || process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !chatId) return;

  try {
    const url = `${TELEGRAM_API}/bot${token}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
      }),
    });
    const data = await res.json();
    if (!data.ok) console.error('[telegram] Ошибка отправки:', data.description);
  } catch (err) {
    console.error('[telegram] Ошибка:', err.message);
  }
}

// Собрать текст уведомления для мастера
function buildMasterMessage({ master, name, phone, service, date, time, duration, comment }) {
  const lines = [
    `🗓 <b>Новая запись!</b>`,
    ``,
    `👤 <b>Клиент:</b> ${name}`,
    `📞 <b>Телефон:</b> ${phone}`,
    `💅 <b>Услуга:</b> ${service}`,
    `👩‍🔧 <b>Мастер:</b> ${master.name}`,
    `📅 <b>Дата:</b> ${date}`,
    `⏰ <b>Время:</b> ${time} (${duration} мин)`,
    comment ? `💬 <b>Комментарий:</b> ${comment}` : '',
  ].filter(Boolean);

  return lines.join('\n');
}

// Собрать текст подтверждения для клиента (опционально)
function buildClientMessage({ master, service, date, time }) {
  return [
    `✅ <b>Запись подтверждена!</b>`,
    ``,
    `💅 <b>Услуга:</b> ${service}`,
    `👩‍🔧 <b>Мастер:</b> ${master.name}`,
    `📅 <b>Дата:</b> ${date}`,
    `⏰ <b>Время:</b> ${time}`,
    ``,
    `Ждём вас! Если планы изменились — пожалуйста, сообщите заранее.`,
  ].join('\n');
}

module.exports = { sendTelegram, buildMasterMessage, buildClientMessage };
