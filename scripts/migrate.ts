// Applies migrations/*.sql in order, once each, to DATABASE_URL or POSTGRES_URL. (`npm run dev` migrates its local
// database by itself.)
//   npm run db:migrate
// With --production-build-only it does nothing unless this is a Vercel production build (used by `npm run build`).
// Then it sets up the database's own schedule for the sync (src/lib/scheduler.ts), where the database supports it.
import { databaseUrl } from '../src/env.js';
import { openDb } from '../src/lib/database.js';
import { migrate } from '../src/lib/migrate.js';
import { ensureScheduledSync } from '../src/lib/scheduler.js';

if (process.argv.includes('--production-build-only') && process.env.VERCEL_ENV !== 'production') {
  console.log('Not a production build, skipping migrations.');
  process.exit(0);
}
const url = databaseUrl();
if (!url) {
  console.log('No POSTGRES_URL yet: add Supabase to the project (Storage tab), then redeploy.');
  process.exit(0);
}

const db = openDb(url);
try {
  const applied = await migrate(db);
  for (const name of applied) console.log(`Applied ${name}`);
  console.log(applied.length ? 'Database is up to date.' : 'Database was already up to date.');

  const e = process.env;
  const appUrl = e.APP_URL || (e.VERCEL_PROJECT_PRODUCTION_URL ? `https://${e.VERCEL_PROJECT_PRODUCTION_URL}` : '');
  if (!e.CRON_SECRET || !appUrl.startsWith('https://')) {
    console.log('Scheduled sync: skipped (needs CRON_SECRET and an https APP_URL or production domain).');
  } else {
    // A problem here never fails the deploy: the GitHub Action still runs the sync, just less reliably.
    try {
      console.log(`Scheduled sync: ${await ensureScheduledSync(db, { appUrl, secret: e.CRON_SECRET })}`);
    } catch (err) {
      console.warn('Scheduled sync: not set up:', err instanceof Error ? err.message : err);
    }
  }
} finally {
  await db.close();
}
