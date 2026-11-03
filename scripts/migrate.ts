// Applies migrations/*.sql in order, once each. Uses TURSO_DATABASE_URL (or the local file database).
//   npm run db:migrate
// With --production-build-only it does nothing unless this is a Vercel production build (used by `npm run build`).
import { readdirSync, readFileSync } from 'node:fs';
import { openDb } from '../src/lib/database.js';

if (process.argv.includes('--production-build-only') && process.env.VERCEL_ENV !== 'production') {
  console.log('Not a production build, skipping migrations.');
  process.exit(0);
}
if (process.env.VERCEL && !process.env.TURSO_DATABASE_URL) {
  console.log('No TURSO_DATABASE_URL yet: connect a Turso database to the project, then redeploy.');
  process.exit(0);
}

const db = openDb(process.env.TURSO_DATABASE_URL ?? 'file:local.db', process.env.TURSO_AUTH_TOKEN);
await db.exec('CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)');
const applied = new Set((await db.prepare('SELECT name FROM _migrations').all<{ name: string }>()).results.map((r) => r.name));

const files = readdirSync('migrations').filter((f) => f.endsWith('.sql')).sort();
for (const file of files) {
  if (applied.has(file)) continue;
  await db.exec(readFileSync(`migrations/${file}`, 'utf8'));
  await db.prepare('INSERT INTO _migrations (name, applied_at) VALUES (?, ?)').bind(file, Date.now()).run();
  console.log(`Applied ${file}`);
}
console.log(`Database is up to date (${files.length} migrations).`);
