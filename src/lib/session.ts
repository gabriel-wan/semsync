import { b64url, b64urlDecodeString, hmac, safeEqual } from './crypto.js';

const SESSION_DAYS = 30;

/** Cookie value "<userId>.<expiry>.<signature>", signed with SESSION_SECRET. */
export async function sessionValue(secret: string, userId: string): Promise<string> {
  const payload = `${b64url(userId)}.${Date.now() + SESSION_DAYS * 86_400_000}`;
  return `${payload}.${await hmac(secret, `session:${payload}`)}`;
}

export async function readSession(secret: string, value: string | undefined): Promise<string | null> {
  if (!value) return null;
  const [uid, exp, sig] = value.split('.');
  if (!uid || !exp || !sig || Number(exp) < Date.now()) return null;
  if (!safeEqual(sig, await hmac(secret, `session:${uid}.${exp}`))) return null;
  return b64urlDecodeString(uid);
}

export const SESSION_MAX_AGE = SESSION_DAYS * 86_400;

/**
 * Whether a valid session is a day or more old, so it's sent again with a fresh 30 days. Anyone who comes back within a
 * month stays signed in for good; only a month away signs someone out.
 */
export function renewDue(value: string, now = Date.now()): boolean {
  const exp = Number(value.split('.')[1]);
  return Number.isFinite(exp) && exp - now < (SESSION_DAYS - 1) * 86_400_000;
}

/** Per-user token for forms, so other sites can't post to them on the user's behalf. */
export const csrfToken = (secret: string, userId: string) => hmac(secret, `csrf:${userId}`);
