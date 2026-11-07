// OAuth for AI apps (Claude, ChatGPT and others) reading someone's semester through the MCP server: Semsync is both
// the authorization server and the resource server, as the MCP authorization spec describes. An app registers itself
// (dynamic client registration), the person allows it on the approval page, and the app swaps the code it gets, with
// PKCE, for an access pass (an hour) and a refresh pass (replaced on every use). Only SHA-256 hashes of codes and
// passes are stored, and every pass is bound to the MCP endpoint's address.
import { b64url, newSecret, safeEqual, sha256Hex } from './crypto.js';
import type { Db } from './database.js';
import { WHILE_USER_EXISTS } from './db.js';

/** The one permission there is: read deadlines, classes, exams and courses. */
export const SCOPE = 'read';
export const ACCESS_TTL_MS = 3600_000;
export const REFRESH_TTL_MS = 60 * 86_400_000;
export const CODE_TTL_MS = 5 * 60_000;
/** Requests each connection may make a minute. */
export const CALLS_PER_MINUTE = 60;

/**
 * The hosted apps Semsync sends people back to, by their exact OAuth callback addresses. Apps that run on the person's
 * own computer use loopback addresses instead, which only reach that computer. Anything else is refused at registration,
 * so nobody can set up a look alike app that sends approvals elsewhere. Only add an address whose page keeps the code
 * itself: one that forwards it on (as vscode.dev/redirect does, to wherever its state says) would hand it to whoever
 * started the request.
 */
const HOSTED_REDIRECTS = [
  'https://claude.ai/api/mcp/auth_callback',
  'https://claude.com/api/mcp/auth_callback',
  'https://chatgpt.com/connector_platform_oauth_redirect',
];
const LOOPBACK_HOSTS = ['localhost', '127.0.0.1', '[::1]'];

/** Whether a URL's hostname (as URL parses it) is this computer. */
export const isLoopbackHost = (hostname: string) => LOOPBACK_HOSTS.includes(hostname);

export const mcpResource = (appUrl: string) => `${appUrl}/mcp`;

export class OAuthError extends Error {
  /** Set once the request's redirect address is known to be the app's own, so the error can go back there. */
  redirectUri?: string;

  constructor(
    readonly code: string,
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

/** A problem with the request that can't safely be sent back to the app, so the approval page shows it instead. */
export class ApprovalPageError extends Error {}

export type ClientRow = { id: string; name: string; redirect_uris: string; secret_hash: string | null; created_at: number };

/** Where a redirect address leads, for the approval page, or null if it isn't one Semsync sends people back to. */
export function redirectTarget(uri: string): { host: string; local: boolean } | null {
  let url: URL;
  try {
    url = new URL(uri);
  } catch {
    return null;
  }
  if (url.hash || url.username || url.password) return null;
  if (HOSTED_REDIRECTS.includes(uri)) return { host: url.hostname, local: false };
  if ((url.protocol === 'http:' || url.protocol === 'https:') && isLoopbackHost(url.hostname)) return { host: url.hostname, local: true };
  return null;
}

/**
 * Whose logo an app may wear on the approval page and in Settings. Only the return address proves who an app is: its
 * name is its own claim, and anything on someone's computer can call itself "Claude". So the logo comes from one of the
 * hosted return addresses, never from the name.
 */
export function verifiedBrand(target: { host: string; local: boolean }): 'claude' | 'chatgpt' | null {
  if (target.local) return null;
  if (target.host === 'claude.ai' || target.host === 'claude.com') return 'claude';
  if (target.host === 'chatgpt.com') return 'chatgpt';
  return null;
}

/**
 * Whether a redirect address is one the app registered. A loopback address matches on any port, as RFC 8252 asks: apps
 * on the person's computer listen on whichever port is free.
 */
function isRegisteredRedirect(registered: string[], requested: string): boolean {
  if (registered.includes(requested)) return true;
  if (!redirectTarget(requested)?.local) return false;
  const want = new URL(requested);
  return registered.some((r) => {
    const url = new URL(r);
    return isLoopbackHost(url.hostname) && url.protocol === want.protocol && url.hostname === want.hostname &&
      url.pathname === want.pathname && url.search === want.search;
  });
}

/** The MCP endpoint's address in one form, so "https://SEMSYNC.live/mcp/" and "https://semsync.live/mcp" match. */
export function canonicalResource(value: string, appUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.hash || url.search) return null;
  const canonical = `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
  // The bare site address names the same server, and some apps send that.
  return canonical === mcpResource(appUrl) || canonical === appUrl ? mcpResource(appUrl) : null;
}

/** RFC 7591 dynamic client registration. Returns the response body for a 201. */
export async function registerClient(db: Db, body: unknown, now = Date.now()) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new OAuthError('invalid_client_metadata', 'Send the client metadata as a JSON object.');
  }
  const meta = body as Record<string, unknown>;
  const uris = meta.redirect_uris;
  if (!Array.isArray(uris) || uris.length === 0 || uris.length > 5 || !uris.every((u) => typeof u === 'string' && u.length <= 500)) {
    throw new OAuthError('invalid_redirect_uri', 'Give between one and five redirect_uris.');
  }
  for (const uri of uris as string[]) {
    if (!redirectTarget(uri)) {
      throw new OAuthError(
        'invalid_redirect_uri',
        `Semsync doesn't send people back to ${uri}. It works with Claude, ChatGPT and apps on your own computer (localhost).`,
      );
    }
  }
  const method = meta.token_endpoint_auth_method ?? 'client_secret_basic';
  if (typeof method !== 'string' || !['none', 'client_secret_post', 'client_secret_basic'].includes(method)) {
    throw new OAuthError('invalid_client_metadata', 'token_endpoint_auth_method must be none, client_secret_post or client_secret_basic.');
  }
  const grantTypes = meta.grant_types ?? ['authorization_code', 'refresh_token'];
  if (!Array.isArray(grantTypes) || !grantTypes.every((g) => g === 'authorization_code' || g === 'refresh_token')) {
    throw new OAuthError('invalid_client_metadata', 'grant_types may only be authorization_code and refresh_token.');
  }
  const responseTypes = meta.response_types ?? ['code'];
  if (!Array.isArray(responseTypes) || !responseTypes.every((r) => r === 'code')) {
    throw new OAuthError('invalid_client_metadata', 'response_types may only be code.');
  }
  const name = typeof meta.client_name === 'string' && meta.client_name.trim() ? meta.client_name.trim().slice(0, 60) : 'An app';

  const id = crypto.randomUUID();
  const secret = method === 'none' ? null : newSecret();
  await db.batch([
    // Registrations nobody has allowed are cleared after 30 days, so open registration can't fill the table. Apps keep
    // their registration, so it stays long enough for someone to come back and finish connecting.
    db.prepare('DELETE FROM oauth_clients WHERE created_at < ? AND id NOT IN (SELECT client_id FROM oauth_grants)').bind(now - 30 * 86_400_000),
    db.prepare('INSERT INTO oauth_clients (id, name, redirect_uris, secret_hash, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind(id, name, JSON.stringify(uris), secret ? await sha256Hex(secret) : null, now),
  ]);
  return {
    client_id: id,
    client_id_issued_at: Math.floor(now / 1000),
    client_name: name,
    redirect_uris: uris,
    grant_types: grantTypes,
    response_types: responseTypes,
    token_endpoint_auth_method: method,
    ...(secret ? { client_secret: secret, client_secret_expires_at: 0 } : {}),
  };
}

export const getClient = (db: Db, id: string) =>
  db.prepare('SELECT * FROM oauth_clients WHERE id = ?').bind(id).first<ClientRow>();

export type ApprovalRequest = {
  client: ClientRow;
  redirectUri: string;
  target: { host: string; local: boolean };
  state?: string;
  codeChallenge: string;
  resource: string;
};

/** The redirect address with the given parameters (and the issuer, RFC 9207) added to its query. */
export function backToApp(redirectUri: string, params: Record<string, string | undefined>, issuer: string): string {
  const url = new URL(redirectUri);
  for (const [k, v] of Object.entries({ ...params, iss: issuer })) if (v !== undefined) url.searchParams.set(k, v);
  return url.toString();
}

/**
 * Checks an authorization request. An unknown app or redirect address throws ApprovalPageError, since nothing can
 * safely be sent back; any other problem is an OAuthError to send back to the (now trusted) redirect address.
 */
export async function checkApprovalRequest(db: Db, q: Record<string, string | undefined>, appUrl: string): Promise<ApprovalRequest> {
  const client = q.client_id ? await getClient(db, q.client_id) : null;
  if (!client) {
    throw new ApprovalPageError("This app isn't registered with Semsync, or its registration ran out. In the app, remove Semsync and add it again.");
  }
  const registered = JSON.parse(client.redirect_uris) as string[];
  const redirectUri = q.redirect_uri ?? (registered.length === 1 ? registered[0] : undefined);
  const target = redirectUri && isRegisteredRedirect(registered, redirectUri) ? redirectTarget(redirectUri) : null;
  if (!redirectUri || !target) throw new ApprovalPageError("This app asked to send you to an address it didn't register, so Semsync stopped here.");

  const back = (code: string, message: string) => Object.assign(new OAuthError(code, message), { redirectUri });
  if (q.response_type !== 'code') throw back('unsupported_response_type', 'Only response_type=code is supported.');
  if (q.code_challenge_method !== 'S256' || !/^[A-Za-z0-9_-]{43}$/.test(q.code_challenge ?? '')) {
    throw back('invalid_request', 'PKCE with code_challenge_method=S256 is required.');
  }
  const resource = q.resource === undefined ? mcpResource(appUrl) : canonicalResource(q.resource, appUrl);
  if (!resource) throw back('invalid_target', `Passes from here only work for ${mcpResource(appUrl)}.`);
  return { client, redirectUri, target, state: q.state, codeChallenge: q.code_challenge!, resource };
}

/** A one use code for the approved request, valid for a few minutes. */
export async function createCode(db: Db, userId: string, req: ApprovalRequest, now = Date.now()): Promise<string> {
  const code = newSecret();
  await db.batch([
    db.prepare('DELETE FROM oauth_codes WHERE expires_at < ?').bind(now),
    db.prepare(
      `${WHILE_USER_EXISTS}
       INSERT INTO oauth_codes (hash, user_id, client_id, redirect_uri, code_challenge, scope, resource, expires_at)
       SELECT ?, id, ?, ?, ?, ?, ?, ? FROM owner`,
    ).bind(userId, await sha256Hex(code), req.client.id, req.redirectUri, req.codeChallenge, SCOPE, req.resource, now + CODE_TTL_MS),
  ]);
  return code;
}

/**
 * Who is calling the token endpoint: the client_id, plus its secret (in the form or as HTTP Basic) if it registered
 * with one. Unknown apps get invalid_client with a 401, which tells Claude to register again.
 */
export async function authenticateClient(db: Db, form: Record<string, string | undefined>, authorization?: string): Promise<ClientRow> {
  let id = form.client_id;
  let secret = form.client_secret;
  if (authorization?.startsWith('Basic ')) {
    try {
      const pair = atob(authorization.slice(6));
      const colon = pair.indexOf(':');
      if (colon < 0) throw new Error('no colon');
      id = decodeURIComponent(pair.slice(0, colon));
      secret = decodeURIComponent(pair.slice(colon + 1));
    } catch {
      throw new OAuthError('invalid_client', 'The Authorization header is malformed.', 401);
    }
    if (form.client_id && form.client_id !== id) throw new OAuthError('invalid_client', 'Two different client_ids were sent.', 401);
  }
  const client = id ? await getClient(db, id) : null;
  if (!client) throw new OAuthError('invalid_client', 'Unknown client. Register again.', 401);
  if (client.secret_hash && !(secret && safeEqual(await sha256Hex(secret), client.secret_hash))) {
    throw new OAuthError('invalid_client', 'The client secret is wrong.', 401);
  }
  return client;
}

/** Whether a PKCE code_verifier matches the S256 code_challenge sent with the authorization request. */
export async function pkceMatches(verifier: string, challenge: string): Promise<boolean> {
  if (!/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)) return false;
  return safeEqual(b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))), challenge);
}

export type TokenResponse = { access_token: string; token_type: 'Bearer'; expires_in: number; refresh_token: string; scope: string };

/** New passes for a connection. `fresh` drops every pass it held before, for a connection that was just allowed again. */
async function issueTokens(db: Db, grantId: string, resource: string, now: number, fresh = false): Promise<TokenResponse> {
  const access = newSecret();
  const refresh = newSecret();
  await db.batch([
    db.prepare('DELETE FROM oauth_tokens WHERE expires_at < ?').bind(now),
    ...(fresh ? [db.prepare('DELETE FROM oauth_tokens WHERE grant_id = ?').bind(grantId)] : []),
    db.prepare('INSERT INTO oauth_tokens (hash, grant_id, kind, resource, expires_at) VALUES (?, ?, ?, ?, ?)')
      .bind(await sha256Hex(access), grantId, 'access', resource, now + ACCESS_TTL_MS),
    db.prepare('INSERT INTO oauth_tokens (hash, grant_id, kind, resource, expires_at) VALUES (?, ?, ?, ?, ?)')
      .bind(await sha256Hex(refresh), grantId, 'refresh', resource, now + REFRESH_TTL_MS),
  ]);
  return { access_token: access, token_type: 'Bearer', expires_in: ACCESS_TTL_MS / 1000, refresh_token: refresh, scope: SCOPE };
}

/** grant_type=authorization_code: the code (used up either way), its redirect address, PKCE and the resource. */
export async function redeemCode(db: Db, client: ClientRow, form: Record<string, string | undefined>, appUrl: string, now = Date.now()) {
  const row = await db
    .prepare('DELETE FROM oauth_codes WHERE hash = ? RETURNING user_id, client_id, redirect_uri, code_challenge, scope, resource, expires_at')
    .bind(await sha256Hex(form.code ?? ''))
    .first<{ user_id: string; client_id: string; redirect_uri: string; code_challenge: string; scope: string; resource: string; expires_at: number }>();
  if (!row || row.expires_at < now || row.client_id !== client.id) throw new OAuthError('invalid_grant', 'This code is unknown, used or expired.');
  if (form.redirect_uri !== undefined && form.redirect_uri !== row.redirect_uri) throw new OAuthError('invalid_grant', "redirect_uri doesn't match.");
  if (!(await pkceMatches(form.code_verifier ?? '', row.code_challenge))) throw new OAuthError('invalid_grant', "code_verifier doesn't match.");
  if (form.resource !== undefined && canonicalResource(form.resource, appUrl) !== row.resource) {
    throw new OAuthError('invalid_target', `Passes from here only work for ${row.resource}.`);
  }
  const grant = await db
    .prepare(
      `${WHILE_USER_EXISTS}
       INSERT INTO oauth_grants (id, user_id, client_id, scope, redirect_uri, created_at) SELECT ?, id, ?, ?, ?, ? FROM owner
       ON CONFLICT (user_id, client_id) DO UPDATE SET scope = excluded.scope, redirect_uri = excluded.redirect_uri
       RETURNING id`,
    )
    .bind(row.user_id, crypto.randomUUID(), client.id, row.scope, row.redirect_uri, now)
    .first<{ id: string }>();
  if (!grant) throw new OAuthError('invalid_grant', 'This Semsync account no longer exists.');
  // Allowing an app again starts it over: passes from before (perhaps copied, which is why it's being allowed again) stop.
  return issueTokens(db, grant.id, row.resource, now, true);
}

/**
 * grant_type=refresh_token: the refresh pass is used up and replaced, as OAuth 2.1 asks for apps without a secret. It's
 * marked used rather than deleted, so if it turns up again it must have been copied: then every pass of that connection
 * stops working, and the person allows the app again.
 */
export async function refreshTokens(db: Db, client: ClientRow, form: Record<string, string | undefined>, appUrl: string, now = Date.now()) {
  const hash = await sha256Hex(form.refresh_token ?? '');
  const row = await db
    .prepare(
      `UPDATE oauth_tokens SET kind = 'refresh_used' WHERE hash = ? AND kind = 'refresh'
       RETURNING grant_id, resource, expires_at, (SELECT client_id FROM oauth_grants WHERE id = oauth_tokens.grant_id) AS client_id`,
    )
    .bind(hash)
    .first<{ grant_id: string; resource: string; expires_at: number; client_id: string | null }>();
  if (!row) {
    const reused = await db.prepare("SELECT grant_id FROM oauth_tokens WHERE hash = ? AND kind = 'refresh_used'").bind(hash).first<{ grant_id: string }>();
    if (reused) await db.prepare('DELETE FROM oauth_tokens WHERE grant_id = ?').bind(reused.grant_id).run();
    throw new OAuthError('invalid_grant', 'This refresh token is unknown, used or expired.');
  }
  if (row.expires_at < now || row.client_id !== client.id) throw new OAuthError('invalid_grant', 'This refresh token is unknown, used or expired.');
  if (form.resource !== undefined && canonicalResource(form.resource, appUrl) !== row.resource) {
    throw new OAuthError('invalid_target', `Passes from here only work for ${row.resource}.`);
  }
  return issueTokens(db, row.grant_id, row.resource, now);
}

/** The person and connection an access pass belongs to, if it's valid for this MCP endpoint right now. */
export async function accessFor(db: Db, token: string, resource: string, now = Date.now()) {
  return db
    .prepare(
      `SELECT g.id AS grant_id, g.user_id FROM oauth_tokens t JOIN oauth_grants g ON g.id = t.grant_id
       WHERE t.hash = ? AND t.kind = 'access' AND t.resource = ? AND t.expires_at > ?`,
    )
    .bind(await sha256Hex(token), resource, now)
    .first<{ grant_id: string; user_id: string }>();
}

/**
 * Counts requests (each message in a batch is one) against the connection's per minute limit, and notes when it was
 * last used. False when over.
 */
export async function countRequests(db: Db, grantId: string, count: number, now = Date.now()): Promise<boolean> {
  const windowStart = now - 60_000;
  const row = await db
    .prepare(
      `UPDATE oauth_grants SET
         window_calls = CASE WHEN window_start <= ? THEN ? ELSE window_calls + ? END,
         window_start = CASE WHEN window_start <= ? THEN ? ELSE window_start END,
         last_used_at = ?
       WHERE id = ? RETURNING window_calls`,
    )
    .bind(windowStart, count, count, windowStart, now, now, grantId)
    .first<{ window_calls: number }>();
  return !!row && row.window_calls <= CALLS_PER_MINUTE;
}

export type ConnectedApp = { id: string; name: string; host: string; local: boolean; created_at: number; last_used_at: number | null };

/** The apps someone allowed, for Settings. */
export async function connectedApps(db: Db, userId: string): Promise<ConnectedApp[]> {
  const { results } = await db
    .prepare(
      `SELECT g.id, c.name, g.redirect_uri, g.created_at, g.last_used_at FROM oauth_grants g
       JOIN oauth_clients c ON c.id = g.client_id WHERE g.user_id = ? ORDER BY g.created_at`,
    )
    .bind(userId)
    .all<{ id: string; name: string; redirect_uri: string; created_at: number; last_used_at: number | null }>();
  return results.map(({ redirect_uri, ...app }) => ({ ...app, ...(redirectTarget(redirect_uri) ?? { host: 'unknown', local: false }) }));
}

/** Removes one of someone's connected apps, with every pass it holds. */
export async function removeApp(db: Db, userId: string, grantId: string) {
  await db.batch([
    db.prepare('DELETE FROM oauth_tokens WHERE grant_id IN (SELECT id FROM oauth_grants WHERE id = ? AND user_id = ?)').bind(grantId, userId),
    db.prepare('DELETE FROM oauth_grants WHERE id = ? AND user_id = ?').bind(grantId, userId),
  ]);
}

/** RFC 9728: where to sign in for the MCP endpoint. */
export const protectedResourceMetadata = (appUrl: string) => ({
  resource: mcpResource(appUrl),
  authorization_servers: [appUrl],
  scopes_supported: [SCOPE],
  bearer_methods_supported: ['header'],
  resource_name: 'Semsync',
  resource_documentation: `${appUrl}/help#ai`,
});

/** RFC 8414: how to sign in. */
export const authorizationServerMetadata = (appUrl: string) => ({
  issuer: appUrl,
  authorization_endpoint: `${appUrl}/oauth/authorize`,
  token_endpoint: `${appUrl}/oauth/token`,
  registration_endpoint: `${appUrl}/oauth/register`,
  scopes_supported: [SCOPE],
  response_types_supported: ['code'],
  response_modes_supported: ['query'],
  grant_types_supported: ['authorization_code', 'refresh_token'],
  token_endpoint_auth_methods_supported: ['none', 'client_secret_post', 'client_secret_basic'],
  code_challenge_methods_supported: ['S256'],
  authorization_response_iss_parameter_supported: true,
  service_documentation: `${appUrl}/help#ai`,
});

/** The WWW-Authenticate header on a 401 from the MCP endpoint, which starts an app's sign in. */
export function bearerChallenge(appUrl: string, invalidToken: boolean): string {
  const parts = [`resource_metadata="${appUrl}/.well-known/oauth-protected-resource/mcp"`, `scope="${SCOPE}"`];
  if (invalidToken) parts.push('error="invalid_token"', 'error_description="The access token is invalid or expired"');
  return `Bearer ${parts.join(', ')}`;
}
