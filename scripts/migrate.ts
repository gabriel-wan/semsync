// Applies migrations/*.sql in order, once each, to DATABASE_URL or POSTGRES_URL. (`npm run dev` migrates its local
// database by itself.)
//   npm run db:migrate
// With --production-build-only it does nothing unless this is a Vercel production build (used by `npm run build`).
import { databaseUrl } from '../src/env.js';
import { openDb } from '../src/lib/database.js';
import { migrate } from '../src/lib/migrate.js';

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
} finally {
  await db.close();
}
