# Шаблон онлайн-записи → Google Calendar + Telegram
### by designer_olka · ИИ-интегратор & вайб-кодер

Онлайн-запись с сайта → Google Calendar → уведомление в Telegram.
Без подписок, без CRM, без карты для регистрации.

---

## Как подключить — пошагово

### Шаг 1 — Google Cloud Console (10 мин, БЕСПЛАТНО)

1. Зайди на **console.cloud.google.com**
2. Создай проект — кнопка вверху → "New Project" → назови → Create
3. **Важно: НЕ включай биллинг** — карта не нужна
4. Слева: "APIs & Services" → "Enable APIs" → найди **Google Calendar API** → включи
5. Слева: "APIs & Services" → "Credentials" → "Create Credentials" → **OAuth 2.0 Client ID**
6. Тип приложения: **Web application**
7. В поле "Authorized redirect URIs" добавь:
   `https://ВАШ-ПРОЕКТ.railway.app/auth/callback`
8. Нажми Create → скопируй **Client ID** и **Client Secret**

---

### Шаг 2 — Telegram бот (2 мин)

1. Открой Telegram → найди **@BotFather**
2. Напиши `/newbot` → придумай имя → придумай username
3. Получишь токен — сохрани его
4. Напиши своему боту `/start`
5. Открой в браузере: `https://api.telegram.org/bot[ТОКЕН]/getUpdates`
6. В ответе найди поле `"id"` — это твой chat_id

---

### Шаг 3 — Railway (5 мин)

1. Загрузи файлы на GitHub (server.js, auth.js, masters.js, telegram.js, package.json)
2. **railway.app** → New Project → Deploy from GitHub
3. В Railway Variables добавь все переменные из .env.example
4. Скопируй URL проекта вида `https://gcal-booking-xxx.railway.app`
5. Вставь его в GOOGLE_REDIRECT_URI в Variables

---

### Шаг 4 — Авторизация Google (1 мин)

1. Открой в браузере: `https://ВАШ-ПРОЕКТ.railway.app/auth`
2. Войди через Google аккаунт
3. Нажми "Разрешить"
4. Увидишь страницу "Авторизация успешна" — готово!

Проверить: `https://ВАШ-ПРОЕКТ.railway.app/auth/status`

---

### Шаг 5 — Подключить к сайту (5 мин)

Перед тегом `</body>` вставь в HTML:

```html
<script>
const SERVER_URL = 'https://ВАШ-ПРОЕКТ.railway.app';
</script>
<script src="booking-frontend.js"></script>
```

---

### Шаг 6 — Тест

Заполни форму на сайте → проверь Google Calendar → проверь Telegram.

---

## Настройка мастеров

Открой `masters.js` — измени имена, услуги, рабочие часы под клиента.
Каждому мастеру укажи `telegramChatId` чтобы получал уведомления.

Для нескольких мастеров с разными календарями — каждый авторизует
свой Google аккаунт отдельно. Или используй один общий календарь салона.

---

*Шаблон создан Ольгой Netlink · designer_olka*
