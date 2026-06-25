// ─── OAuth авторизация Google Calendar ────────────────────────────────────────
// Без Google Cloud Console. Клиент один раз нажимает "Войти через Google"
// токен сохраняется в памяти сервера и обновляется автоматически.

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const TOKEN_PATH = path.join(process.cwd(), 'token.json');

// OAuth2 клиент — берёт данные из .env
function createOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/callback'
  );
}

// Генерировать URL для входа через Google
function getAuthUrl(oAuth2Client) {
  return oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/calendar'],
  });
}

// Сохранить токен после авторизации
function saveToken(token) {
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(token));
  console.log('[auth] Токен сохранён в', TOKEN_PATH);
}

// Загрузить сохранённый токен
function loadToken() {
  try {
    if (fs.existsSync(TOKEN_PATH)) {
      return JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
    }
  } catch (e) {
    console.error('[auth] Ошибка загрузки токена:', e.message);
  }
  return null;
}

// Получить авторизованный клиент
async function getAuthClient() {
  const oAuth2Client = createOAuthClient();
  const token = loadToken();

  if (!token) {
    throw new Error('NOT_AUTHORIZED');
  }

  oAuth2Client.setCredentials(token);

  // Автообновление токена если истёк
  oAuth2Client.on('tokens', (newTokens) => {
    if (newTokens.refresh_token) {
      saveToken({ ...token, ...newTokens });
    } else {
      saveToken({ ...token, access_token: newTokens.access_token });
    }
    console.log('[auth] Токен обновлён автоматически');
  });

  return oAuth2Client;
}

module.exports = { createOAuthClient, getAuthUrl, saveToken, loadToken, getAuthClient };
