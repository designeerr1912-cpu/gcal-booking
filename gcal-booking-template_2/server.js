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

// Строим дату с явным указанием timezone — без конвертации UTC
function buildDateTime(date, time, tz) {
  // Формат: "2024-06-25T14:00:00+05:00" для Asia/Aqtobe
  const tzOffsets = {
    'Asia/Almaty':  '+06:00',
    'Asia/Aqtobe':  '+05:00',
    'Asia/Aqtau':   '+05:00',
    'Asia/Atyrau':  '+05:00',
    'Asia/Oral':    '+05:00',
    'Asia/Bishkek': '+06:00',
  };
  const offset = tzOffsets[tz] || '+06:00';
  return `${date}T${time}:00${offset}`;
}

app.get('/auth', (req, res) => {
  const oAuth2Client = createOAuthClient();
  const url = getAuthUrl(oAuth2Client);
  res.redirect(url);
});

app.get('/auth/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send('Ошибка авторизации');
  try {
    const oAuth2Client = createOAuthClient();
    const { tokens } = await oAuth2Client.getToken(code);
    saveToken(tokens);
    res.send(`<html><body style="font-family:sans-serif;padding:40px;text-align:center">
      <h2 style="color:#27500A">Авторизация успешна!</h2>
      <p>Google Calendar подключён.</p>
    </body></html>`);
  } catch (err) {
    res.status(500).send('Ошибка: ' + err.message);
  }
});

app.get('/auth/status', async (req, res) => {
  try {
    await getAuthClient();
    res.json({ ok: true, connected: true, message: 'Google Calendar подключён' });
  } catch (e) {
    res.json({ ok: true, connected: false, message: 'Требуется авторизация' });
  }
});

async function getBusyPeriods(calendarId, date) {
  const auth = await getAuthClient();
  const calendar = google.calendar({ version: 'v3', auth });
  const tz = process.env.TIMEZONE || 'Asia/Aqtobe';
  const tzOffsets = { 'Asia/Almaty': '+06:00', 'Asia/Aqtobe': '+05:00' };
  const offset = tzOffsets[tz] || '+05:00';

  const dayStart = `${date}T00:00:00${offset}`;
  const dayEnd   = `${date}T23:59:59${offset}`;

  const response = await calendar.freebusy.query({
    resource: {
      timeMin:  dayStart,
      timeMax:  dayEnd,
      timeZone: tz,
      items:    [{ id: calendarId }],
    },
  });
  return response.data.calendars[calendarId]?.busy || [];
}

function generateSlots(master, date, busyPeriods, serviceDuration) {
  const { workHours, slotStep } = master;
  const slots = [];
  const tz = process.env.TIMEZONE || 'Asia/Aqtobe';
  const tzOffsets = { 'Asia/Almaty': '+06:00', 'Asia/Aqtobe': '+05:00' };
  const offset = tzOffsets[tz] || '+05:00';

  for (let hour = workHours.start; hour < workHours.end; hour++) {
    for (let min = 0; min < 60; min += slotStep) {
      const timeStr = `${String(hour).padStart(2,'0')}:${String(min).padStart(2,'0')}`;
      const slotStartISO = `${date}T${timeStr}:00${offset}`;
      const slotStart = new Date(slotStartISO);
      const slotEnd   = new Date(slotStart.getTime() + serviceDuration * 60 * 1000);

      const workEndISO = `${date}T${String(workHours.end).padStart(2,'0')}:00:00${offset}`;
      const workEnd = new Date(workEndISO);
      if (slotEnd > workEnd) continue;
      if (slotStart < new Date()) continue;

      const isBusy = busyPeriods.some(busy => {
        const s = new Date(busy.start), e = new Date(busy.end);
        return slotStart < e && slotEnd > s;
      });

      slots.push({ time: timeStr, free: !isBusy });
    }
  }
  return slots;
}

app.get('/masters', (req, res) => {
  const list = Object.values(MASTERS).map(m => ({
    id: m.id, name: m.name, role: m.role, services: m.services,
  }));
  res.json({ ok: true, masters: list });
});

app.get('/slots', async (req, res) => {
  const { masterId, date, service } = req.query;
  if (!masterId || !date) return res.status(400).json({ ok: false, error: 'Укажи masterId и date' });
  const master = MASTERS[masterId];
  if (!master) return res.status(404).json({ ok: false, error: 'Мастер не найден' });
  try {
    const duration    = getDuration(service || 'default');
    const busyPeriods = await getBusyPeriods(master.calendarId, date);
    const slots       = generateSlots(master, date, busyPeriods, duration);
    res.json({ ok: true, masterId, date, slots });
  } catch (err) {
    if (err.message === 'NOT_AUTHORIZED') return res.status(401).json({ ok: false, error: 'Сначала авторизуйся' });
    res.status(500).json({ ok: false, error: 'Не удалось получить слоты' });
  }
});

app.post('/booking', async (req, res) => {
  const { name, phone, service, masterId, date, time, comment } = req.body;
  if (!name || !phone || !service || !masterId || !date || !time) {
    return res.status(400).json({ ok: false, error: 'Заполните все обязательные поля' });
  }
  const master = MASTERS[masterId];
  if (!master) return res.status(404).json({ ok: false, error: 'Мастер не найден' });

  const tz = process.env.TIMEZONE || 'Asia/Aqtobe';

  try {
    const auth     = await getAuthClient();
    const calendar = google.calendar({ version: 'v3', auth });
    const durationMin = getDuration(service);

    const startISO = buildDateTime(date, time, tz);
    const startDate = new Date(startISO);
    const endDate   = new Date(startDate.getTime() + durationMin * 60 * 1000);

    const busyPeriods = await getBusyPeriods(master.calendarId, date);
    const isBusy = busyPeriods.some(busy => {
      const s = new Date(busy.start), e = new Date(busy.end);
      return startDate < e && endDate > s;
    });

    if (isBusy) {
      return res.status(409).json({ ok: false, error: `Время ${time} уже занято. Выберите другое.` });
    }

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
        start: { dateTime: startISO, timeZone: tz },
        end:   { dateTime: endDate.toISOString(), timeZone: tz },
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

    if (master.telegramChatId) {
      await sendTelegram(master.telegramChatId, buildMasterMessage({
        master, name, phone, service, date, time, duration: durationMin, comment,
      }));
    }
    if (process.env.TELEGRAM_ADMIN_CHAT_ID) {
      await sendTelegram(process.env.TELEGRAM_ADMIN_CHAT_ID, buildMasterMessage({
        master, name, phone, service, date, time, duration: durationMin, comment,
      }));
    }

    res.json({ ok: true, message: `Запись создана! ${master.name} ждёт вас ${date} в ${time}.` });

  } catch (err) {
    if (err.message === 'NOT_AUTHORIZED') return res.status(401).json({ ok: false, error: 'Сервер не авторизован.' });
    console.error('[booking]', err.message);
    res.status(500).json({ ok: false, error: 'Ошибка сервера. Попробуйте ещё раз.' });
  }
});

app.get('/health', (req, res) => res.json({ ok: true, status: 'running' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Booking server on port ${PORT}`));
