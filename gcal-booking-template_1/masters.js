// ─── Конфиг мастеров ───────────────────────────────────────────────────────────
// Меняй под каждого клиента
// calendarId — из настроек Google Calendar мастера
// telegramChatId — мастер пишет боту /start и получает свой chat_id

const MASTERS = {
  aigerim: {
    id: 'aigerim',
    name: 'Айгерим Сейткали',
    role: 'Косметолог',
    calendarId: process.env.CALENDAR_AIGERIM || 'aigerim@gmail.com',
    telegramChatId: process.env.TELEGRAM_AIGERIM || '',
    services: ['Чистка лица', 'Пилинг', 'RF-лифтинг'],
    workHours: { start: 9, end: 19 },
    slotStep: 60,
  },
  diana: {
    id: 'diana',
    name: 'Диана Нурова',
    role: 'Косметолог-эстетист',
    calendarId: process.env.CALENDAR_DIANA || 'diana@gmail.com',
    telegramChatId: process.env.TELEGRAM_DIANA || '',
    services: ['Биоревитализация', 'Уход Dermalogica', 'RF-лифтинг'],
    workHours: { start: 10, end: 20 },
    slotStep: 60,
  },
  anastasia: {
    id: 'anastasia',
    name: 'Анастасия Белова',
    role: 'Мастер по эпиляции',
    calendarId: process.env.CALENDAR_ANASTASIA || 'anastasia@gmail.com',
    telegramChatId: process.env.TELEGRAM_ANASTASIA || '',
    services: ['Эпиляция', 'Эпиляция бикини', 'Эпиляция ног'],
    workHours: { start: 9, end: 18 },
    slotStep: 30,
  },
};

module.exports = MASTERS;
