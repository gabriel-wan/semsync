import { addDays, linkAcadYear, linkTerm, nextTerm, sgDate, termsAround, termWeeks, type Term } from '../config.js';
import { isDev, type Env } from '../env.js';
import { SAMPLE_CANVAS_FEED } from '../fixtures/sampleCanvas.js';
import { FakeCalendar } from './calendar/fake.js';
import { FeedOnlyCalendar } from './calendar/feedOnly.js';
import { GoogleCalendar } from './calendar/google.js';
import { ReconnectNeeded, revokeToken, serviceAccountTokens, userTokens } from './calendar/tokens.js';
import type { CalendarBackend, EventOp } from './calendar/types.js';
import { canvasEvents, fetchCanvasFeed } from './canvas.js';
import { decrypt } from './crypto.js';
import {
  cachedModuleFetcher,
  claimDueUsers,
  clearCalendar,
  jsonList,
  memoModuleFetcher,
  saveFeed,
  setCourses,
  touchSync,
  type Course,
  recordSync,
  setCalendarId,
  setNeedsReconnect,
  setRefreshToken,
  trackedEventIds,
  trackedEvents,
  type TrackedRow,
  type UserRow,
} from './db.js';
import type { Db } from './database.js';
import { UserError } from './errors.js';
import {
  eventId, hashBody, moduleColors, startMs, toGoogleEvent, type CalEvent, type CalendarMode, type EventKind, type GoogleEventBody,
} from './events.js';
import { gzipBase64, toIcs } from './feed.js';
import { noClassDates } from './holidays.js';
import { addingMessage } from './messages.js';
import { fetchModuleFromApi, nusmodsEvents, parseNusmodsLink } from './nusmods.js';

const DAY_MS = 24 * 3600_000;
// Per sync run, so Google never gets more than this at once. A normal semester (about 250 events) goes in at once; a
// bigger one finishes on the next run, 20 minutes later (claimDueUsers picks up unfinished syncs early).
const MAX_OPS_PER_SYNC = 400;

export const SAMPLE_FEED = 'sample';

/** The calendar account to act as for this user: their own in main mode, the app's in shared mode, none for a feed. */
export function calendarFor(env: Env, user: UserRow): CalendarBackend {
  if (user.mode === 'feed') return new FeedOnlyCalendar();
  if (env.FAKE_GOOGLE === '1') return new FakeCalendar(env.DB);
  return new GoogleCalendar(user.mode === 'main' ? userTokens(env, user) : serviceAccountTokens(env));
}

export const hasCalendarAccess = (user: UserRow) => !!user.google_refresh_enc && user.needs_reconnect === 0;

export type PlannedUpsert = {
  eventId: string;
  body: GoogleEventBody;
  hash: string;
  kind: EventKind;
  title: string;
  startMs: number;
  allDay: boolean;
  tracked: boolean;
};
export type Plan = { upserts: PlannedUpsert[]; deletes: string[] };

/** Works out what to send to Google: new or changed events, and upcoming events that disappeared. */
export async function planSync(desired: CalEvent[], tracked: TrackedRow[], now: number, mode: CalendarMode = 'shared'): Promise<Plan> {
  const trackedById = new Map(tracked.map((t) => [t.event_id, t]));
  const firstSync = tracked.length === 0;
  const seen = new Set<string>();
  const upserts: PlannedUpsert[] = [];

  for (const ev of desired) {
    const id = await eventId(ev.key);
    if (seen.has(id)) continue;
    seen.add(id);
    const existing = trackedById.get(id);
    // After the first sync, don't back-fill the past (e.g. a newly picked tutorial slot in earlier weeks).
    if (!existing && !firstSync && startMs(ev.start) < now - DAY_MS) continue;
    const body = toGoogleEvent(ev, mode);
    const hash = await hashBody(body);
    if (existing?.hash === hash) continue;
    upserts.push({
      eventId: id, body, hash, kind: ev.kind, title: ev.title,
      startMs: startMs(ev.start), allDay: 'date' in ev.start, tracked: !!existing,
    });
  }

  // Canvas feeds drop items about 30 days after they happen, so only remove events that are still ahead.
  const deletes = tracked.filter((t) => !seen.has(t.event_id) && t.start_ms >= now - DAY_MS).map((t) => t.event_id);
  return { upserts, deletes };
}

const succeeded = (op: EventOp, status: number) =>
  (status >= 200 && status < 300) || (op.type === 'delete' && (status === 404 || status === 410));

/** Sends a plan to the calendar. Returns what actually went through, so the next run retries the rest. */
export async function applyPlan(backend: CalendarBackend, calendarId: string, plan: Plan, maxOps = MAX_OPS_PER_SYNC) {
  const upserts = plan.upserts.slice(0, maxOps);
  const deletes = plan.deletes.slice(0, Math.max(0, maxOps - upserts.length));
  const ops: EventOp[] = [
    ...upserts.map((u): EventOp => ({ type: u.tracked ? 'update' : 'insert', eventId: u.eventId, body: u.body })),
    ...deletes.map((eventId): EventOp => ({ type: 'delete', eventId })),
  ];

  const status = new Map<string, number>();
  const first = await backend.apply(calendarId, ops);
  first.forEach((r) => status.set(r.eventId, r.status));

  // Our records and the calendar disagreed: an "insert" already exists (or was deleted), or an "update" is gone.
  const retries = ops.flatMap((op): EventOp[] => {
    const s = status.get(op.eventId);
    if (op.type === 'insert' && s === 409) return [{ ...op, type: 'update' }];
    if (op.type === 'update' && s === 404) return [{ ...op, type: 'insert' }];
    return [];
  });
  if (retries.length) (await backend.apply(calendarId, retries)).forEach((r) => status.set(r.eventId, r.status));

  const byId = new Map(ops.map((op) => [op.eventId, op]));
  const ok = (id: string) => succeeded(byId.get(id)!, status.get(id) ?? 0);
  const doneUpserts = upserts.filter((u) => ok(u.eventId));
  const doneDeletes = deletes.filter((id) => ok(id));
  return {
    upserts: doneUpserts,
    deletes: doneDeletes,
    failed: upserts.length + deletes.length - doneUpserts.length - doneDeletes.length,
    remaining: plan.upserts.length + plan.deletes.length - upserts.length - deletes.length,
  };
}

async function storeApplied(db: Db, userId: string, applied: { upserts: PlannedUpsert[]; deletes: string[] }) {
  const statements = [
    ...applied.upserts.map((u) =>
      db
        .prepare(
          `INSERT INTO synced_events (user_id, event_id, hash, kind, title, start_ms, all_day) VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (user_id, event_id) DO UPDATE SET hash = excluded.hash, kind = excluded.kind, title = excluded.title,
             start_ms = excluded.start_ms, all_day = excluded.all_day`,
        )
        .bind(userId, u.eventId, u.hash, u.kind, u.title, u.startMs, u.allDay ? 1 : 0),
    ),
    ...applied.deletes.map((id) =>
      db.prepare('DELETE FROM synced_events WHERE user_id = ? AND event_id = ?').bind(userId, id),
    ),
  ];
  for (let i = 0; i < statements.length; i += 100) await db.batch(statements.slice(i, i + 100));
}

/**
 * Applies the user's course switches and gives each module its colour (exams stay red). Also lists every course found,
 * switched off or not, for the switches on the Semsync page: modules by code first, then Canvas courses without one.
 */
export function applyCourses(
  events: CalEvent[], hidden: Set<string>, colorize = true,
): { events: CalEvent[]; courses: Course[] } {
  // A cross-listed Canvas course ("UTS2402/UTC2402") joins the module under whichever code the NUSMods link uses, so it
  // isn't listed twice, and its deadlines are titled with that code too.
  const nusmods = new Set(events.filter((e) => e.key.startsWith('nusmods:') && e.course).map((e) => e.course!));
  events = events.map((e) => {
    if (!e.course || !e.courseAliases || nusmods.has(e.course)) return e;
    const match = e.courseAliases.find((a) => nusmods.has(a));
    if (!match) return e;
    const title = e.title.startsWith(`[${e.course}]`) ? `[${match}]${e.title.slice(e.course.length + 2)}` : e.title;
    return { ...e, course: match, title };
  });
  // Names: NUSMods' full module name wins, then the most descriptive Canvas name.
  const fromNusmods = new Map<string, string>();
  const fromCanvas = new Map<string, string>();
  for (const e of events) {
    if (!e.course) continue;
    const label = e.courseLabel ?? e.course;
    const names = e.key.startsWith('nusmods:') ? fromNusmods : fromCanvas;
    if ((names.get(e.course)?.length ?? -1) < label.length) names.set(e.course, label);
  }
  const found = new Map<string, string>(fromCanvas);
  for (const [key, label] of fromNusmods) found.set(key, label);
  const courses = [...found]
    .map(([key, label]) => ({ key, label }))
    .sort((a, b) => Number(a.key.startsWith('canvas:')) - Number(b.key.startsWith('canvas:')) || a.key.localeCompare(b.key));
  // Google only shows event colours to the calendar's owner, so colouring a shared calendar's events would just be writes.
  const colors = colorize ? moduleColors(courses.map((c) => c.key)) : new Map<string, string>();
  const kept = events
    .filter((e) => !e.course || !hidden.has(e.course))
    .map((e) => (e.kind !== 'exam' && e.course && colors.has(e.course) ? { ...e, color: colors.get(e.course) } : e));
  return { events: kept, courses };
}

/** An all day "Week 7", "Recess week" and so on, on the Monday of every week of the current and next term. */
export function weekLabelEvents(now = new Date()): CalEvent[] {
  return termWeeks(now).map(({ term, index, monday, name }) => ({
    key: `week:${term.acadYear}:${term.semester}:${index}`,
    kind: 'week',
    title: name,
    start: { date: monday },
    end: { date: addDaysIso(monday, 1) },
    description: term.label,
  }));
}

const addDaysIso = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

/** The Canvas feed's events (or the sample's, in development), or none without a feed. */
export async function canvasFeedEvents(env: Env, user: UserRow): Promise<CalEvent[]> {
  if (!user.canvas_feed_enc) return [];
  const url = await decrypt(env.ENCRYPTION_KEY, user.canvas_feed_enc);
  const ics = isDev(env) && url === SAMPLE_FEED ? SAMPLE_CANVAS_FEED : await fetchCanvasFeed(url);
  return canvasEvents(ics);
}

/** The term the user's NUSMods link is for. Links only say "sem-1" or "sem-2"; the year was noted when it was saved. */
export function userTerm(user: UserRow): Term | null {
  if (!user.nusmods_link) return null;
  try {
    return linkTerm(parseNusmodsLink(user.nusmods_link).semester, user.nusmods_ay ?? linkAcadYear());
  } catch {
    return null;
  }
}

/**
 * A NUSMods link covers one semester, so Semsync puts a reminder in the calendar itself: an all day event two weeks
 * before the next term starts, to paste that term's link. Once they do, it's no longer wanted, so it comes out.
 */
export function timetableReminder(user: UserRow, appUrl: string, now = new Date()): CalEvent | null {
  const term = userTerm(user);
  if (!term) return null;
  const next = nextTerm(term);
  // Long after the next term started, the notice on their Semsync page asks instead.
  if (sgDate(now) > addDays(next.week1, 14)) return null;
  const date = addDays(next.week1, -14);
  const starts = new Date(`${next.week1}T00:00:00Z`).toLocaleDateString('en-SG', { day: 'numeric', month: 'long', timeZone: 'UTC' });
  return {
    key: `semsync:timetable:${next.acadYear}:${next.semester}`,
    kind: 'event',
    title: 'Add your new timetable to Semsync',
    start: { date },
    end: { date: addDays(date, 1) },
    description: `${next.label} starts on ${starts}. Paste its NUSMods share link in Semsync so your classes and exams carry on. Canvas deadlines keep coming by themselves.`,
    url: `${appUrl}/setup?edit=1`,
  };
}

/**
 * From three weeks before the next term, the Semsync page asks for its NUSMods link: which term the saved link is for,
 * and which one to paste now (the next one, or whichever is on if a few went by).
 */
export function timetableNotice(user: UserRow, now = new Date()): { saved: string; wanted: string } | null {
  const term = userTerm(user);
  if (!term) return null;
  const next = nextTerm(term);
  const today = sgDate(now);
  if (today < addDays(next.week1, -21)) return null;
  const wanted = today <= next.end ? next : termsAround(now).find((t) => t.end >= today) ?? next;
  return { saved: term.label, wanted: wanted.label };
}

/** Everything that should be in a user's calendar right now. Throws if any source fails, so nothing gets deleted by mistake. */
export async function desiredEvents(
  env: Env, user: UserRow, canvas: CalEvent[], now = new Date(),
): Promise<{ events: CalEvent[]; warnings: string[]; courses: Course[] }> {
  const events: CalEvent[] = [...canvas];
  const warnings: string[] = [];
  const term = userTerm(user);
  if (user.nusmods_link && term) {
    const t = Date.now();
    const link = parseNusmodsLink(user.nusmods_link);
    const holidays = await noClassDates(env.DB, [Number(term.week1.slice(0, 4)), Number(term.end.slice(0, 4))]);
    const result = await nusmodsEvents(link, term, memoModuleFetcher(cachedModuleFetcher(env.DB, fetchModuleFromApi)), holidays);
    events.push(...result.events);
    warnings.push(...result.warnings);
    const reminder = timetableReminder(user, env.APP_URL, now);
    if (reminder) events.push(reminder);
    console.log('sync part', user.id, 'nusmods', `${Date.now() - t} ms`, `${link.modules.length} modules`);
  }
  const { events: kept, courses } = applyCourses(events, new Set(jsonList<string>(user.hidden_courses)), user.mode === 'main');
  if (user.week_labels !== 0) kept.push(...weekLabelEvents(now));
  return { events: kept, warnings, courses };
}

// Bump when the same inputs should now give different events (new rules, titles or kinds), so the next run does
// everyone's sync in full once.
const SYNC_VERSION = '2026-11-06';
// NUSMods data, holidays and the date-based parts can change without the inputs changing, so a full sync runs at
// least this often anyway.
const FULL_SYNC_EVERY_MS = 20 * 3600_000;

/** A fingerprint of everything a sync is built from, so a run can tell when nothing has changed. */
async function syncInputHash(user: UserRow, canvas: CalEvent[]): Promise<string> {
  return hashBody({
    v: SYNC_VERSION, canvas, nusmods: user.nusmods_link, ay: user.nusmods_ay, hidden: user.hidden_courses,
    weeks: user.week_labels, mode: user.mode, calendar: user.calendar_id, feed: !!user.feed_token_hash,
  });
}

/** The calendar to write to: the user's primary calendar, or (shared mode) one created and shared the first time. */
export async function ensureCalendar(env: Env, backend: CalendarBackend, user: UserRow): Promise<string> {
  if (user.calendar_id) return user.calendar_id;
  let calendarId: string;
  if (user.mode === 'feed') {
    calendarId = 'feed';
  } else if (user.mode === 'main') {
    if (!hasCalendarAccess(user)) throw new ReconnectNeeded();
    // A calendar of its own in the user's account: they own it, so its reminders and colours show, and Semsync can't
    // reach anything else. Google adds it to their calendar list by itself.
    calendarId = await backend.createCalendar(
      'NUS semester',
      `Canvas deadlines, classes and exams, kept up to date by ${env.APP_NAME}.`,
    );
  } else {
    calendarId = await backend.createCalendar(
      'NUS semester',
      `Canvas deadlines, classes and exams for ${user.email}. Kept up to date by ${env.APP_NAME}.`,
    );
    await backend.shareWith(calendarId, user.email);
  }
  await setCalendarId(env.DB, user.id, calendarId);
  user.calendar_id = calendarId;
  return calendarId;
}

/** Whether this user's events are still in their main calendar, from before Semsync made a calendar of its own. */
const inMainCalendar = (user: UserRow) => user.mode === 'main' && !!user.calendar_id?.startsWith('primary');

/**
 * Moves someone from the old main calendar setup: takes Semsync's events back out of their main calendar with the old
 * permission, then revokes it. Their page then asks them to connect once more, which grants the new, narrower
 * permission and creates their "NUS semester" calendar.
 */
async function moveOffMainCalendar(env: Env, user: UserRow) {
  await removeFromCalendar(env, user);
  await disconnectCalendar(env, user);
  await recordSync(env.DB, user.id, false,
    'Semsync now keeps your events in their own "NUS semester" calendar, so it no longer needs access to your main one. Connect Google Calendar once more to set it up.');
  console.log('moved off the main calendar', user.id);
}

export type SyncResult = { upserts: PlannedUpsert[]; deletes: string[]; failed: number; remaining: number; unchanged?: boolean };
export type SyncOptions = {
  backend?: CalendarBackend;
  /** Do everything even if nothing changed: someone pressed Sync now, or saved their links. */
  force?: boolean;
  /** Told about a sync that failed: 'user' for problems only the user can fix (a dead link, access taken back). */
  onError?: (kind: 'user' | 'system', where: string, message: string) => void;
};

export async function syncUser(env: Env, user: UserRow, opts: SyncOptions = {}): Promise<SyncResult | null> {
  if (inMainCalendar(user)) {
    await moveOffMainCalendar(env, user);
    return null;
  }
  const backend = opts.backend ?? calendarFor(env, user);
  // Each step logs how long it took, so a slow or stuck service shows up by name in the logs.
  let step = 'start';
  const timed = async <T>(name: string, run: () => Promise<T>): Promise<T> => {
    step = name;
    const t = Date.now();
    const result = await run();
    console.log('sync step', user.id, name, `${Date.now() - t} ms`);
    return result;
  };
  try {
    const calendarId = await timed('calendar', () => ensureCalendar(env, backend, user));
    const canvas = await timed('canvas', () => canvasFeedEvents(env, user));
    const inputHash = await syncInputHash(user, canvas);
    // Most hours nothing has changed: stop here, before reading anything else or calling Google.
    const fresh = user.full_sync_at !== null && Date.now() - user.full_sync_at < FULL_SYNC_EVERY_MS;
    if (!opts.force && fresh && user.last_sync_ok === 1 && user.input_hash === inputHash) {
      await touchSync(env.DB, user.id);
      console.log('sync', user.id, 'unchanged');
      return { upserts: [], deletes: [], failed: 0, remaining: 0, unchanged: true };
    }

    const { events, warnings, courses } = await timed('nusmods', () => desiredEvents(env, user, canvas));
    if (JSON.stringify(courses) !== user.courses) await setCourses(env.DB, user.id, courses);
    const plan = await timed('plan', async () => planSync(events, await trackedEvents(env.DB, user.id), Date.now(), user.mode));
    const applied = await timed('google calendar', () => applyPlan(backend, calendarId, plan));
    await timed('save', () => storeApplied(env.DB, user.id, applied));
    if (user.feed_token_hash) {
      const ics = await toIcs(events, { name: 'NUS semester', now: Date.now(), appUrl: env.APP_URL });
      await timed('feed', async () => saveFeed(env.DB, user.id, await gzipBase64(ics)));
    }
    console.log('sync', user.id, {
      upserts: applied.upserts.length, deletes: applied.deletes.length, failed: applied.failed, remaining: applied.remaining,
    });

    const notes = [...warnings];
    if (applied.remaining) notes.push(addingMessage(applied.remaining));
    if (applied.failed) notes.push(`${applied.failed} changes failed and will be retried.`);
    // Only a sync that got everything through can be skipped next time.
    const complete = applied.failed === 0 && applied.remaining === 0;
    await recordSync(env.DB, user.id, applied.failed === 0, notes.join(' '), complete ? inputHash : null);
    return applied;
  } catch (err) {
    const theirs = err instanceof ReconnectNeeded || err instanceof UserError;
    if (err instanceof ReconnectNeeded) await setNeedsReconnect(env.DB, user.id);
    else if (!theirs) console.error('sync failed', user.id, 'at', step, err);
    opts.onError?.(theirs ? 'user' : 'system', step, err instanceof Error ? err.message : String(err));
    const message = err instanceof UserError ? err.message : "Couldn't sync just now. It'll try again within the hour.";
    await recordSync(env.DB, user.id, false, message, null);
    return null;
  }
}

/**
 * Takes back everything Semsync put in the user's calendar: deletes the shared calendar, or every tagged
 * event it added to their own calendar. Used when switching modes and when deleting data.
 * Returns false if the events couldn't be removed (e.g. calendar access was already revoked).
 */
export async function removeFromCalendar(env: Env, user: UserRow): Promise<boolean> {
  let removed = true;
  if (user.calendar_id) {
    try {
      const backend = calendarFor(env, user);
      if (!inMainCalendar(user)) {
        // The shared calendar, or the user's own "NUS semester": Semsync made it, so it can delete it whole.
        await backend.deleteCalendar(user.calendar_id);
      } else {
        const ops = (await trackedEventIds(env.DB, user.id)).map((eventId): EventOp => ({ type: 'delete', eventId }));
        const results = await backend.apply(user.calendar_id, ops);
        removed = results.every((r, i) => succeeded(ops[i], r.status));
      }
    } catch (err) {
      console.error('remove from calendar failed', user.id, err);
      removed = false;
    }
  }
  await clearCalendar(env.DB, user.id);
  user.calendar_id = null;
  return removed;
}

/** Revokes and forgets the user's calendar access. */
export async function disconnectCalendar(env: Env, user: UserRow) {
  if (user.google_refresh_enc && env.FAKE_GOOGLE !== '1') {
    await revokeToken(await decrypt(env.ENCRYPTION_KEY, user.google_refresh_enc));
  }
  await setRefreshToken(env.DB, user.id, null);
  user.google_refresh_enc = null;
}

// Vercel Hobby functions get up to 300 s; stop picking up new users well before that.
const RUN_BUDGET_MS = 240_000;

/**
 * Syncs everyone who is due (last synced over 55 minutes ago), several at once, until none are left or time runs out.
 * Returns a tally for the logs, with the system errors grouped, so a GitHub Actions log shows what went wrong.
 */
export async function runDueSyncs(env: Env, budgetMs = RUN_BUDGET_MS) {
  const deadline = Date.now() + budgetMs;
  const workers = Math.max(1, Math.min(32, Number(env.SYNC_CONCURRENCY) || 8));
  const tally = { synced: 0, unchanged: 0, needsUser: 0, failed: 0 };
  const errors: Record<string, number> = {};
  const onError: SyncOptions['onError'] = (kind, where, message) => {
    if (kind === 'user') return void tally.needsUser++;
    tally.failed++;
    const key = `${where}: ${message.slice(0, 120)}`;
    errors[key] = (errors[key] ?? 0) + 1;
  };
  while (Date.now() < deadline) {
    const users = await claimDueUsers(env.DB, 55 * 60_000, workers * 3);
    if (users.length === 0) break;
    let next = 0;
    const work = async () => {
      while (next < users.length && Date.now() < deadline) {
        const result = await syncUser(env, users[next++], { onError });
        if (result) tally[result.unchanged ? 'unchanged' : 'synced']++;
      }
    };
    await Promise.all(Array.from({ length: Math.min(workers, users.length) }, work));
  }
  return { ...tally, timedOut: Date.now() >= deadline, errors };
}
