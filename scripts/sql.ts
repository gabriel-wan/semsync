// Runs one SQL query against the database and prints the rows as JSON. Handy in development:
//   npm run sql -- "SELECT id, email, mode FROM users"
import { openDb } from '../src/lib/database.js';

const sql = process.argv[2];
if (!sql) {
  console.error('Usage: npm run sql -- "<query>"');
  process.exit(1);
}
const db = openDb(process.env.TURSO_DATABASE_URL ?? 'file:local.db', process.env.TURSO_AUTH_TOKEN);
console.log(JSON.stringify((await db.prepare(sql).all()).results));
