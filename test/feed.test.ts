import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../src/env';
import { encrypt } from '../src/lib/crypto';
import type { Db } from '../src/lib/database';
import { claimDueUsers, feedBody, getUser, setFeedToken, upsertUserOnLogin } from '../src/lib/db';
import type { CalEvent } from '../src/lib/events';
import { feedTokenHash, foldLine, gunzipBase64, gzipBase64, icsText, newFeedToken, toIcs } from '../src/lib/feed';
import { migrate } from '../src/lib/migrate';
import { runDueSyncs, syncUser } from '../src/lib/sync';
import { testDb } from './pg';

vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

const deadline: CalEvent = {
  key: 'canvas:1', kind: 'deadline', title: '[CS2040] Problem Set 5; part 1, "draft"',
  start: { dateTime: '2026-11-06T23:59:00+08:00' }, end: { dateTime: '2026-11-06T23:59:00+08:00' },
  url: 'https://canvas.nus.edu.sg/courses/1/assignments/2',
};
const week: CalEvent = { key: 'week:1', kind: 'week', title: 'Week 12', start: { date: '2026-11-02' }, end: { date: '2026-11-03' } };

describe('the .ics file', () => {
  it('writes each event with its times, reminders and a stable id', async () => {
    const ics = await toIcs([deadline, week, deadline], { name: 'NUS semester', now: Date.UTC(2026, 10, 6), appUrl: 'https://x.test' });
    expect(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2); // the repeat is dropped
    expect(ics).toContain('DTSTART:20261106T155900Z');
    expect(ics).toContain('DTSTART;VALUE=DATE:20261102');
    expect(ics).toContain('DTEND;VALUE=DATE:20261103');
    expect(ics).toContain('SUMMARY:[CS2040] Problem Set 5\\; part 1\\, "draft"');
    // Deadlines remind a day and three hours before; week labels never do and never look busy.
    expect(ics).toContain('TRIGGER:-PT1440M');
    expect(ics).toContain('TRIGGER:-PT180M');
    expect(ics.match(/BEGIN:VALARM/g)).toHaveLength(2);
    expect(ics.match(/TRANSP:TRANSPARENT/g)).toHaveLength(2);
    expect(ics).toMatch(/UID:ss[0-9a-v]{30}@semsync/);
  });

  it('escapes text and folds long lines at 75 bytes without splitting characters', () => {
    expect(icsText('a\\b;c,d\ne')).toBe('a\\\\b\\;c\\,d\\ne');
    const line = `DESCRIPTION:${'日本語のテキスト'.repeat(10)}`;
    const folded = foldLine(line);
    for (const part of folded.split('\r\n')) expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75);
    expect(folded.split('\r\n').map((p, i) => (i ? p.slice(1) : p)).join('')).toBe(line);
  });

  it('shrinks for storage and comes back the same', async () => {
    const ics = await toIcs(Array.from({ length: 80 }, (_, i) => ({ ...deadline, key: `k${i}` })), { name: 'NUS semester', now: 0, appUrl: 'https://x.test' });
    const stored = await gzipBase64(ics);
    expect(stored.length).toBeLessThan(ics.length / 4);
    expect(await gunzipBase64(stored)).toBe(ics);
  });

  it('makes long random links, stored only as a hash', async () => {
    const a = newFeedToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(newFeedToken()).not.toBe(a);
    expect(await feedTokenHash(a)).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('syncing at scale', () => {
  let stop: (() => Promise<void>) | undefined;
  afterEach(async () => {
    await stop?.();
    stop = undefined;
  });

  async function setUp(): Promise<{ db: Db; env: Env }> {
    const t = await testDb();
    stop = t.stop;
    await migrate(t.db);
    const env = {
      DB: t.db, APP_NAME: 'Semsync', SYNC_CONCURRENCY: '4', ALLOWED_CANVAS_HOSTS: 'canvas.nus.edu.sg', APP_URL: 'https://x.test',
      SESSION_SECRET: 's', ENCRYPTION_KEY: 'k', DEV_LOGIN: '1',
    } as Env;
    return { db: t.db, env };
  }

  async function feedUser(db: Db, env: Env, id: string) {
    await upsertUserOnLogin(db, { id, email: `${id}@example.com`, name: null });
    await db.prepare("UPDATE users SET mode = 'feed', canvas_feed_enc = ? WHERE id = ?").bind(await encrypt(env.ENCRYPTION_KEY, 'sample'), id).run();
    await setFeedToken(db, id, await feedTokenHash(newFeedToken()), 'x');
    return (await getUser(db, id))!;
  }

  it('stops early when nothing changed, and rebuilds the subscribe link only when something did', async () => {
    const { db, env } = await setUp();
    const first = await syncUser(env, await feedUser(db, env, 'dev:a'));
    expect(first?.unchanged).toBeUndefined();
    expect(first!.upserts.length).toBeGreaterThan(0);
    const after = (await getUser(db, 'dev:a'))!;
    expect(after.input_hash).toMatch(/^[0-9a-f]{32}$/);
    expect(after.calendar_id).toBe('feed');
    const ics = await gunzipBase64((await feedBody(db, 'dev:a'))!);
    expect(ics).toContain('BEGIN:VEVENT');

    const second = await syncUser(env, after);
    expect(second?.unchanged).toBe(true);
    // Pressing Sync now still does everything.
    expect((await syncUser(env, (await getUser(db, 'dev:a'))!, { force: true }))?.unchanged).toBeUndefined();
    // A changed setting means a full sync next time.
    await db.prepare("UPDATE users SET week_labels = 0 WHERE id = 'dev:a'").run();
    expect((await syncUser(env, (await getUser(db, 'dev:a'))!))?.unchanged).toBeUndefined();
  });

  it('works through everyone due, several at once, and never takes the same person twice', async () => {
    const { db, env } = await setUp();
    // The first sync happens at setup and makes the calendar; hourly runs take it from there.
    for (let i = 0; i < 6; i++) await feedUser(db, env, `dev:u${i}`);
    await db.prepare("UPDATE users SET calendar_id = 'feed'").run();
    const run = await runDueSyncs(env, 60_000);
    expect(run).toMatchObject({ synced: 6, unchanged: 0, failed: 0, timedOut: false });
    // Everyone's synced, so nobody's due, and a second run finds no one.
    expect(await claimDueUsers(db, 55 * 60_000, 10)).toEqual([]);
    expect((await runDueSyncs(env, 60_000)).synced).toBe(0);
  });
});
