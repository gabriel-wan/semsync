import { vi, afterEach, describe, expect, it } from 'vitest';
import { numberPlaceholders, type Db } from '../src/lib/database';
import { cachedModuleFetcher, claimDueUsers, deleteUserData, eventCounts, getUser, recordSync, upcomingEvents, upsertUserOnLogin } from '../src/lib/db';
import { migrate } from '../src/lib/migrate';
import { testDb } from './pg';

// The in-memory Postgres starts slowly when every test file runs at once, so these get longer than the 5 s default.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

let stop: (() => Promise<void>) | undefined;
async function freshDb(): Promise<Db> {
  const t = await testDb();
  stop = t.stop;
  return t.db;
}
afterEach(async () => {
  await stop?.();
  stop = undefined;
});

describe('placeholders', () => {
  it('numbers ? as $1, $2, … and leaves quoted text alone', () => {
    expect(numberPlaceholders("SELECT * FROM t WHERE a = ? AND b = 'what?' AND c IN (?, ?)")).toBe(
      "SELECT * FROM t WHERE a = $1 AND b = 'what?' AND c IN ($2, $3)",
    );
    expect(numberPlaceholders("SELECT 'it''s ?' , ?")).toBe("SELECT 'it''s ?' , $1");
  });
});

describe('Postgres database adapter', () => {
  it('supports the D1 style calls the app uses', async () => {
    const db = await freshDb();
    await db.exec('CREATE TABLE t (id SERIAL PRIMARY KEY, name TEXT, note TEXT, at BIGINT); CREATE TABLE u (x INTEGER);');

    expect((await db.prepare('INSERT INTO t (name, note, at) VALUES (?, ?, ?)').bind('a', undefined, Date.UTC(2026, 7, 10)).run()).changes).toBe(1);
    await db.batch([
      db.prepare('INSERT INTO t (name) VALUES (?)').bind('b'),
      db.prepare('INSERT INTO t (name) VALUES (?)').bind('c'),
    ]);

    expect(await db.prepare('SELECT name, note, at FROM t WHERE id = ?').bind(1).first()).toEqual({
      name: 'a',
      note: null,
      at: Date.UTC(2026, 7, 10),
    });
    expect(await db.prepare('SELECT name FROM t WHERE id = ?').bind(99).first()).toBeNull();
    const { results } = await db.prepare('SELECT id, name FROM t ORDER BY id').all<{ id: number; name: string }>();
    expect(results).toEqual([{ id: 1, name: 'a' }, { id: 2, name: 'b' }, { id: 3, name: 'c' }]);
    expect((await db.prepare('SELECT COUNT(*) AS n FROM t').first<{ n: number }>())?.n).toBe(3);
  });

  it('runs queries with different parameters at the same time', async () => {
    // Your Semsync page loads its counts and its upcoming list at once; locally both share one PGlite session.
    const db = await freshDb();
    await migrate(db);
    const runs = Array.from({ length: 12 }, (_, i) =>
      i % 2
        ? db.prepare('SELECT COUNT(*) AS n FROM users WHERE id = ?').bind(`u${i}`).first<{ n: number }>()
        : db.prepare('SELECT ? AS a, ? AS b, ? AS c').bind(`x${i}`, 'y', 'z').first<{ a: string }>(),
    );
    const results = await Promise.all(runs);
    results.forEach((r, i) => expect(r).toEqual(i % 2 ? { n: 0 } : { a: `x${i}`, b: 'y', c: 'z' }));
  });

  it('rolls back a whole batch when one statement fails', async () => {
    const db = await freshDb();
    await db.exec('CREATE TABLE t (id INTEGER PRIMARY KEY)');
    await expect(
      db.batch([db.prepare('INSERT INTO t (id) VALUES (1)'), db.prepare('INSERT INTO t (id) VALUES (1)')]),
    ).rejects.toThrow();
    expect((await db.prepare('SELECT COUNT(*) AS n FROM t').first<{ n: number }>())?.n).toBe(0);
  });

  it('applies each migration once and turns on row-level security for every table', async () => {
    const db = await freshDb();
    expect(await migrate(db)).toEqual(['0001_init.sql', '0002_course_settings.sql', '0003_feeds_and_rollover.sql']);
    expect(await migrate(db)).toEqual([]);
    const { results } = await db
      .prepare("SELECT relname, relrowsecurity FROM pg_class WHERE relkind = 'r' AND relnamespace = 'public'::regnamespace ORDER BY relname")
      .all<{ relname: string; relrowsecurity: boolean }>();
    expect(results.map((r) => r.relname)).toEqual(['_migrations', 'fake_calendars', 'fake_events', 'feeds', 'kv', 'module_cache', 'synced_events', 'users']);
    expect(results.every((r) => r.relrowsecurity)).toBe(true);
  });

  it('runs the real schema and queries', async () => {
    const db = await freshDb();
    await migrate(db);
    await upsertUserOnLogin(db, { id: 'google:1', email: 'a@example.com', name: 'A' });
    await upsertUserOnLogin(db, { id: 'google:1', email: 'new@example.com', name: 'A' });
    const user = await getUser(db, 'google:1');
    expect(user).toMatchObject({ email: 'new@example.com', mode: 'main', needs_reconnect: 0, calendar_id: null });
    expect(typeof user?.created_at).toBe('number');

    await db.prepare("UPDATE users SET calendar_id = 'primary', canvas_feed_enc = 'x' WHERE id = 'google:1'").run();
    await upsertUserOnLogin(db, { id: 'google:2', email: 'b@example.com', name: 'B' });
    await db.prepare("UPDATE users SET calendar_id = 'primary', nusmods_link = 'x', last_sync_at = 1 WHERE id = 'google:2'").run();
    // Never-synced users come first, then the longest-waiting; a run starting meanwhile gets nobody.
    expect((await claimDueUsers(db, 55 * 60_000, 10)).map((u) => u.id)).toEqual(['google:1', 'google:2']);
    expect(await claimDueUsers(db, 55 * 60_000, 10)).toEqual([]);
    await recordSync(db, 'google:1', true, '');
    // Once a claim lapses, whoever is still due is picked up again.
    await db.prepare('UPDATE users SET sync_claimed_at = 1').run();
    expect((await claimDueUsers(db, 55 * 60_000, 10)).map((u) => u.id)).toEqual(['google:2']);

    const soon = Date.now() + 86_400_000;
    await db.batch([
      db.prepare("INSERT INTO synced_events VALUES ('google:1', 'e1', 'h', 'deadline', 'PS5', ?, 0)").bind(soon),
      db.prepare("INSERT INTO synced_events VALUES ('google:1', 'e2', 'h', 'class', 'Lecture', ?, 0)").bind(soon),
      db.prepare("INSERT INTO synced_events VALUES ('google:1', 'e3', 'h', 'exam', 'Final', ?, 1)").bind(soon + 1),
    ]);
    expect(await eventCounts(db, 'google:1')).toEqual({ class: 1, deadline: 1, exam: 1 });
    expect(await upcomingEvents(db, 'google:1', ['deadline', 'exam'], 8)).toEqual([
      { title: 'PS5', kind: 'deadline', start_ms: soon, all_day: 0 },
      { title: 'Final', kind: 'exam', start_ms: soon + 1, all_day: 1 },
    ]);

    let fetches = 0;
    const fetchModule = cachedModuleFetcher(db, async () => ({ moduleCode: `CS${++fetches}` }) as never);
    expect(await fetchModule('2026-2027', 'CS2040')).toEqual({ moduleCode: 'CS1' });
    expect(await fetchModule('2026-2027', 'CS2040')).toEqual({ moduleCode: 'CS1' });
    expect(fetches).toBe(1);

    await deleteUserData(db, 'google:1');
    expect(await getUser(db, 'google:1')).toBeNull();
    expect(await eventCounts(db, 'google:1')).toEqual({});
  });
});
