const MASTERS = {
  aigerym_seitkali: {
    id: 'aigerym_seitkali',
    name: 'Айгерим Сейткали',
    role: 'Косметолог',
    calendarId: process.env.CALENDAR_AIGERIM || 'primary',
    telegramChatId: process.env.TELEGRAM_AIGERIM || '',
    services: [
      'Чистка лица', 'Ультразвуковая чистка', 'Химический пилинг',
      'RF-лифтинг', 'Биоревитализация', 'Уход Dermalogica',
    ],
    workHours: { start: 9, end: 20 },
    slotStep: 60,
  },
  diana_nurova: {
    id: 'diana_nurova',
    name: 'Диана Нурова',
    role: 'Косметолог-эстетист',
    calendarId: process.env.CALENDAR_DIANA || 'primary',
    telegramChatId: process.env.TELEGRAM_DIANA || '',
    services: [
      'Чистка лица', 'Ультразвуковая чистка', 'Химический пилинг',
      'RF-лифтинг', 'Биоревитализация', 'Уход Dermalogica',
    ],
    workHours: { start: 9, end: 20 },
    slotStep: 60,
  },
};

module.exports = MASTERS;
