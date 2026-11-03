import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { openDb } from '../src/lib/database';
import { dueUsers, getUser, recordSync, upsertUserOnLogin } from '../src/lib/db';

describe('libSQL database adapter', () => {
  it('supports the D1 style calls the app uses', async () => {
    const db = openDb(':memory:');
    await db.exec('CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT, note TEXT); CREATE TABLE u (x INTEGER);');

    expect((await db.prepare('INSERT INTO t (name, note) VALUES (?, ?)').bind('a', undefined).run()).changes).toBe(1);
    await db.batch([
      db.prepare('INSERT INTO t (name) VALUES (?)').bind('b'),
      db.prepare('INSERT INTO t (name) VALUES (?)').bind('c'),
    ]);

    expect(await db.prepare('SELECT name, note FROM t WHERE id = ?').bind(1).first()).toEqual({ name: 'a', note: null });
    expect(await db.prepare('SELECT name FROM t WHERE id = ?').bind(99).first()).toBeNull();
    const { results } = await db.prepare('SELECT id, name FROM t ORDER BY id').all<{ id: number; name: string }>();
    expect(results).toEqual([{ id: 1, name: 'a' }, { id: 2, name: 'b' }, { id: 3, name: 'c' }]);
    expect(typeof results[0].id).toBe('number');
  });

  it('rolls back a whole batch when one statement fails', async () => {
    const db = openDb(':memory:');
    await db.exec('CREATE TABLE t (id INTEGER PRIMARY KEY)');
    await expect(
      db.batch([db.prepare('INSERT INTO t (id) VALUES (1)'), db.prepare('INSERT INTO t (id) VALUES (1)')]),
    ).rejects.toThrow();
    expect((await db.prepare('SELECT COUNT(*) AS n FROM t').first<{ n: number }>())?.n).toBe(0);
  });

  it('runs the real schema and queries', async () => {
    const db = openDb(':memory:');
    await db.exec(readFileSync('migrations/0001_init.sql', 'utf8'));
    await upsertUserOnLogin(db, { id: 'google:1', email: 'a@example.com', name: 'A' });
    await upsertUserOnLogin(db, { id: 'google:1', email: 'new@example.com', name: 'A' });
    const user = await getUser(db, 'google:1');
    expect(user).toMatchObject({ email: 'new@example.com', mode: 'main', needs_reconnect: 0, calendar_id: null });

    await db.prepare("UPDATE users SET calendar_id = 'primary', canvas_feed_enc = 'x' WHERE id = 'google:1'").run();
    expect((await dueUsers(db, 55 * 60_000, 10)).map((u) => u.id)).toEqual(['google:1']);
    await recordSync(db, 'google:1', true, '');
    expect(await dueUsers(db, 55 * 60_000, 10)).toEqual([]);
  });
});
