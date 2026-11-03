import { openDb, type Db } from './lib/database.js';

export type Env = {
  DB: Db;
  APP_NAME: string;
  SYNC_BATCH: string;
  ALLOWED_CANVAS_HOSTS: string;
  // Secrets
  SESSION_SECRET: string;
  ENCRYPTION_KEY: string;
  /** Vercel sends this as "Authorization: Bearer <CRON_SECRET>" on cron calls; the GitHub Action sends it too. */
  CRON_SECRET?: string;
  GOOGLE_OAUTH_CLIENT_ID?: string;
  GOOGLE_OAUTH_CLIENT_SECRET?: string;
  GOOGLE_SERVICE_ACCOUNT_JSON?: string;
  // Local development only
  DEV_LOGIN?: string;
  FAKE_GOOGLE?: string;
};

let env: Env | undefined;

/** Settings from environment variables (Vercel project settings, or .env.local in development), read once. */
export function getEnv(): Env {
  if (env) return env;
  const e = process.env;
  const required = (name: string) => {
    const value = e[name];
    if (!value) throw new Error(`${name} is not set`);
    return value;
  };
  // On Vercel the file system is temporary, so production must use Turso.
  const dbUrl = e.VERCEL ? required('TURSO_DATABASE_URL') : (e.TURSO_DATABASE_URL ?? 'file:local.db');
  env = {
    DB: openDb(dbUrl, e.TURSO_AUTH_TOKEN),
    APP_NAME: e.APP_NAME ?? 'Semsync',
    SYNC_BATCH: e.SYNC_BATCH ?? '10',
    ALLOWED_CANVAS_HOSTS: e.ALLOWED_CANVAS_HOSTS ?? 'canvas.nus.edu.sg',
    SESSION_SECRET: required('SESSION_SECRET'),
    ENCRYPTION_KEY: required('ENCRYPTION_KEY'),
    CRON_SECRET: e.CRON_SECRET,
    GOOGLE_OAUTH_CLIENT_ID: e.GOOGLE_OAUTH_CLIENT_ID,
    GOOGLE_OAUTH_CLIENT_SECRET: e.GOOGLE_OAUTH_CLIENT_SECRET,
    GOOGLE_SERVICE_ACCOUNT_JSON: e.GOOGLE_SERVICE_ACCOUNT_JSON,
    // Dev switches can never turn on in a Vercel deployment.
    DEV_LOGIN: e.VERCEL ? undefined : e.DEV_LOGIN,
    FAKE_GOOGLE: e.VERCEL ? undefined : e.FAKE_GOOGLE,
  };
  return env;
}

export const isDev = (env: Env) => env.DEV_LOGIN === '1';

export const allowedCanvasHosts = (env: Env) =>
  env.ALLOWED_CANVAS_HOSTS.split(',').map((h) => h.trim()).filter(Boolean);
