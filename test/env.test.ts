import { afterEach, describe, expect, it, vi } from 'vitest';

// A Vercel deployment before its database and secrets are added.
async function unconfigured() {
  vi.resetModules();
  vi.stubEnv('VERCEL', '1');
  for (const name of ['DATABASE_URL', 'POSTGRES_URL', 'SESSION_SECRET', 'ENCRYPTION_KEY', 'CRON_SECRET']) {
    vi.stubEnv(name, '');
  }
  const { getEnv } = await import('../src/env');
  const { default: app } = await import('../src/app');
  return { getEnv, app };
}

const get = (app: { fetch: (r: Request) => Response | Promise<Response> }, path: string, headers: Record<string, string> = {}) =>
  app.fetch(new Request(`https://semsync.example${path}`, { headers }));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('a deployment that is not set up yet', () => {
  it('still serves the public pages, which Google needs for the OAuth consent screen', async () => {
    const { app } = await unconfigured();
    for (const path of ['/', '/privacy', '/terms']) expect((await get(app, path)).status, path).toBe(200);
  });

  it('keeps the cron endpoint closed', async () => {
    const { app } = await unconfigured();
    expect((await get(app, '/api/cron', { authorization: 'Bearer ' })).status).toBe(401);
  });

  it('fails a signed-in request instead of trusting a session it cannot check', async () => {
    const { app } = await unconfigured();
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect((await get(app, '/home', { cookie: 'ss_session=forged' })).status).toBe(500);
    expect(String(logged.mock.calls[0]?.[0])).toContain('SESSION_SECRET is not set');
  });

  it('names the missing setting when the database or a secret is first used', async () => {
    const { getEnv } = await unconfigured();
    const env = getEnv();
    expect(env.APP_NAME).toBe('Semsync');
    expect(() => env.DB).toThrow('POSTGRES_URL is not set');
    expect(() => env.SESSION_SECRET).toThrow('SESSION_SECRET is not set');
    expect(() => env.ENCRYPTION_KEY).toThrow('ENCRYPTION_KEY is not set');
  });
});

describe('the old address', () => {
  async function live(env: Record<string, string>) {
    vi.resetModules();
    for (const [k, v] of Object.entries({ VERCEL: '1', VERCEL_ENV: 'production', APP_URL: 'https://semsync.live', CRON_SECRET: '', ...env })) vi.stubEnv(k, v);
    const { default: app } = await import('../src/app');
    return (url: string) => app.fetch(new Request(url));
  }

  it('sends visitors on the live site to semsync.live, keeping the page and query', async () => {
    const fetch = await live({});
    const res = await fetch('https://getsemsync.vercel.app/help?from=old');
    expect(res.status).toBe(308);
    expect(res.headers.get('location')).toBe('https://semsync.live/help?from=old');
    expect((await fetch('https://semsync.live/privacy')).status).toBe(200);
  });

  it('leaves the scheduled sync and subscribe links where they are', async () => {
    const fetch = await live({});
    expect((await fetch('https://getsemsync.vercel.app/api/cron')).status).toBe(401);
    const { movedTo } = await import('../src/app');
    expect(movedTo('https://getsemsync.vercel.app/feed/abc.ics', { APP_URL: 'https://semsync.live', PRODUCTION: true })).toBeNull();
  });

  it('never moves anyone on a preview deployment, or before the site has its own domain', async () => {
    const { movedTo } = await import('../src/app');
    expect(movedTo('https://semsync-git-x.vercel.app/', { APP_URL: 'https://semsync.live', PRODUCTION: false })).toBeNull();
    expect(movedTo('https://getsemsync.vercel.app/', { APP_URL: 'https://getsemsync.vercel.app', PRODUCTION: true })).toBeNull();
  });
});
