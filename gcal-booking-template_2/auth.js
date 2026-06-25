// ─── OAuth авторизация Google Calendar ────────────────────────────────────────
// Без Google Cloud Console. Клиент один раз нажимает "Войти через Google"
// токен сохраняется в памяти сервера и обновляется автоматически.

const { google } = require('googleapis');

function createOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/callback'
  );
}

function getAuthUrl(oAuth2Client) {
  return oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/calendar'],
  });
}

async function saveToken(token) {
  const tokenStr = JSON.stringify(token);
  process.env.GOOGLE_TOKEN = tokenStr;
  console.log('[auth] СКОПИРУЙ В RAILWAY → GOOGLE_TOKEN:');
  console.log(tokenStr);
}

function loadToken() {
  try {
    if (process.env.GOOGLE_TOKEN) {
      return JSON.parse(process.env.GOOGLE_TOKEN);
    }
  } catch (e) {
    console.error('[auth] Ошибка:', e.message);
  }
  return null;
}

async function getAuthClient() {
  const oAuth2Client = createOAuthClient();
  const token = loadToken();
  if (!token) throw new Error('NOT_AUTHORIZED');
  oAuth2Client.setCredentials(token);
  oAuth2Client.on('tokens', (newTokens) => {
    const updated = { ...token, ...newTokens };
    process.env.GOOGLE_TOKEN = JSON.stringify(updated);
    console.log('[auth] Токен обновлён:', JSON.stringify(updated));
  });
  return oAuth2Client;
}

module.exports = { createOAuthClient, getAuthUrl, saveToken, loadToken, getAuthClient };
