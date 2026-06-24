const express = require('express');
const { google } = require('googleapis');
const cors = require('cors');
const MASTERS = require('./masters');
const { sendTelegram, buildMasterMessage } = require('./telegram');
const { createOAuthClient, getAuthUrl, saveToken, getAuthClient } = require('./auth');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors({ origin: process.env.SITE_URL || '*' }));

// ─── Длительность услуг (минуты) ──────────────────────────────────────────────
const SERVICE_DURATION = {
  'Маникюр':            60,
  'Педикюр':            90,
  'Маникюр + педикюр':  150,
  'Наращивание ногтей': 120,
  'Чистка лица':        60,
  'Пилинг':             45,
  'RF-лифтинг':         60,
  'Биоревитализация':   60,
  'Уход Dermalogica':   75,
  'Эпиляция':           30,
  'Эпиляция бикини':    45,
  'Эпиляция ног':       60,
  'default':            60,
};

function getDuration(service) {
  return SERVICE_DURATION[service] || SERVICE_DURATION['default'];
}

// ─── GET /auth ─────────────────────────────────────────────────────────────────
// Шаг 1 — перенаправляет на страницу входа Google
app.get('/auth', (req, res) => {
  const oAuth2Client = createOAuthClient();
  const url = getAuthUrl(oAuth2Client);
  res.redirect(url);
});

// ─── GET /auth/callback ────────────────────────────────────────────────────────
// Шаг 2 — Google возвращает код, меняем на токен и сохраняем
app.get('/auth/callback', async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.status(400).send('Ошибка авторизации — код не получен');
  }

  try {
    const oAuth2Client = createOAuthClient();
    const { tokens } = await oAuth2Client.getToken(code);
    saveToken(tokens);

    res.send(`
      <html><body style="font-family:sans-serif;padding:40px;text-align:center">
        <h2 style="color:#27500A">Авторизация успешна!</h2>
        <p>Google Calendar подключён. Можно закрыть эту страницу.</p>
        <p style="color:#666;font-size:14px">Сервер готов принимать записи.</p>
      </body></html>
    `);
  } catch (err) {
    console.error('[auth] Ошибка получения токена:', err.message);
    res.status(500).send('Ошибка авторизации: ' + err.message);
  }
});

// ─── GET /auth/status ──────────────────────────────────────────────────────────
// Проверить подключён ли календарь
app.get('/auth/status', async (req, res) => {
  try {
    await getAuthClient();
    res.json({ ok: true, connected: true, message: 'Google Calendar подключён' });
  } catch (e) {
    res.json({ ok: true, connected: false, message: 'Требуется авторизация — открой /auth' });
  }
});

// ─── Занятые периоды из Google Calendar ───────────────────────────────────────
async function getBusyPeriods(calendarId, date) {
  const auth = await getAuthClient();
  const calendar = google.calendar({ version: 'v3', auth });

  const dayStart = new Date(`${date}T00:00:00`);
  const dayEnd   = new Date(`${date}T23:59:59`);

  const response = await calendar.freebusy.query({
    resource: {
      timeMin:  dayStart.toISOString(),
      timeMax:  dayEnd.toISOString(),
      timeZone: process.env.TIMEZONE || 'Asia/Almaty',
      items:    [{ id: calendarId }],
    },
  });

  return response.data.calendars[calendarId]?.busy || [];
}

// ─── Генерация слотов ─────────────────────────────────────────────────────────
function generateSlots(master, date, busyPeriods, serviceDuration) {
  const { workHours, slotStep } = master;
  const slots = [];

  for (let hour = workHours.start; hour < workHours.end; hour++) {
    for (let min = 0; min < 60; min += slotStep) {
      const [year, month, day] = date.split('-').map(Number);
      const slotStart = new Date(year, month - 1, day, hour, min);
      const slotEnd   = new Date(slotStart.getTime() + serviceDuration * 60 * 1000);

      const workEnd = new Date(year, month - 1, day, workHours.end, 0);
      if (slotEnd > workEnd) continue;
      if (slotStart < new Date()) continue;

      const isBusy = busyPeriods.some(busy => {
        const busyStart = new Date(busy.start);
        const busyEnd   = new Date(busy.end);
        return slotStart < busyEnd && slotEnd > busyStart;
      });

      const timeStr = `${String(hour).padStart(2,'0')}:${String(min).padStart(2,'0')}`;
      slots.push({ time: timeStr, free: !isBusy });
    }
  }

  return slots;
}

// ─── GET /masters ──────────────────────────────────────────────────────────────
app.get('/masters', (req, res) => {
  const list = Object.values(MASTERS).map(m => ({
    id: m.id, name: m.name, role: m.role, services: m.services,
  }));
  res.json({ ok: true, masters: list });
});

// ─── GET /slots ────────────────────────────────────────────────────────────────
app.get('/slots', async (req, res) => {
  const { masterId, date, service } = req.query;
  if (!masterId || !date) {
    return res.status(400).json({ ok: false, error: 'Укажи masterId и date' });
  }

  const master = MASTERS[masterId];
  if (!master) return res.status(404).json({ ok: false, error: 'Мастер не найден' });

  try {
    const duration    = getDuration(service || 'default');
    const busyPeriods = await getBusyPeriods(master.calendarId, date);
    const slots       = generateSlots(master, date, busyPeriods, duration);
    res.json({ ok: true, masterId, date, slots });
  } catch (err) {
    if (err.message === 'NOT_AUTHORIZED') {
      return res.status(401).json({ ok: false, error: 'Сначала авторизуйся — открой /auth' });
    }
    console.error('[slots]', err.message);
    res.status(500).json({ ok: false, error: 'Не удалось получить слоты' });
  }
});

// ─── POST /booking ─────────────────────────────────────────────────────────────
app.post('/booking', async (req, res) => {
  const { name, phone, service, masterId, date, time, comment } = req.body;

  if (!name || !phone || !service || !masterId || !date || !time) {
    return res.status(400).json({ ok: false, error: 'Заполните все обязательные поля' });
  }

  const master = MASTERS[masterId];
  if (!master) return res.status(404).json({ ok: false, error: 'Мастер не найден' });

  try {
    const auth     = await getAuthClient();
    const calendar = google.calendar({ version: 'v3', auth });
    const tz       = process.env.TIMEZONE || 'Asia/Almaty';

    const [year, month, day] = date.split('-').map(Number);
    const [hour, minute]     = time.split(':').map(Number);
    const durationMin        = getDuration(service);
    const startDate          = new Date(year, month - 1, day, hour, minute);
    const endDate            = new Date(startDate.getTime() + durationMin * 60 * 1000);

    // Финальная проверка занятости
    const busyPeriods = await getBusyPeriods(master.calendarId, date);
    const isBusy = busyPeriods.some(busy => {
      const s = new Date(busy.start), e = new Date(busy.end);
      return startDate < e && endDate > s;
    });

    if (isBusy) {
      return res.status(409).json({
        ok: false,
        error: `Время ${time} уже занято. Выберите другое время.`,
      });
    }

    // Создаём событие
    await calendar.events.insert({
      calendarId: master.calendarId,
      resource: {
        summary: `${service} — ${name}`,
        description: [
          `Клиент: ${name}`,
          `Телефон: ${phone}`,
          `Услуга: ${service}`,
          `Мастер: ${master.name}`,
          comment ? `Комментарий: ${comment}` : '',
          `Длительность: ${durationMin} мин`,
        ].filter(Boolean).join('\n'),
        start: { dateTime: startDate.toISOString(), timeZone: tz },
        end:   { dateTime: endDate.toISOString(),   timeZone: tz },
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'popup', minutes: 60 },
            { method: 'email', minutes: 1440 },
          ],
        },
      },
    });

    console.log(`[booking] ✓ ${name} → ${master.name} / ${service} / ${date} ${time}`);

    // Telegram уведомление мастеру
    if (master.telegramChatId) {
      await sendTelegram(master.telegramChatId, buildMasterMessage({
        master, name, phone, service, date, time, duration: durationMin, comment,
      }));
    }

    // Telegram уведомление администратору
    if (process.env.TELEGRAM_ADMIN_CHAT_ID) {
      await sendTelegram(process.env.TELEGRAM_ADMIN_CHAT_ID, buildMasterMessage({
        master, name, phone, service, date, time, duration: durationMin, comment,
      }));
    }

    res.json({
      ok: true,
      message: `Запись создана! ${master.name} ждёт вас ${date} в ${time}.`,
    });

  } catch (err) {
    if (err.message === 'NOT_AUTHORIZED') {
      return res.status(401).json({ ok: false, error: 'Сервер не авторизован. Обратитесь к администратору.' });
    }
    console.error('[booking]', err.message);
    res.status(500).json({ ok: false, error: 'Ошибка сервера. Попробуйте ещё раз.' });
  }
});

// ─── GET /health ───────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ ok: true, status: 'running' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Booking server on port ${PORT}`));
