export type Env = {
  DB: D1Database;
  APP_NAME: string;
  SYNC_BATCH: string;
  ALLOWED_CANVAS_HOSTS: string;
  // Secrets
  SESSION_SECRET: string;
  ENCRYPTION_KEY: string;
  GOOGLE_OAUTH_CLIENT_ID?: string;
  GOOGLE_OAUTH_CLIENT_SECRET?: string;
  GOOGLE_SERVICE_ACCOUNT_JSON?: string;
  // Local development only
  DEV_LOGIN?: string;
  FAKE_GOOGLE?: string;
};

export const isDev = (env: Env) => env.DEV_LOGIN === '1';

export const allowedCanvasHosts = (env: Env) =>
  env.ALLOWED_CANVAS_HOSTS.split(',').map((h) => h.trim()).filter(Boolean);
