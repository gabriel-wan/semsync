import type { Env } from '../../env.js';
import { b64url, decrypt, encrypt } from '../crypto.js';
import { WHILE_USER_EXISTS, type UserRow } from '../db.js';
import { UserError } from '../errors.js';
import { fetchWithin } from '../http.js';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';

/** Returns a Google access token, refreshing it when needed. */
export type TokenProvider = () => Promise<string>;

/** The user removed Semsync's calendar access (or it expired), so they need to connect again. */
export class ReconnectNeeded extends UserError {
  constructor() {
    super('Google Calendar access was removed, so syncing has paused. Reconnect to pick up where it left off.');
  }
}

/** A cached access token. `ownerId` is the user it belongs to, if any: it's only cached while they still exist. */
async function cached(
  env: Env,
  key: string,
  fetchToken: () => Promise<{ token: string; expiresIn: number }>,
  ownerId?: string,
): Promise<string> {
  const row = await env.DB.prepare('SELECT value FROM kv WHERE key = ? AND expires_at > ?').bind(key, Date.now()).first<{ value: string }>();
  if (row) return decrypt(env.ENCRYPTION_KEY, row.value);
  const { token, expiresIn } = await fetchToken();
  const value = await encrypt(env.ENCRYPTION_KEY, token);
  const expiresAt = Date.now() + (expiresIn - 300) * 1000;
  const upsert = 'ON CONFLICT (key) DO UPDATE SET value = excluded.value, expires_at = excluded.expires_at';
  await (ownerId
    ? env.DB.prepare(`${WHILE_USER_EXISTS} INSERT INTO kv (key, value, expires_at) SELECT ?, ?, ? FROM owner ${upsert}`).bind(ownerId, key, value, expiresAt)
    : env.DB.prepare(`INSERT INTO kv (key, value, expires_at) VALUES (?, ?, ?) ${upsert}`).bind(key, value, expiresAt)
  ).run();
  return token;
}

/** The app's own service account, which owns the shared calendars. */
export function serviceAccountTokens(env: Env): TokenProvider {
  return () =>
    cached(env, 'token:service_account', async () => {
      if (!env.GOOGLE_SERVICE_ACCOUNT_JSON) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not set');
      const sa = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON) as { client_email: string; private_key: string };
      const now = Math.floor(Date.now() / 1000);
      const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
      const claims = b64url(
        JSON.stringify({
          iss: sa.client_email,
          scope: 'https://www.googleapis.com/auth/calendar',
          aud: TOKEN_URL,
          iat: now,
          exp: now + 3600,
        }),
      );
      const key = await crypto.subtle.importKey('pkcs8', pemToDer(sa.private_key), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
      const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${header}.${claims}`));
      return requestToken({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: `${header}.${claims}.${b64url(signature)}`,
      });
    });
}

/** A user's own Google account, from the refresh token they granted when connecting their calendar. */
export function userTokens(env: Env, user: UserRow): TokenProvider {
  return () =>
    cached(env, `token:user:${user.id}`, async () => {
      if (!user.google_refresh_enc) throw new ReconnectNeeded();
      return requestToken({
        grant_type: 'refresh_token',
        refresh_token: await decrypt(env.ENCRYPTION_KEY, user.google_refresh_enc),
        client_id: env.GOOGLE_OAUTH_CLIENT_ID ?? '',
        client_secret: env.GOOGLE_OAUTH_CLIENT_SECRET ?? '',
      });
    }, user.id);
}

async function requestToken(params: Record<string, string>): Promise<{ token: string; expiresIn: number }> {
  const res = await fetchWithin(20_000, 'Google sign in', TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  });
  if (!res.ok) {
    const text = await res.text();
    if (params.grant_type === 'refresh_token' && text.includes('invalid_grant')) throw new ReconnectNeeded();
    throw new Error(`Google token request failed: ${res.status} ${text}`);
  }
  const { access_token, expires_in } = (await res.json()) as { access_token: string; expires_in: number };
  return { token: access_token, expiresIn: expires_in };
}

/** Tells Google to drop a user's grant. Best effort: the user may already have removed it. */
export async function revokeToken(token: string): Promise<void> {
  await fetchWithin(10_000, 'Google', 'https://oauth2.googleapis.com/revoke', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ token }),
  }).catch(() => undefined);
}

function pemToDer(pem: string): ArrayBuffer {
  const b64 = pem.replace(/-----(BEGIN|END) PRIVATE KEY-----/g, '').replace(/\s+/g, '');
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)).buffer;
}
