// Runs one SQL query and prints the rows as JSON. Handy in development, while `npm run dev` is running:
//   npm run sql -- "SELECT id, email, mode FROM users"
import { databaseUrl, LOCAL_DATABASE_URL } from '../src/env.js';
import { openDb } from '../src/lib/database.js';

const query = process.argv[2];
if (!query) {
  console.error('Usage: npm run sql -- "<query>"');
  process.exit(1);
}
const url = databaseUrl() ?? LOCAL_DATABASE_URL;
const db = openDb(url);
try {
  console.log(JSON.stringify((await db.prepare(query).all()).results));
} catch (err) {
  if (url === LOCAL_DATABASE_URL && (err as { code?: string }).code === 'ECONNREFUSED') {
    console.error('The local database runs inside `npm run dev`. Start that first.');
    process.exitCode = 1;
  } else throw err;
} finally {
  await db.close();
}
