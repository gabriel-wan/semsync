// The scheduled sync, run by the database itself. GitHub's scheduled workflows are best effort (in practice they ran
// about every six hours), and Vercel's free plan only runs a cron job once a day. Supabase's Postgres has a scheduler
// (pg_cron) and can make web requests (pg_net), so it calls /api/cron on time, every 20 minutes. Each call syncs
// whoever is due, so everyone is still synced about hourly.
//
// Every production build sets this up again (scripts/migrate.ts), so a changed CRON_SECRET or address takes effect on
// the next deploy. The secret is kept in Supabase Vault, encrypted, and passed in as a bound value, never as text in
// the job. Where those extensions don't exist (PGlite locally and in tests, other Postgres hosts), it does nothing.
import type { Db } from './database.js';

export const JOB_NAME = 'semsync-sync';
export const SCHEDULE = '2,22,42 * * * *';
const SECRET_NAME = 'semsync_cron_secret';

/** The SQL the scheduler runs: a GET to the sync with the secret from the vault, allowed up to 5 minutes. */
export function syncCommand(appUrl: string): string {
  const url = new URL('/api/cron', appUrl);
  // The address goes into SQL text, so only a plain https origin is allowed.
  if (url.protocol !== 'https:' || !/^[a-z0-9.-]+$/i.test(url.host)) throw new Error(`Not a plain https address: ${appUrl}`);
  return `select net.http_get(
  url := '${url.href}',
  headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = '${SECRET_NAME}')),
  timeout_milliseconds := 300000
)`;
}

/** Sets up (or updates) the database's own schedule for the sync. Returns what it did, for the build log. */
export async function ensureScheduledSync(db: Db, opts: { appUrl: string; secret: string }): Promise<string> {
  const { results } = await db
    .prepare("SELECT name FROM pg_available_extensions WHERE name IN ('pg_cron', 'pg_net', 'supabase_vault')")
    .all<{ name: string }>();
  const available = new Set(results.map((r) => r.name));
  for (const name of ['pg_cron', 'pg_net', 'supabase_vault']) {
    if (!available.has(name)) return `skipped: this database has no ${name}`;
  }
  const command = syncCommand(opts.appUrl);
  await db.exec('CREATE EXTENSION IF NOT EXISTS pg_cron; CREATE EXTENSION IF NOT EXISTS pg_net;');
  const existing = await db.prepare('SELECT id FROM vault.secrets WHERE name = ?').bind(SECRET_NAME).first<{ id: string }>();
  if (existing) {
    await db.prepare('SELECT vault.update_secret(?::uuid, ?)').bind(existing.id, opts.secret).run();
  } else {
    await db.prepare('SELECT vault.create_secret(?, ?, ?)').bind(opts.secret, SECRET_NAME, 'Bearer secret for the Semsync scheduled sync').run();
  }
  // Scheduling under the same name replaces the old job, so this is safe to run on every deploy.
  await db.prepare('SELECT cron.schedule(?, ?, ?)').bind(JOB_NAME, SCHEDULE, command).run();
  return `scheduled ${JOB_NAME} (${SCHEDULE}) to call ${new URL('/api/cron', opts.appUrl).href}`;
}
