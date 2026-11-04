import { readdirSync, readFileSync } from 'node:fs';
import type { Db } from './database.js';

/** Applies migrations/*.sql in order, once each, and returns the names it applied. */
export async function migrate(db: Db, dir = 'migrations'): Promise<string[]> {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at BIGINT NOT NULL);
    ALTER TABLE _migrations ENABLE ROW LEVEL SECURITY;
  `);
  const done = new Set((await db.prepare('SELECT name FROM _migrations').all<{ name: string }>()).results.map((r) => r.name));
  const applied: string[] = [];
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    if (done.has(file)) continue;
    await db.exec(readFileSync(`${dir}/${file}`, 'utf8'));
    await db.prepare('INSERT INTO _migrations (name, applied_at) VALUES (?, ?)').bind(file, Date.now()).run();
    applied.push(file);
  }
  return applied;
}
