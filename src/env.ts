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

/** The Postgres that `npm run dev` runs in-process (PGlite) and serves on this port when no database is set. */
export const LOCAL_DATABASE_URL = 'postgres://postgres@127.0.0.1:5433/postgres';

/**
 * Where the database is: DATABASE_URL if set, else the POSTGRES_URL the Supabase integration adds on Vercel (its pooled
 * connection), else, outside Vercel, the local one. Undefined on Vercel before Supabase is connected.
 */
export function databaseUrl(e: NodeJS.ProcessEnv = process.env): string | undefined {
  return e.DATABASE_URL || e.POSTGRES_URL || (e.VERCEL ? undefined : LOCAL_DATABASE_URL);
}

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
  // The database and secrets are read when first used, so a missing one fails that request with a clear error
  // while the public pages (home, privacy, terms) still load on a deployment that isn't fully set up yet.
  let db: Db | undefined;
  env = {
    get DB() {
      return (db ??= openDb(databaseUrl(e) ?? required('POSTGRES_URL')));
    },
    APP_NAME: e.APP_NAME ?? 'Semsync',
    SYNC_BATCH: e.SYNC_BATCH ?? '10',
    ALLOWED_CANVAS_HOSTS: e.ALLOWED_CANVAS_HOSTS ?? 'canvas.nus.edu.sg',
    get SESSION_SECRET() {
      return required('SESSION_SECRET');
    },
    get ENCRYPTION_KEY() {
      return required('ENCRYPTION_KEY');
    },
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
