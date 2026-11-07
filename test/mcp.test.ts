import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { b64url } from '../src/lib/crypto';
import type { Db } from '../src/lib/database';
import { deleteUserData, getUser, upsertUserOnLogin } from '../src/lib/db';
import { handleMcp, type RpcResponse } from '../src/lib/mcp';
import { migrate } from '../src/lib/migrate';
import { csrfToken, sessionValue } from '../src/lib/session';
import { testDb } from './pg';

// The in-memory Postgres starts slowly when every test file runs at once, so these get longer than the 5 s default.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

const APP_URL = 'https://semsync.example';
const MCP = `${APP_URL}/mcp`;
const SECRET = 'test session secret';
const USER = 'google:1';
const CLAUDE = 'https://claude.ai/api/mcp/auth_callback';
const COURSES = [
  { key: 'CS2040', label: 'CS2040 Data Structures and Algorithms' },
  { key: 'MA1521', label: 'MA1521 Calculus for Computing' },
];

type App = { fetch: (r: Request) => Response | Promise<Response> };
let app: App;
let db: Db;
let cleanUp: () => Promise<void>;
let cookie: string;

beforeAll(async () => {
  const t = await testDb();
  db = t.db;
  await migrate(db);
  vi.resetModules();
  const env = { DATABASE_URL: t.url, SESSION_SECRET: SECRET, ENCRYPTION_KEY: 'test key', APP_URL, VERCEL: '', DEV_LOGIN: '1', GOOGLE_OAUTH_CLIENT_ID: '' };
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
  app = (await import('../src/app')).default;
  const { getEnv } = await import('../src/env');
  cleanUp = async () => {
    await getEnv().DB.close();
    await t.stop();
    vi.unstubAllEnvs();
  };
  for (const id of [USER, 'google:2']) {
    await upsertUserOnLogin(db, { id, email: `${id.slice(7)}@u.nus.edu`, name: 'Student' });
    await db.prepare("UPDATE users SET courses = ?, hidden_courses = '[\"MA1521\"]', nusmods_link = 'x' WHERE id = ?").bind(JSON.stringify(COURSES), id).run();
  }
  cookie = `ss_session=${await sessionValue(SECRET, USER)}`;
});

afterAll(async () => {
  await cleanUp();
});

const send = (path: string, init: RequestInit = {}) => app.fetch(new Request(`${APP_URL}${path}`, init));
const json = (body: unknown, headers: Record<string, string> = {}): RequestInit => ({
  method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body),
});
const form = (fields: Record<string, string>, headers: Record<string, string> = {}): RequestInit => ({
  method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', ...headers }, body: new URLSearchParams(fields).toString(),
});

async function pkce() {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)));
  return { verifier, challenge: b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))) };
}

async function register(body: Record<string, unknown> = {}) {
  const res = await send('/oauth/register', json({ client_name: 'Claude', redirect_uris: [CLAUDE], token_endpoint_auth_method: 'none', ...body }));
  return { status: res.status, body: (await res.json()) as Record<string, string> };
}

/** An approval request's fields, as an app would send them. */
async function approvalFields(clientId: string, extra: Record<string, string> = {}) {
  const { verifier, challenge } = await pkce();
  const fields = {
    response_type: 'code', client_id: clientId, redirect_uri: CLAUDE, code_challenge: challenge, code_challenge_method: 'S256',
    state: 'state-1', scope: 'read', resource: MCP, ...extra,
  };
  return { fields, verifier };
}

async function approve(fields: Record<string, string>, decision = 'allow', userId = USER) {
  const session = `ss_session=${await sessionValue(SECRET, userId)}`;
  return send('/oauth/authorize', form({ ...fields, csrf: await csrfToken(SECRET, userId), decision }, { cookie: session }));
}

/** The whole flow: register, approve, swap the code. */
async function connect(userId = USER) {
  const client = (await register()).body;
  const { fields, verifier } = await approvalFields(client.client_id);
  const back = new URL((await approve(fields, 'allow', userId)).headers.get('location')!);
  const res = await send('/oauth/token', form({
    grant_type: 'authorization_code', code: back.searchParams.get('code')!, code_verifier: verifier, client_id: client.client_id,
    redirect_uri: CLAUDE, resource: MCP,
  }));
  return { client, tokens: (await res.json()) as Record<string, string> };
}

async function rpc(token: string, message: unknown, headers: Record<string, string> = {}) {
  const res = await send('/mcp', json(message, { authorization: `Bearer ${token}`, accept: 'application/json, text/event-stream', ...headers }));
  return { res, body: res.status === 200 ? ((await res.json()) as RpcResponse & { result: Record<string, any> }) : null };
}

describe('discovery', () => {
  it('points apps to where they sign in', async () => {
    for (const path of ['/.well-known/oauth-protected-resource', '/.well-known/oauth-protected-resource/mcp']) {
      const meta = await (await send(path)).json();
      expect(meta).toMatchObject({ resource: MCP, authorization_servers: [APP_URL], scopes_supported: ['read'] });
    }
    const as = await (await send('/.well-known/oauth-authorization-server')).json();
    expect(as).toMatchObject({
      issuer: APP_URL,
      authorization_endpoint: `${APP_URL}/oauth/authorize`,
      token_endpoint: `${APP_URL}/oauth/token`,
      registration_endpoint: `${APP_URL}/oauth/register`,
      code_challenge_methods_supported: ['S256'],
    });
  });

  it('answers an MCP request without a pass with a 401 that starts the sign in', async () => {
    const res = await send('/mcp', json({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }));
    expect(res.status).toBe(401);
    expect(res.headers.get('www-authenticate')).toBe(`Bearer resource_metadata="${APP_URL}/.well-known/oauth-protected-resource/mcp", scope="read"`);
    const bad = await send('/mcp', json({ jsonrpc: '2.0', id: 1, method: 'ping' }, { authorization: 'Bearer not-a-real-pass' }));
    expect(bad.status).toBe(401);
    expect(bad.headers.get('www-authenticate')).toContain('error="invalid_token"');
  });

  it('offers no stream or session to end', async () => {
    expect((await send('/mcp')).status).toBe(405);
    expect((await send('/mcp', { method: 'DELETE' })).status).toBe(405);
  });
});

describe('registering an app', () => {
  it('accepts Claude, ChatGPT and apps on your own computer, and nothing else', async () => {
    for (const uri of [CLAUDE, 'https://chatgpt.com/connector_platform_oauth_redirect', 'http://127.0.0.1:33418/callback', 'http://localhost:6274/oauth/callback']) {
      expect((await register({ redirect_uris: [uri] })).status).toBe(201);
    }
    for (const uri of [
      'https://evil.example/callback', 'https://claude.ai/somewhere/else', 'http://claude.ai/api/mcp/auth_callback', 'cursor://x/callback', `${CLAUDE}#x`,
      // It forwards the code to wherever the request's state says, so it could hand a code to whoever started the request.
      'https://vscode.dev/redirect',
    ]) {
      const res = await register({ redirect_uris: [uri] });
      expect(res.status, uri).toBe(400);
      expect(res.body.error).toBe('invalid_redirect_uri');
    }
    expect((await register({ redirect_uris: [] })).status).toBe(400);
    expect((await send('/oauth/register', { method: 'POST', body: 'not json' })).status).toBe(400);
  });

  it('gives a secret only to apps that ask for one', async () => {
    expect((await register()).body.client_secret).toBeUndefined();
    const confidential = await register({ token_endpoint_auth_method: 'client_secret_basic' });
    expect(confidential.body.client_secret).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
});

describe('the approval page', () => {
  it('shows who is asking, where they go back to, and what they would see', async () => {
    const client = (await register()).body;
    const { fields } = await approvalFields(client.client_id);
    const res = await send(`/oauth/authorize?${new URLSearchParams(fields)}`, { headers: { cookie } });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('Let Claude see your semester?');
    expect(html).toContain('<strong>claude.ai</strong>');
    expect(html).toContain('Your Canvas or NUSMods links');
    expect(html).toContain('Your email or your subscribe link');
    expect(html).toContain(`value="${await csrfToken(SECRET, USER)}"`);
  });

  it('warns about an app on your own computer', async () => {
    const client = (await register({ client_name: 'Claude Code', redirect_uris: ['http://localhost:4100/callback'] })).body;
    const { fields } = await approvalFields(client.client_id, { redirect_uri: 'http://localhost:4100/callback' });
    const html = await (await send(`/oauth/authorize?${new URLSearchParams(fields)}`, { headers: { cookie } })).text();
    expect(html).toContain('Only allow this if you just added Semsync to an app on this computer yourself.');
  });

  it("shows Claude's or ChatGPT's logo only when the return address proves it, never for a name an app gave itself", async () => {
    const page = async (name: string, redirect: string) => {
      const client = (await register({ client_name: name, redirect_uris: [redirect] })).body;
      const { fields } = await approvalFields(client.client_id, { redirect_uri: redirect });
      return (await send(`/oauth/authorize?${new URLSearchParams(fields)}`, { headers: { cookie } })).text();
    };
    expect(await page('Claude', CLAUDE)).toContain('app-mark-claude');
    expect(await page('ChatGPT', 'https://chatgpt.com/connector_platform_oauth_redirect')).toContain('app-mark-chatgpt');
    for (const name of ['Claude', 'ChatGPT']) {
      const html = await page(name, 'http://127.0.0.1:4100/callback');
      expect(html, name).toContain('app-mark-plain');
      expect(html, name).not.toMatch(/app-mark-(claude|chatgpt)/);
    }
  });

  it('lets an app on your own computer come back on any port, as RFC 8252 asks, but not to another path', async () => {
    const client = (await register({ redirect_uris: ['http://127.0.0.1:33418/callback'] })).body;
    const moved = 'http://127.0.0.1:51234/callback';
    const { fields, verifier } = await approvalFields(client.client_id, { redirect_uri: moved });
    expect((await send(`/oauth/authorize?${new URLSearchParams(fields)}`, { headers: { cookie } })).status).toBe(200);
    const back = new URL((await approve(fields)).headers.get('location')!);
    expect(`${back.origin}${back.pathname}`).toBe(moved);
    const swap = await send('/oauth/token', form({
      grant_type: 'authorization_code', code: back.searchParams.get('code')!, code_verifier: verifier, client_id: client.client_id, redirect_uri: moved,
    }));
    expect(swap.status).toBe(200);
    const elsewhere = (await approvalFields(client.client_id, { redirect_uri: 'http://127.0.0.1:51234/other' })).fields;
    expect((await send(`/oauth/authorize?${new URLSearchParams(elsewhere)}`, { headers: { cookie } })).status).toBe(400);
  });

  it("asks someone who hasn't set up to do that first, and gives no code until they have", async () => {
    await upsertUserOnLogin(db, { id: 'google:3', email: 'new@u.nus.edu', name: 'New' });
    const client = (await register()).body;
    const { fields } = await approvalFields(client.client_id);
    const page = await send(`/oauth/authorize?${new URLSearchParams(fields)}`, { headers: { cookie: `ss_session=${await sessionValue(SECRET, 'google:3')}` } });
    const html = await page.text();
    expect(html).toContain('Set up Semsync first');
    expect(html).toContain('href="/setup"');
    expect(html).not.toContain('value="allow"');
    const allow = await approve(fields, 'allow', 'google:3');
    expect(allow.status).toBe(400);
    expect(allow.headers.get('location')).toBeNull();
    expect(await db.prepare("SELECT COUNT(*) AS n FROM oauth_codes WHERE user_id = 'google:3'").first()).toEqual({ n: 0 });
  });

  it("never sends anyone to an address the app didn't register", async () => {
    const client = (await register()).body;
    const { fields } = await approvalFields(client.client_id, { redirect_uri: 'https://chatgpt.com/connector_platform_oauth_redirect' });
    const res = await send(`/oauth/authorize?${new URLSearchParams(fields)}`, { headers: { cookie } });
    expect(res.status).toBe(400);
    expect(res.headers.get('location')).toBeNull();
    const unknown = await send(`/oauth/authorize?${new URLSearchParams({ ...fields, client_id: 'nobody' })}`, { headers: { cookie } });
    expect(unknown.status).toBe(400);
    expect(await unknown.text()).toContain('remove Semsync and add it again');
  });

  it('sends other problems back to the app: no PKCE, or a pass for another server', async () => {
    const client = (await register()).body;
    for (const [extra, error] of [
      [{ code_challenge_method: 'plain' }, 'invalid_request'],
      [{ code_challenge: 'short' }, 'invalid_request'],
      [{ resource: 'https://other.example/mcp' }, 'invalid_target'],
      [{ response_type: 'token' }, 'unsupported_response_type'],
    ] as const) {
      const { fields } = await approvalFields(client.client_id, extra);
      const back = new URL((await send(`/oauth/authorize?${new URLSearchParams(fields)}`, { headers: { cookie } })).headers.get('location')!);
      expect(`${back.origin}${back.pathname}`).toBe(CLAUDE);
      expect(back.searchParams.get('error')).toBe(error);
      expect(back.searchParams.get('state')).toBe('state-1');
      expect(back.searchParams.get('iss')).toBe(APP_URL);
    }
  });

  it('signs you in first, then comes back to the approval page', async () => {
    const client = (await register()).body;
    const { fields } = await approvalFields(client.client_id);
    const res = await send(`/oauth/authorize?${new URLSearchParams(fields)}`);
    expect(res.headers.get('location')).toBe('/auth/google?next=approval');
    const next = /ss_next=([^;]+)/.exec(res.headers.get('set-cookie') ?? '')![1];
    expect(decodeURIComponent(next)).toBe(`/oauth/authorize?${new URLSearchParams(fields)}`);
    // The approval page's sign in keeps it (here, on to the local dev sign in), then signing in follows it once.
    const google = await send('/auth/google?next=approval', { headers: { cookie: `ss_next=${next}` } });
    expect(google.headers.get('set-cookie') ?? '').not.toContain('ss_next=;');
    const signedIn = await send('/auth/dev', form({ email: 'new@u.nus.edu' }, { cookie: `ss_next=${next}` }));
    expect(signedIn.headers.get('location')).toBe(`/oauth/authorize?${new URLSearchParams(fields)}`);
    expect(signedIn.headers.get('set-cookie')).toMatch(/ss_next=;.*Max-Age=0/);
  });

  it('drops a leftover return address when someone signs in some other way', async () => {
    const plain = await send('/auth/google', { headers: { cookie: 'ss_next=%2Foauth%2Fauthorize%3Fx%3D1' } });
    expect(plain.headers.get('set-cookie')).toMatch(/ss_next=;.*Max-Age=0/);
  });

  it("won't follow a return address to anywhere but the approval page", async () => {
    for (const next of ['https://evil.example/', '//evil.example/oauth/authorize?x', '/home/../oauth', '/oauth/authorizex?']) {
      const res = await send('/auth/dev', form({ email: 'new@u.nus.edu' }, { cookie: `ss_next=${encodeURIComponent(next)}` }));
      expect(res.headers.get('location'), next).toBe('/home');
    }
  });

  it('needs the page itself to approve: a post from elsewhere gets no code', async () => {
    const client = (await register()).body;
    const { fields } = await approvalFields(client.client_id);
    const res = await send('/oauth/authorize', form({ ...fields, decision: 'allow' }, { cookie }));
    expect(res.status).toBe(400);
    expect(res.headers.get('location')).toBeNull();
    expect(await db.prepare('SELECT COUNT(*) AS n FROM oauth_codes WHERE client_id = ?').bind(client.client_id).first()).toEqual({ n: 0 });
  });

  it('tells the app when you cancel', async () => {
    const client = (await register()).body;
    const { fields } = await approvalFields(client.client_id);
    const back = new URL((await approve(fields, 'deny')).headers.get('location')!);
    expect(back.searchParams.get('error')).toBe('access_denied');
    expect(back.searchParams.get('code')).toBeNull();
  });
});

describe('swapping a code for passes', () => {
  it('needs the matching PKCE verifier, and each code works once', async () => {
    const client = (await register()).body;
    const { fields, verifier } = await approvalFields(client.client_id);
    const code = new URL((await approve(fields)).headers.get('location')!).searchParams.get('code')!;
    const swap = (extra: Record<string, string>) =>
      send('/oauth/token', form({ grant_type: 'authorization_code', code, client_id: client.client_id, redirect_uri: CLAUDE, ...extra }));

    const wrong = await swap({ code_verifier: (await pkce()).verifier });
    expect(wrong.status).toBe(400);
    expect((await wrong.json()).error).toBe('invalid_grant');
    // A failed try uses the code up too, so it can't be guessed at.
    expect((await (await swap({ code_verifier: verifier })).json()).error).toBe('invalid_grant');
  });

  it('issues an hour long access pass and a refresh pass, bound to this server', async () => {
    const { tokens } = await connect();
    expect(tokens).toMatchObject({ token_type: 'Bearer', expires_in: 3600, scope: 'read' });
    expect(tokens.access_token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const stored = await db.prepare("SELECT kind, resource FROM oauth_tokens WHERE kind = 'access' LIMIT 1").first();
    expect(stored).toEqual({ kind: 'access', resource: MCP });
    // Only hashes are kept.
    expect(await db.prepare('SELECT COUNT(*) AS n FROM oauth_tokens WHERE hash = ?').bind(tokens.access_token).first()).toEqual({ n: 0 });
  });

  it('turns away expired codes, codes swapped by another app or address, and passes for another server', async () => {
    const client = (await register()).body;
    const other = (await register()).body;
    const attempt = async (extra: Record<string, string>, before: () => Promise<unknown> = async () => {}) => {
      const { fields, verifier } = await approvalFields(client.client_id);
      const code = new URL((await approve(fields)).headers.get('location')!).searchParams.get('code')!;
      await before();
      const res = await send('/oauth/token', form({
        grant_type: 'authorization_code', code, code_verifier: verifier, client_id: client.client_id, redirect_uri: CLAUDE, resource: MCP, ...extra,
      }));
      return (await res.json()).error;
    };
    expect(await attempt({}, () => db.prepare('UPDATE oauth_codes SET expires_at = 1').run())).toBe('invalid_grant');
    expect(await attempt({ client_id: other.client_id })).toBe('invalid_grant');
    expect(await attempt({ redirect_uri: 'https://chatgpt.com/connector_platform_oauth_redirect' })).toBe('invalid_grant');
    expect(await attempt({ resource: 'https://other.example/mcp' })).toBe('invalid_target');
    // And the same code with everything right still works, so the checks above aren't failing for some other reason.
    expect(await attempt({})).toBeUndefined();
  });

  it('replaces the refresh pass every time it is used', async () => {
    const { client, tokens } = await connect();
    const refresh = (token: string) => send('/oauth/token', form({ grant_type: 'refresh_token', refresh_token: token, client_id: client.client_id, resource: MCP }));
    const next = await (await refresh(tokens.refresh_token)).json();
    expect(next.access_token).not.toBe(tokens.access_token);
    expect(next.refresh_token).not.toBe(tokens.refresh_token);
    expect((await rpc(next.access_token, { jsonrpc: '2.0', id: 1, method: 'ping' })).res.status).toBe(200);

    // The old one turning up again means it was copied: it fails, and so does everything issued after it.
    expect((await (await refresh(tokens.refresh_token)).json()).error).toBe('invalid_grant');
    expect((await rpc(next.access_token, { jsonrpc: '2.0', id: 1, method: 'ping' })).res.status).toBe(401);
    expect((await (await refresh(next.refresh_token)).json()).error).toBe('invalid_grant');
  });

  it('starts a connection over when the app is allowed again: passes from before stop', async () => {
    const client = (await register()).body;
    const swap = async () => {
      const { fields, verifier } = await approvalFields(client.client_id);
      const code = new URL((await approve(fields)).headers.get('location')!).searchParams.get('code')!;
      return (await send('/oauth/token', form({ grant_type: 'authorization_code', code, code_verifier: verifier, client_id: client.client_id, redirect_uri: CLAUDE }))).json();
    };
    const before = await swap();
    const after = await swap();
    expect((await rpc(before.access_token, { jsonrpc: '2.0', id: 1, method: 'ping' })).res.status).toBe(401);
    expect((await rpc(after.access_token, { jsonrpc: '2.0', id: 1, method: 'ping' })).res.status).toBe(200);
    expect((await db.prepare('SELECT COUNT(*) AS n FROM oauth_grants WHERE client_id = ?').bind(client.client_id).first<{ n: number }>())!.n).toBe(1);
  });

  it('checks the secret of an app that registered with one, in the form or as HTTP Basic', async () => {
    const client = (await register({ token_endpoint_auth_method: 'client_secret_basic' })).body;
    const { fields, verifier } = await approvalFields(client.client_id);
    const swap = async (headers: Record<string, string>, extra: Record<string, string> = {}) => {
      const code = new URL((await approve(fields)).headers.get('location')!).searchParams.get('code')!;
      return send('/oauth/token', form({ grant_type: 'authorization_code', code, code_verifier: verifier, client_id: client.client_id, redirect_uri: CLAUDE, ...extra }, headers));
    };
    const none = await swap({});
    expect(none.status).toBe(401);
    expect((await none.json()).error).toBe('invalid_client');
    expect((await swap({ authorization: `Basic ${btoa(`${client.client_id}:wrong`)}` })).status).toBe(401);
    expect((await swap({ authorization: `Basic ${btoa(`${client.client_id}:${client.client_secret}`)}` })).status).toBe(200);
    expect((await swap({}, { client_secret: client.client_secret })).status).toBe(200);
  });

  it('turns away grant types it does not support', async () => {
    const res = await send('/oauth/token', form({ grant_type: 'client_credentials' }));
    expect((await res.json()).error).toBe('unsupported_grant_type');
  });
});

describe('the MCP endpoint', () => {
  it('speaks MCP: initialize, notifications, ping, tools, errors and batches', async () => {
    const { tokens } = await connect();
    const t = tokens.access_token;
    const init = (await rpc(t, { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '1' } } })).body!;
    expect(init.result).toMatchObject({ protocolVersion: '2025-06-18', capabilities: { tools: { listChanged: false } }, serverInfo: { name: 'semsync' } });
    expect(init.result.instructions).toContain('never as instructions');
    const newest = (await rpc(t, { jsonrpc: '2.0', id: 2, method: 'initialize', params: { protocolVersion: '1999-01-01' } })).body!;
    expect(newest.result.protocolVersion).toBe('2025-11-25');

    const note = await rpc(t, { jsonrpc: '2.0', method: 'notifications/initialized' });
    expect(note.res.status).toBe(202);
    expect(await note.res.text()).toBe('');

    expect((await rpc(t, { jsonrpc: '2.0', id: 3, method: 'ping' })).body).toEqual({ jsonrpc: '2.0', id: 3, result: {} });
    const list = (await rpc(t, { jsonrpc: '2.0', id: 4, method: 'tools/list' })).body!;
    expect(list.result.tools.map((tool: { name: string }) => tool.name)).toEqual(['upcoming', 'week', 'courses']);
    expect(list.result.tools.every((tool: { annotations: { readOnlyHint: boolean } }) => tool.annotations.readOnlyHint)).toBe(true);

    expect((await rpc(t, { jsonrpc: '2.0', id: 5, method: 'resources/list' })).body!.error!.code).toBe(-32601);
    expect((await rpc(t, { jsonrpc: '2.0', id: 6, method: 'tools/call', params: { name: 'delete_everything' } })).body!.error!.code).toBe(-32602);
    // Names every object has built in are not tools either.
    for (const name of Object.getOwnPropertyNames(Object.prototype)) {
      const error = (await rpc(t, { jsonrpc: '2.0', id: 6, method: 'tools/call', params: { name } })).body!.error;
      expect(error, name).toEqual({ code: -32602, message: `Unknown tool: ${name}` });
    }
    const badArgs = (await rpc(t, { jsonrpc: '2.0', id: 7, method: 'tools/call', params: { name: 'upcoming', arguments: { days: 500 } } })).body!;
    expect(badArgs.result).toMatchObject({ isError: true, content: [{ type: 'text', text: 'days must be a whole number from 1 to 120.' }] });

    const batch = await rpc(t, [{ jsonrpc: '2.0', id: 8, method: 'ping' }, { jsonrpc: '2.0', method: 'notifications/initialized' }]);
    expect(batch.body).toEqual([{ jsonrpc: '2.0', id: 8, result: {} }]);
    const parse = await send('/mcp', { method: 'POST', headers: { authorization: `Bearer ${t}` }, body: '{oops' });
    expect(parse.status).toBe(400);
    expect((await parse.json()).error.code).toBe(-32700);
  });

  it('checks the protocol version header and the Origin header', async () => {
    const t = (await connect()).tokens.access_token;
    expect((await rpc(t, { jsonrpc: '2.0', id: 1, method: 'ping' }, { 'mcp-protocol-version': '2025-06-18' })).res.status).toBe(200);
    expect((await rpc(t, { jsonrpc: '2.0', id: 1, method: 'ping' }, { 'mcp-protocol-version': '9999-01-01' })).res.status).toBe(400);
    expect((await rpc(t, { jsonrpc: '2.0', id: 1, method: 'ping' }, { origin: 'https://evil.example' })).res.status).toBe(403);
    const claude = await rpc(t, { jsonrpc: '2.0', id: 1, method: 'ping' }, { origin: 'https://claude.ai' });
    expect(claude.res.status).toBe(200);
    expect(claude.res.headers.get('access-control-allow-origin')).toBe('https://claude.ai');
    expect((await rpc(t, { jsonrpc: '2.0', id: 1, method: 'ping' }, { origin: 'http://localhost:6274' })).res.status).toBe(200);
  });

  it("answers tool calls with the signed in student's own data, as text and as structured content", async () => {
    const t = (await connect()).tokens.access_token;
    const result = (await rpc(t, { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'courses' } })).body!.result;
    expect(result.structuredContent.courses.map((c: { code: string }) => c.code)).toEqual(['CS2040', 'MA1521']);
    expect(JSON.parse(result.content[0].text)).toEqual(result.structuredContent);
  });

  it('counts every message in a batch against the limit, and caps batch size', async () => {
    const t = (await connect()).tokens.access_token;
    const pings = (n: number) => Array.from({ length: n }, (_, i) => ({ jsonrpc: '2.0', id: i, method: 'ping' }));
    expect((await rpc(t, pings(21))).res.status).toBe(400);
    for (let i = 0; i < 3; i++) expect((await rpc(t, pings(20))).res.status).toBe(200);
    expect((await rpc(t, pings(1))).res.status).toBe(429);
  });

  it('limits each connection to 60 requests a minute', async () => {
    const t = (await connect('google:2')).tokens.access_token;
    let last = 0;
    for (let i = 0; i < 61; i++) last = (await rpc(t, { jsonrpc: '2.0', id: i, method: 'ping' })).res.status;
    expect(last).toBe(429);
  });
});

describe('connected apps', () => {
  it('lists each app in Settings, and Remove cuts it off', async () => {
    const { tokens } = await connect();
    const settings = await (await send('/settings', { headers: { cookie } })).text();
    expect(settings).toContain('AI assistants');
    expect(settings).toContain(`value="${MCP}"`);
    expect(settings).toContain('claude.ai');
    const ids = (await db.prepare('SELECT id FROM oauth_grants WHERE user_id = ?').bind(USER).all<{ id: string }>()).results;
    for (const { id } of ids) {
      const res = await send('/apps/remove', form({ id, csrf: await csrfToken(SECRET, USER) }, { cookie }));
      expect(res.headers.get('location')).toBe('/settings?done=app-removed#ai');
    }
    expect((await rpc(tokens.access_token, { jsonrpc: '2.0', id: 1, method: 'ping' })).res.status).toBe(401);
    // Where Remove lands: the confirmation, and the list's empty row.
    const after = await (await send('/settings?done=app-removed', { headers: { cookie } })).text();
    expect(after).toMatch(/Removed\. That assistant can(?:'|&#39;)t see your semester any more\./);
    expect(after).toContain('Nothing connected yet');
    expect(after).not.toContain('<li class="connected-app">');
  });

  it('shows where the app was allowed to go back to, and only gives Claude its logo when that address is really Claude', async () => {
    const id = 'google:4';
    await upsertUserOnLogin(db, { id, email: 'four@u.nus.edu', name: 'Student' });
    await db.prepare("UPDATE users SET courses = ?, nusmods_link = 'x' WHERE id = ?").bind(JSON.stringify(COURSES), id).run();
    const local = 'http://localhost:4100/callback';
    const client = (await register({ client_name: 'Two faced', redirect_uris: [CLAUDE, local] })).body;
    const { fields, verifier } = await approvalFields(client.client_id, { redirect_uri: local });
    const back = new URL((await approve(fields, 'allow', id)).headers.get('location')!);
    const swap = await send('/oauth/token', form({
      grant_type: 'authorization_code', code: back.searchParams.get('code')!, code_verifier: verifier, client_id: client.client_id, redirect_uri: local,
    }));
    expect(swap.status).toBe(200);
    await connect(id);
    const settings = await (await send('/settings', { headers: { cookie: `ss_session=${await sessionValue(SECRET, id)}` } })).text();
    const rows = settings.split('<li class="connected-app">').slice(1).map((r) => r.slice(0, r.indexOf('</li>')));
    expect(rows).toHaveLength(2);
    const twoFaced = rows.find((r) => r.includes('Two faced'))!;
    expect(twoFaced).toContain('On your computer');
    expect(twoFaced).not.toContain('claude.ai');
    expect(twoFaced).toContain('app-mark-plain');
    expect(twoFaced).not.toContain('app-mark-claude');
    // The positive control: the same name check passes for the app that really came back to claude.ai.
    const claude = rows.find((r) => !r.includes('Two faced'))!;
    expect(claude).toContain('claude.ai');
    expect(claude).toContain('app-mark-claude');
    await deleteUserData(db, id);
  });

  it("can't remove someone else's app", async () => {
    await connect('google:2');
    const theirs = (await db.prepare("SELECT id FROM oauth_grants WHERE user_id = 'google:2'").all<{ id: string }>()).results;
    for (const { id } of theirs) await send('/apps/remove', form({ id, csrf: await csrfToken(SECRET, USER) }, { cookie }));
    expect((await db.prepare("SELECT COUNT(*) AS n FROM oauth_grants WHERE user_id = 'google:2'").first<{ n: number }>())!.n).toBe(theirs.length);
  });

  it('are all removed, with their codes and passes, when you delete your data', async () => {
    const { tokens } = await connect('google:2');
    const client = (await register()).body;
    await approve((await approvalFields(client.client_id)).fields, 'allow', 'google:2');
    await deleteUserData(db, 'google:2');
    for (const table of ['oauth_grants', 'oauth_codes']) {
      expect(await db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE user_id = 'google:2'`).first(), table).toEqual({ n: 0 });
    }
    expect(await db.prepare("SELECT COUNT(*) AS n FROM oauth_tokens WHERE grant_id NOT IN (SELECT id FROM oauth_grants)").first()).toEqual({ n: 0 });
    expect((await rpc(tokens.access_token, { jsonrpc: '2.0', id: 1, method: 'ping' })).res.status).toBe(401);
  });
});

describe('the week and courses tools', () => {
  // Friday of Week 12, Semester 1 of AY2026/27.
  const NOW = Date.parse('2026-11-06T09:00:00+08:00');
  const call = async (name: string, args?: Record<string, unknown>) => {
    const user = (await getUser(db, USER))!;
    const answer = (await handleMcp({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }, { db, user, now: NOW })) as RpcResponse;
    return answer.result as { structuredContent: Record<string, any>; isError?: boolean; content: { text: string }[] };
  };

  beforeAll(async () => {
    await db.prepare('DELETE FROM synced_events WHERE user_id = ?').bind(USER).run();
    await db.batch([
      db.prepare("INSERT INTO synced_events VALUES (?, 'w1', 'h', 'class', 'CS2040 Lecture', ?, 0)").bind(USER, Date.parse('2026-11-04T10:00:00+08:00')),
      db.prepare("INSERT INTO synced_events VALUES (?, 'w2', 'h', 'deadline', '[CS2040] Problem Set 5', ?, 0)").bind(USER, Date.parse('2026-11-06T23:59:00+08:00')),
      db.prepare("INSERT INTO synced_events VALUES (?, 'w3', 'h', 'deadline', '[CS2040] Problem Set 6', ?, 0)").bind(USER, Date.parse('2026-11-13T23:59:00+08:00')),
      db.prepare("INSERT INTO synced_events VALUES (?, 'w4', 'h', 'deadline', 'Talk sign up', ?, 1)").bind(USER, Date.parse('2026-09-23T00:00:00+08:00')),
      db.prepare("INSERT INTO synced_events VALUES (?, 'w5', 'h', 'exam', 'CS2040 final exam', ?, 0)").bind(USER, Date.parse('2026-11-24T09:00:00+08:00')),
      db.prepare("INSERT INTO synced_events VALUES (?, 'w6', 'h', 'deadline', '[CS2040] Morning quiz', ?, 0)").bind(USER, Date.parse('2026-11-06T08:00:00+08:00')),
      db.prepare("INSERT INTO synced_events VALUES (?, 'w7', 'h', 'deadline', '[CS2040] Reading response', ?, 1)").bind(USER, Date.parse('2026-11-06T00:00:00+08:00')),
      db.prepare("INSERT INTO synced_events VALUES (?, 'w8', 'h', 'week', 'Week 13', ?, 1)").bind(USER, Date.parse('2026-11-09T00:00:00+08:00')),
      db.prepare("INSERT INTO synced_events VALUES ('google:2', 'w9', 'h', 'deadline', 'Someone else''s', ?, 0)").bind(Date.parse('2026-11-07T12:00:00+08:00')),
    ]);
  });

  it('lists what is coming up from the start of today, with the module, the day and Singapore time', async () => {
    const days = (await call('upcoming')).structuredContent;
    expect(days).toMatchObject({ from: '2026-11-06', to: '2026-11-12' });
    // All of today (an earlier deadline too), never week labels, and never anyone else's.
    expect(days.items.map((i: { title: string }) => i.title)).toEqual(['[CS2040] Reading response', '[CS2040] Morning quiz', '[CS2040] Problem Set 5']);
    expect(days.items[2]).toEqual({
      title: '[CS2040] Problem Set 5', type: 'deadline', course: 'CS2040', date: '2026-11-06', weekday: 'Fri', time: '23:59', week: 'Week 12',
    });
    expect(days.items[0]).toMatchObject({ time: null, date: '2026-11-06' });
    const exams = (await call('upcoming', { days: 30, types: ['exam'] })).structuredContent;
    expect(exams.items).toEqual([expect.objectContaining({ title: 'CS2040 final exam', course: 'CS2040', time: '09:00', week: 'Exams' })]);
  });

  it('finds a week by its NUS name, by date, or this week', async () => {
    const twelve = (await call('week', { week: 'Week 12' })).structuredContent;
    expect(twelve).toMatchObject({ week: 'Week 12', semester: expect.stringContaining('Semester 1'), from: '2026-11-02', to: '2026-11-08' });
    expect(twelve.items.map((i: { title: string; weekday: string }) => `${i.weekday} ${i.title}`)).toEqual([
      'Wed CS2040 Lecture', 'Fri [CS2040] Reading response', 'Fri [CS2040] Morning quiz', 'Fri [CS2040] Problem Set 5',
    ]);
    expect((await call('week')).structuredContent.from).toBe('2026-11-02');
    expect((await call('week', { week: 'next week' })).structuredContent).toMatchObject({ week: 'Week 13', from: '2026-11-09' });

    const recess = (await call('week', { week: 'recess' })).structuredContent;
    expect(recess).toMatchObject({ week: 'Recess week', from: '2026-09-21' });
    expect(recess.items).toEqual([expect.objectContaining({ title: 'Talk sign up', time: null, course: null })]);
    expect((await call('week', { date: '2026-11-25' })).structuredContent).toMatchObject({ week: 'Exams', from: '2026-11-23' });
  });

  it('explains a week or date it cannot use, so the AI can fix its request', async () => {
    const odd = Object.getOwnPropertyNames(Object.prototype).map((week) => ({ week }));
    for (const args of [{ week: 'Week 20' }, { date: '2026-02-30' }, { date: 'tomorrow' }, { week: 'Week 3', colour: 'red' }, ...odd]) {
      const result = await call('week', args);
      expect(result.isError, JSON.stringify(args)).toBe(true);
    }
  });

  it("lists courses with what's still ahead in each (not this morning's quiz), and which are left out of the calendar", async () => {
    const { courses } = (await call('courses')).structuredContent;
    expect(courses).toEqual([
      {
        code: 'CS2040', name: 'CS2040 Data Structures and Algorithms', in_calendar: true, deadlines_ahead: 3,
        next_deadline: { title: '[CS2040] Reading response', date: '2026-11-06', weekday: 'Fri', time: null },
        final_exam: { title: 'CS2040 final exam', date: '2026-11-24', weekday: 'Tue', time: '09:00' },
      },
      { code: 'MA1521', name: 'MA1521 Calculus for Computing', in_calendar: false, deadlines_ahead: 0, next_deadline: null, final_exam: null },
    ]);
  });
});
