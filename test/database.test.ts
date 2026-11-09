import { readFileSync } from 'node:fs';
import { vi, afterEach, describe, expect, it } from 'vitest';
import type { Env } from '../src/env';
import { FakeCalendar } from '../src/lib/calendar/fake';
import { userTokens } from '../src/lib/calendar/tokens';
import { encrypt } from '../src/lib/crypto';
import { numberPlaceholders, type Db } from '../src/lib/database';
import {
  cachedModuleFetcher,
  claimDueUsers,
  deadlineList,
  deleteUserData,
  doneDeadlineIds,
  eventCounts,
  getUser,
  recordSync,
  saveFeed,
  setDeadlinesDone,
  upcomingEvents,
  upsertUserOnLogin,
} from '../src/lib/db';
import { migrate } from '../src/lib/migrate';
import { removeFromCalendar, storeApplied, type PlannedUpsert } from '../src/lib/sync';
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
    expect(await migrate(db)).toEqual([
      '0001_init.sql',
      '0002_course_settings.sql',
      '0003_feeds_and_rollover.sql',
      '0004_clear_rows_left_after_deletion.sql',
      '0005_ai_app_access.sql',
      '0006_reminders_and_done.sql',
    ]);
    expect(await migrate(db)).toEqual([]);
    const { results } = await db
      .prepare("SELECT relname, relrowsecurity FROM pg_class WHERE relkind = 'r' AND relnamespace = 'public'::regnamespace ORDER BY relname")
      .all<{ relname: string; relrowsecurity: boolean }>();
    expect(results.map((r) => r.relname)).toEqual([
      '_migrations', 'done_deadlines', 'fake_calendars', 'fake_events', 'feeds', 'kv', 'module_cache',
      'oauth_clients', 'oauth_codes', 'oauth_grants', 'oauth_tokens', 'synced_events', 'users',
    ]);
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

    // A sync that didn't get everything through comes back at the next run (15 minutes on), not an hour later.
    const twentyMinutesAgo = Date.now() - 20 * 60_000;
    await db.prepare('UPDATE users SET sync_claimed_at = NULL, last_sync_at = ?, last_sync_ok = 1, input_hash = NULL').bind(twentyMinutesAgo).run();
    expect((await claimDueUsers(db, 55 * 60_000, 10)).map((u) => u.id).sort()).toEqual(['google:1', 'google:2']);
    await db.prepare("UPDATE users SET sync_claimed_at = NULL, input_hash = 'done'").run();
    expect(await claimDueUsers(db, 55 * 60_000, 10)).toEqual([]);

    const soon = Date.now() + 86_400_000;
    await db.batch([
      db.prepare("INSERT INTO synced_events VALUES ('google:1', 'e1', 'h', 'deadline', 'PS5', ?, 0)").bind(soon),
      db.prepare("INSERT INTO synced_events VALUES ('google:1', 'e2', 'h', 'class', 'Lecture', ?, 0)").bind(soon),
      db.prepare("INSERT INTO synced_events VALUES ('google:1', 'e3', 'h', 'exam', 'Final', ?, 1)").bind(soon + 1),
    ]);
    expect(await eventCounts(db, 'google:1')).toEqual({ class: 1, deadline: 1, exam: 1 });
    expect(await upcomingEvents(db, 'google:1', ['deadline', 'exam'], 8)).toEqual([
      { event_id: 'e1', title: 'PS5', kind: 'deadline', start_ms: soon, all_day: 0, done: 0 },
      { event_id: 'e3', title: 'Final', kind: 'exam', start_ms: soon + 1, all_day: 1, done: 0 },
    ]);

    // Ticking a deadline off: only your own deadlines (not a class, not someone else's), and only once.
    await db.prepare("INSERT INTO synced_events VALUES ('google:2', 'e9', 'h', 'deadline', 'Theirs', ?, 0)").bind(soon).run();
    expect(await setDeadlinesDone(db, 'google:1', ['e1', 'e2', 'e9'], [])).toBe(true);
    expect(await setDeadlinesDone(db, 'google:1', ['e1'], [])).toBe(false);
    expect([...await doneDeadlineIds(db, 'google:1')]).toEqual(['e1']);
    expect(await doneDeadlineIds(db, 'google:2')).toEqual(new Set());
    expect(await deadlineList(db, 'google:1', 0)).toEqual([{ event_id: 'e1', title: 'PS5', kind: 'deadline', start_ms: soon, all_day: 0, done: 1 }]);
    expect((await upcomingEvents(db, 'google:1', ['deadline'], 8))[0].done).toBe(1);
    // Starting the calendar over keeps the tick; ticking it back on takes it off.
    await db.prepare("DELETE FROM synced_events WHERE user_id = 'google:1' AND event_id = 'e1'").run();
    expect([...await doneDeadlineIds(db, 'google:1')]).toEqual(['e1']);
    expect(await setDeadlinesDone(db, 'google:1', [], ['e1'])).toBe(true);
    expect(await doneDeadlineIds(db, 'google:1')).toEqual(new Set());
    await db.prepare("INSERT INTO synced_events VALUES ('google:1', 'e1', 'h', 'deadline', 'PS5', ?, 0)").bind(soon).run();
    await setDeadlinesDone(db, 'google:1', ['e1'], []);

    let fetches = 0;
    const fetchModule = cachedModuleFetcher(db, async () => ({ moduleCode: `CS${++fetches}` }) as never);
    expect(await fetchModule('2026-2027', 'CS2040')).toEqual({ moduleCode: 'CS1' });
    expect(await fetchModule('2026-2027', 'CS2040')).toEqual({ moduleCode: 'CS1' });
    expect(fetches).toBe(1);

    await deleteUserData(db, 'google:1');
    expect(await getUser(db, 'google:1')).toBeNull();
    expect(await eventCounts(db, 'google:1')).toEqual({});
    expect(await doneDeadlineIds(db, 'google:1')).toEqual(new Set());
  });
});

describe('deleting your data', () => {
  const ids = async (db: Db, sql: string) => (await db.prepare(sql).all<{ id: string }>()).results.map((r) => r.id).sort();

  it("lets a sync that was still running write nothing back for someone who's gone", async () => {
    const db = await freshDb();
    await migrate(db);
    await upsertUserOnLogin(db, { id: 'google:1', email: 'a@example.com', name: 'A' });
    await upsertUserOnLogin(db, { id: 'google:2', email: 'b@example.com', name: 'B' });
    const env = { DB: db, ENCRYPTION_KEY: 'test key' } as unknown as Env;
    const refresh = await encrypt(env.ENCRYPTION_KEY, 'refresh token');
    const [one, two] = await Promise.all(['google:1', 'google:2'].map(async (id) => ({ ...(await getUser(db, id))!, google_refresh_enc: refresh })));
    await deleteUserData(db, 'google:2');

    // What a sync saves at the end of a run, for someone still here and for someone who deleted their data meanwhile.
    const written = { upserts: [{ eventId: 'e1', hash: 'h', kind: 'deadline', title: 'PS5', startMs: 1, allDay: false } as PlannedUpsert], deletes: [] };
    const original = globalThis.fetch;
    globalThis.fetch = vi.fn(async () => Response.json({ access_token: 'access', expires_in: 3600 })) as typeof fetch;
    try {
      for (const user of [one, two]) {
        await storeApplied(db, user.id, written);
        await saveFeed(db, user.id, 'BEGIN:VCALENDAR');
        expect(await userTokens(env, user)()).toBe('access'); // the token still works for the run, it just isn't kept
      }
    } finally {
      globalThis.fetch = original;
    }

    expect(await ids(db, 'SELECT user_id AS id FROM synced_events')).toEqual(['google:1']);
    expect(await ids(db, 'SELECT user_id AS id FROM feeds')).toEqual(['google:1']);
    expect(await ids(db, "SELECT key AS id FROM kv WHERE key LIKE 'token:user:%'")).toEqual(['token:user:google:1']);
  });

  it('clears rows left behind before that, and nothing else', async () => {
    const db = await freshDb();
    await migrate(db);
    await upsertUserOnLogin(db, { id: 'google:1', email: 'a@example.com', name: 'A' });
    const later = Date.now() + 3600_000;
    for (const id of ['google:1', 'google:gone']) {
      await db.batch([
        db.prepare("INSERT INTO synced_events VALUES (?, 'e1', 'h', 'deadline', 'PS5', 1, 0)").bind(id),
        db.prepare('INSERT INTO feeds (user_id, body, updated_at) VALUES (?, ?, 1)').bind(id, 'BEGIN:VCALENDAR'),
        db.prepare("INSERT INTO kv (key, value, expires_at) VALUES (?, 'x', ?)").bind(`token:user:${id}`, later),
      ]);
    }
    await db.prepare("INSERT INTO kv (key, value, expires_at) VALUES ('token:service_account', 'x', ?)").bind(later).run();

    await db.exec(readFileSync('migrations/0004_clear_rows_left_after_deletion.sql', 'utf8'));
    expect(await ids(db, 'SELECT user_id AS id FROM synced_events')).toEqual(['google:1']);
    expect(await ids(db, 'SELECT user_id AS id FROM feeds')).toEqual(['google:1']);
    expect(await ids(db, 'SELECT key AS id FROM kv')).toEqual(['token:service_account', 'token:user:google:1']);
  });
});

describe('taking down the calendar Semsync made', () => {
  async function onSubscribeLinkWith(db: Db, calendarId: string) {
    await migrate(db);
    await upsertUserOnLogin(db, { id: 'google:1', email: 'a@example.com', name: 'A' });
    await db.prepare("UPDATE users SET mode = 'feed', calendar_id = ?, needs_reconnect = 1 WHERE id = 'google:1'").bind(calendarId).run();
    return (await getUser(db, 'google:1'))!;
  }

  it('removes a Google calendar left from before someone switched to a subscribe link', async () => {
    const db = await freshDb();
    await migrate(db);
    const left = await new FakeCalendar(db).createCalendar('NUS semester');
    const user = await onSubscribeLinkWith(db, left);
    const env = { DB: db, FAKE_GOOGLE: '1', ENCRYPTION_KEY: 'test key' } as unknown as Env;
    expect(await removeFromCalendar(env, user)).toBe(true);
    expect((await db.prepare('SELECT id FROM fake_calendars').all()).results).toEqual([]);
    expect((await getUser(db, 'google:1'))!.calendar_id).toBeNull();
  });

  it("says it couldn't, rather than that it's gone, when that Google account can't be reached", async () => {
    const db = await freshDb();
    const user = await onSubscribeLinkWith(db, 'nus@group.calendar.google.com');
    const env = { DB: db, ENCRYPTION_KEY: 'test key' } as unknown as Env;
    const original = globalThis.fetch;
    globalThis.fetch = vi.fn(async () => {
      throw new Error('no network in this test');
    }) as typeof fetch;
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(await removeFromCalendar(env, user)).toBe(false);
      expect(globalThis.fetch).not.toHaveBeenCalled();
    } finally {
      globalThis.fetch = original;
      quiet.mockRestore();
    }
  });

  it('has nothing to take down for someone who only ever used the subscribe link', async () => {
    const db = await freshDb();
    const user = await onSubscribeLinkWith(db, 'feed');
    expect(await removeFromCalendar({ DB: db } as unknown as Env, user)).toBe(true);
  });
});
