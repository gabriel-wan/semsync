import { b64urlDecodeString } from './crypto.js';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

// Sign-in only asks for these non-sensitive scopes: no Google verification, no user cap.
const SIGN_IN_SCOPE = 'openid email profile';
// Asked separately, only when someone wants events in their own calendar. The narrowest scope that
// can write to their primary calendar; it's "sensitive", so it needs Google's review to lift the user cap.
export const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events.owned';

export type AuthPurpose = 'signin' | 'connect';

export function authorizationUrl(
  clientId: string,
  redirectUri: string,
  state: string,
  purpose: AuthPurpose,
  loginHint?: string,
): string {
  const params = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: 'code', state });
  if (purpose === 'signin') {
    params.set('scope', SIGN_IN_SCOPE);
    params.set('prompt', 'select_account');
  } else {
    params.set('scope', `${SIGN_IN_SCOPE} ${CALENDAR_SCOPE}`);
    params.set('include_granted_scopes', 'true');
    // Offline access gives a refresh token, so the hourly sync can run without the user present.
    params.set('access_type', 'offline');
    params.set('prompt', 'consent');
    if (loginHint) params.set('login_hint', loginHint);
  }
  return `${AUTH_URL}?${params}`;
}

export type GoogleIdentity = { sub: string; email: string; name: string | null };
export type CodeResult = { identity: GoogleIdentity; refreshToken: string | null; scopes: string[] };

export async function exchangeCode(code: string, clientId: string, clientSecret: string, redirectUri: string): Promise<CodeResult> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code' }),
  });
  if (!res.ok) throw new Error(`Google sign-in failed: ${res.status} ${await res.text()}`);
  const tokens = (await res.json()) as { id_token?: string; refresh_token?: string; scope?: string };
  if (!tokens.id_token) throw new Error('Google sign-in returned no id_token');

  // The token came straight from Google's token endpoint over TLS, so its claims can be read
  // without checking the signature (OpenID Connect Core 3.1.3.7). The claims are still checked.
  const claims = JSON.parse(b64urlDecodeString(tokens.id_token.split('.')[1])) as {
    iss: string; aud: string; exp: number; sub: string; email?: string; email_verified?: boolean; name?: string;
  };
  if (!['accounts.google.com', 'https://accounts.google.com'].includes(claims.iss)) throw new Error('Unexpected token issuer');
  if (claims.aud !== clientId) throw new Error('Token is for another app');
  if (claims.exp * 1000 < Date.now()) throw new Error('Token expired');
  if (!claims.email || !claims.email_verified) throw new Error('Google account has no verified email');
  return {
    identity: { sub: claims.sub, email: claims.email.toLowerCase(), name: claims.name ?? null },
    refreshToken: tokens.refresh_token ?? null,
    // People can untick the calendar permission on Google's consent screen, so check what was granted.
    scopes: (tokens.scope ?? '').split(' ').filter(Boolean),
  };
}
