import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { b64url, encrypt, hmac } from '../src/lib/crypto';
import type { Db } from '../src/lib/database';
import { feedBody, getUser, upsertUserOnLogin, type UserRow } from '../src/lib/db';
import {
  cleanReminders, eventId, hashBody, reminderLabel, reminderTimes, REMINDERS, toGoogleEvent, type CalEvent,
} from '../src/lib/events';
import { gunzipBase64, toIcs } from '../src/lib/feed';
import { migrate } from '../src/lib/migrate';
import { csrfToken, renewDue, sessionValue } from '../src/lib/session';
import { markDone, SYNC_VERSION, syncInputHash } from '../src/lib/sync';
import { testDb } from './pg';

// The in-memory Postgres starts slowly when every test file runs at once, so these get longer than the 5 s default.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

const deadline: CalEvent = {
  key: 'canvas:event-assignment-1', kind: 'deadline', title: '[CS2040S] Problem Set 5',
  start: { dateTime: '2026-11-14T23:59:00+08:00' }, end: { dateTime: '2026-11-14T23:59:00+08:00' }, url: 'https://canvas.nus.edu.sg/x', color: '9',
};
const exam: CalEvent = {
  key: 'nusmods:exam:CS2040S', kind: 'exam', title: '[CS2040S] Final exam',
  start: { dateTime: '2026-11-25T09:00:00+08:00' }, end: { dateTime: '2026-11-25T11:00:00+08:00' },
};
const lecture: CalEvent = {
  key: 'nusmods:CS2040S:LEC:1:1', kind: 'class', title: '[CS2040S] Lecture',
  start: { dateTime: '2026-11-10T10:00:00+08:00' }, end: { dateTime: '2026-11-10T12:00:00+08:00' }, location: 'LT19', color: '9',
};

describe('someone who never picks reminder times or ticks anything off', () => {
  // Fingerprints of these events as Semsync wrote them before reminder times and ticks existed. The same fingerprint
  // means Google gets nothing new, so nobody's calendar changes.
  const BEFORE = {
    main: { deadline: 'e2908e025ca8bb614382a60988dcf533', exam: 'b09271c6b55bf275d91d2ce652408eaf', class: '301d2ea9789ff20ddd4c8cacd9716f0b' },
    feed: { deadline: '3a218895e48f7266b2ca62998c5821bc', exam: '3c7ccc53bee266649dbab7df1ad8daeb', class: '301d2ea9789ff20ddd4c8cacd9716f0b' },
  };

  it('keeps exactly the events they had', async () => {
    const usual = reminderTimes(null, null);
    for (const mode of ['main', 'feed'] as const) {
      for (const ev of [deadline, exam, lecture]) {
        const want = BEFORE[mode][ev.kind as 'deadline' | 'exam' | 'class'];
        expect(await hashBody(toGoogleEvent(ev, mode))).toBe(want);
        expect(await hashBody(toGoogleEvent(ev, mode, usual))).toBe(want);
      }
    }
    const ics = await toIcs([deadline, exam, lecture], { name: 'NUS semester', now: Date.UTC(2026, 10, 9), appUrl: 'https://semsync.live', reminders: usual });
    expect(await hashBody(ics as unknown as Record<string, unknown>)).toBe('6ba42f9bc7170f6d0223ec87f2b69a49');
  });

  it("keeps the sync's fingerprint too, so they get no extra sync", async () => {
    const user = {
      nusmods_link: 'x', nusmods_ay: '2026-2027', hidden_courses: '[]', week_labels: 1, mode: 'main', calendar_id: 'c', feed_token_hash: null,
      deadline_reminders: null, exam_reminders: null,
    } as UserRow;
    const canvas = [deadline];
    const before = await hashBody({
      v: SYNC_VERSION, canvas, nusmods: user.nusmods_link, ay: user.nusmods_ay, hidden: user.hidden_courses,
      weeks: user.week_labels, mode: user.mode, calendar: user.calendar_id, feed: false,
    });
    expect(await syncInputHash(user, canvas)).toBe(before);
    expect(await syncInputHash(user, canvas, new Set())).toBe(before);
    // Picking reminder times or ticking something off is a change the next run acts on, whatever order the ticks are in.
    expect(await syncInputHash({ ...user, deadline_reminders: '[4320]' }, canvas)).not.toBe(before);
    const ticked = await syncInputHash(user, canvas, new Set(['ssb', 'ssa']));
    expect(ticked).not.toBe(before);
    expect(await syncInputHash(user, canvas, new Set(['ssa', 'ssb']))).toBe(ticked);
  });
});

describe('a deadline ticked off as done', () => {
  it('turns grey, gets a tick in front and stops reminding, in Google Calendar and the subscribe link', async () => {
    const [done] = await markDone([deadline], new Set([await eventId(deadline.key)]));
    expect(done.done).toBe(true);
    const body = toGoogleEvent(done, 'main');
    expect(body.summary).toBe('✓ [CS2040S] Problem Set 5');
    expect(body.colorId).toBe('8');
    expect(body.reminders).toEqual({ useDefault: false, overrides: [] });

    const ics = await toIcs([done, exam], { name: 'NUS semester', now: 0, appUrl: 'https://semsync.live' });
    const [, doneBlock, examBlock] = ics.split('BEGIN:VEVENT');
    expect(doneBlock).toContain('SUMMARY:✓ [CS2040S] Problem Set 5');
    expect(doneBlock).not.toContain('VALARM');
    expect(examBlock).toContain('TRIGGER:-PT1440M');
  });

  it('only ever applies to deadlines', async () => {
    const ids = new Set([await eventId(exam.key), await eventId(lecture.key)]);
    expect((await markDone([exam, lecture], ids)).some((e) => e.done)).toBe(false);
  });
});

describe('reminder times', () => {
  it('reads what someone picked, and falls back to the usual times for anything unreadable', () => {
    expect(reminderTimes('[4320,60]', null)).toMatchObject({ deadline: [4320, 60], exam: REMINDERS.exam });
    expect(reminderTimes('[]', '[]')).toMatchObject({ deadline: [], exam: [] });
    expect(reminderTimes('not json', '{"a":1}')).toMatchObject({ deadline: REMINDERS.deadline, exam: REMINDERS.exam });
    // A time Settings doesn't offer is dropped rather than sent to Google.
    expect(reminderTimes('[4320,999999,4320]', null).deadline).toEqual([4320]);
    expect(cleanReminders('deadline', ['60', 10080, 'x'])).toEqual([10080, 60]);
  });

  it('go to Google and the subscribe link', async () => {
    const times = reminderTimes('[4320]', '[]');
    expect(toGoogleEvent(deadline, 'main', times).reminders).toEqual({ useDefault: false, overrides: [{ method: 'popup', minutes: 4320 }] });
    expect(toGoogleEvent(exam, 'main', times).reminders).toEqual({ useDefault: false, overrides: [] });
    // Classes keep following the calendar's own reminders.
    expect(toGoogleEvent(lecture, 'main', times).reminders).toEqual({ useDefault: true });
    const ics = await toIcs([deadline], { name: 'NUS semester', now: 0, appUrl: 'https://semsync.live', reminders: times });
    expect(ics.match(/TRIGGER:[^\r]+/g)).toEqual(['TRIGGER:-PT4320M']);
  });

  it('read as people say them', () => {
    expect([10080, 4320, 1440, 180, 60, 20160].map(reminderLabel)).toEqual(['1 week', '3 days', '1 day', '3 hours', '1 hour', '2 weeks']);
  });
});

describe('staying signed in', () => {
  it('renews a sign in once it is a day old', async () => {
    const day = 86_400_000;
    const now = Date.now();
    expect(renewDue(await sessionValue('s', 'google:1'), now)).toBe(false);
    expect(renewDue(`x.${now + 28 * day}.sig`, now)).toBe(true);
    expect(renewDue('nonsense', now)).toBe(false);
  });
});

describe('ticking deadlines off and picking reminder times, through the app', () => {
  const APP_URL = 'https://semsync.example';
  const SECRET = 'test session secret';
  const KEY = 'test key';
  const USER = 'google:7';
  type App = { fetch: (r: Request) => Response | Promise<Response> };
  let app: App;
  let db: Db;
  let cleanUp: () => Promise<void>;
  let cookie: string;
  let csrf: string;

  beforeAll(async () => {
    const t = await testDb();
    db = t.db;
    await migrate(db);
    vi.resetModules();
    const env = { DATABASE_URL: t.url, SESSION_SECRET: SECRET, ENCRYPTION_KEY: KEY, APP_URL, VERCEL: '', DEV_LOGIN: '1', GOOGLE_OAUTH_CLIENT_ID: '' };
    for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
    app = (await import('../src/app')).default;
    const { getEnv } = await import('../src/env');
    cleanUp = async () => {
      await getEnv().DB.close();
      await t.stop();
      vi.unstubAllEnvs();
    };
    // On the subscribe link with the sample Canvas feed, so a sync needs neither Google nor the network.
    await upsertUserOnLogin(db, { id: USER, email: 'seven@u.nus.edu', name: 'Seven' });
    await db.prepare("UPDATE users SET mode = 'feed', calendar_id = 'feed', canvas_feed_enc = ?, feed_token_hash = 'h7' WHERE id = ?")
      .bind(await encrypt(KEY, 'sample'), USER).run();
    cookie = `ss_session=${await sessionValue(SECRET, USER)}`;
    csrf = await csrfToken(SECRET, USER);
    const synced = await send('/sync', post({ csrf }));
    expect(synced.headers.get('location')).toContain('done=synced');
  });

  afterAll(async () => {
    await cleanUp();
  });

  const send = (path: string, init: RequestInit = {}) => app.fetch(new Request(`${APP_URL}${path}`, init));
  const post = (fields: [string, string][] | Record<string, string>, headers: Record<string, string> = {}): RequestInit => ({
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', cookie, ...headers },
    body: new URLSearchParams(fields).toString(),
  });
  const feed = async () => gunzipBase64((await feedBody(db, USER))!);
  const block = (ics: string, title: string) => ics.split('BEGIN:VEVENT').find((b) => b.includes(title))!;
  const reflection = async () =>
    (await db.prepare("SELECT event_id FROM synced_events WHERE user_id = ? AND title LIKE '%Reflection%'").bind(USER).first<{ event_id: string }>())!.event_id;

  it('ticks a deadline off in the background, and the calendar shows it at once', async () => {
    const id = await reflection();
    expect(block(await feed(), 'Reflection')).toContain('VALARM');
    const res = await send('/deadlines/done', post([['csrf', csrf], ['done', id]], { accept: 'application/json' }));
    expect(await res.json()).toEqual({ ok: true, synced: true });
    const ticked = block(await feed(), 'Reflection');
    expect(ticked).toContain('SUMMARY:✓ [UTC2402] Reflection [Part 2]');
    expect(ticked).not.toContain('VALARM');

    // Without the page's script, the same tick is a form that comes back with a confirmation.
    const back = await send('/deadlines/done', post([['csrf', csrf], ['undone', id], ['back', 'home']]));
    expect(back.headers.get('location')).toBe('/home?done=unticked');
    expect(block(await feed(), 'Reflection')).toContain('VALARM');
  });

  it('tells an AI assistant which deadlines are done', async () => {
    const { handleMcp } = await import('../src/lib/mcp');
    const items = async () => {
      const answer = await handleMcp(
        { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'upcoming', arguments: { days: 7, types: ['deadline'] } } },
        { db, user: (await getUser(db, USER))!, now: Date.UTC(2026, 10, 10) },
      );
      return (answer as { result: { structuredContent: { items: { title: string; done?: true }[] } } }).result.structuredContent.items;
    };
    expect((await items()).find((i) => i.title.includes('Reflection'))!.done).toBeUndefined();
    await send('/deadlines/done', post([['csrf', csrf], ['done', await reflection()]], { accept: 'application/json' }));
    expect((await items()).find((i) => i.title.includes('Reflection'))!.done).toBe(true);
    await send('/deadlines/done', post([['csrf', csrf], ['undone', await reflection()]], { accept: 'application/json' }));
  });

  it('needs the form token, and ignores anything that is not one of your deadlines', async () => {
    const id = await reflection();
    const forged = await send('/deadlines/done', post([['done', id]], { accept: 'application/json' }));
    expect(forged.status).toBe(403);
    const junk = await send('/deadlines/done', post([['csrf', csrf], ['done', 'not an id'], ['done', `ss${'0'.repeat(30)}`]], { accept: 'application/json' }));
    expect(await junk.json()).toEqual({ ok: true, synced: true });
    expect((await db.prepare('SELECT COUNT(*) AS n FROM done_deadlines').first<{ n: number }>())!.n).toBe(0);
  });

  it('shows the Deadlines page with a tick for each, and the search kept', async () => {
    const page = await (await send('/deadlines?q=reflection', { headers: { cookie } })).text();
    expect(page).toContain('<h1 class="heading-3">Deadlines</h1>');
    expect(page).toContain('value="reflection"');
    expect((await send('/deadlines')).headers.get('location')).toBe('/');
  });

  it('saves reminder times, and the usual ones as nothing at all', async () => {
    await send('/reminders', post([['csrf', csrf], ['deadline', '4320'], ['deadline', '60'], ['exam', '1440']]));
    let user = (await getUser(db, USER))!;
    expect([user.deadline_reminders, user.exam_reminders]).toEqual(['[4320,60]', '[1440]']);
    expect(block(await feed(), 'Reflection').match(/TRIGGER:[^\r]+/g)).toEqual(['TRIGGER:-PT4320M', 'TRIGGER:-PT60M']);

    await send('/reminders', post([['csrf', csrf], ['deadline', '1440'], ['deadline', '180'], ['exam', '10080'], ['exam', '1440']]));
    user = (await getUser(db, USER))!;
    expect([user.deadline_reminders, user.exam_reminders]).toEqual([null, null]);
  });

  it('keeps someone signed in: a day old sign in comes back renewed', async () => {
    const fresh = await send('/settings', { headers: { cookie } });
    expect(fresh.headers.get('set-cookie')).toBeNull();
    const payload = `${b64url(USER)}.${Date.now() + 20 * 86_400_000}`;
    const old = `ss_session=${payload}.${await hmac(SECRET, `session:${payload}`)}`;
    const renewed = await send('/settings', { headers: { cookie: old } });
    expect(renewed.status).toBe(200);
    expect(renewed.headers.get('set-cookie')).toMatch(/^ss_session=.+Max-Age=2592000/);
  });
});
