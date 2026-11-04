import { findTerm } from '../config.js';
import { isDev, type Env } from '../env.js';
import { SAMPLE_CANVAS_FEED } from '../fixtures/sampleCanvas.js';
import { FakeCalendar } from './calendar/fake.js';
import { GoogleCalendar } from './calendar/google.js';
import { ReconnectNeeded, revokeToken, serviceAccountTokens, userTokens } from './calendar/tokens.js';
import type { CalendarBackend, EventOp } from './calendar/types.js';
import { canvasEvents, fetchCanvasFeed } from './canvas.js';
import { decrypt } from './crypto.js';
import {
  cachedModuleFetcher,
  clearCalendar,
  dueUsers,
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
  eventId, hashBody, startMs, toGoogleEvent, type CalEvent, type CalendarMode, type EventKind, type GoogleEventBody,
} from './events.js';
import { fetchModuleFromApi, nusmodsEvents, parseNusmodsLink } from './nusmods.js';

const DAY_MS = 24 * 3600_000;
// Per sync run, so a first sync of a big semester spreads over a few runs instead of hitting limits.
const MAX_OPS_PER_SYNC = 200;

export const SAMPLE_FEED = 'sample';

/** The calendar account to act as for this user: their own in main mode, the app's in shared mode. */
export function calendarFor(env: Env, user: UserRow): CalendarBackend {
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

/** Everything that should be in a user's calendar right now. Throws if any source fails, so nothing gets deleted by mistake. */
export async function desiredEvents(env: Env, user: UserRow): Promise<{ events: CalEvent[]; warnings: string[] }> {
  const events: CalEvent[] = [];
  const warnings: string[] = [];

  if (user.canvas_feed_enc) {
    const url = await decrypt(env.ENCRYPTION_KEY, user.canvas_feed_enc);
    const ics = isDev(env) && url === SAMPLE_FEED ? SAMPLE_CANVAS_FEED : await fetchCanvasFeed(url);
    events.push(...canvasEvents(ics));
  }

  if (user.nusmods_link) {
    const link = parseNusmodsLink(user.nusmods_link);
    const term = findTerm(link.semester);
    if (term) {
      const result = await nusmodsEvents(link, term, cachedModuleFetcher(env.DB, fetchModuleFromApi));
      events.push(...result.events);
      warnings.push(...result.warnings);
    }
  }
  return { events, warnings };
}

/** The calendar to write to: the user's primary calendar, or (shared mode) one created and shared the first time. */
export async function ensureCalendar(env: Env, backend: CalendarBackend, user: UserRow): Promise<string> {
  if (user.calendar_id) return user.calendar_id;
  let calendarId: string;
  if (user.mode === 'main') {
    if (!hasCalendarAccess(user)) throw new ReconnectNeeded();
    // The fake calendar keeps each user's "primary" calendar separate.
    calendarId = env.FAKE_GOOGLE === '1' ? `primary:${user.id}` : 'primary';
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

export async function syncUser(env: Env, user: UserRow, backend = calendarFor(env, user)) {
  try {
    const calendarId = await ensureCalendar(env, backend, user);
    const { events, warnings } = await desiredEvents(env, user);
    const plan = await planSync(events, await trackedEvents(env.DB, user.id), Date.now(), user.mode);
    const applied = await applyPlan(backend, calendarId, plan);
    await storeApplied(env.DB, user.id, applied);
    console.log('sync', user.id, {
      upserts: applied.upserts.length, deletes: applied.deletes.length, failed: applied.failed, remaining: applied.remaining,
    });

    const notes = [...warnings];
    if (applied.remaining) notes.push(`${applied.remaining} more changes will go through on the next sync.`);
    if (applied.failed) notes.push(`${applied.failed} changes failed and will be retried.`);
    await recordSync(env.DB, user.id, applied.failed === 0, notes.join(' '));
    return applied;
  } catch (err) {
    if (err instanceof ReconnectNeeded) await setNeedsReconnect(env.DB, user.id);
    else console.error('sync failed', user.id, err);
    const message = err instanceof UserError ? err.message : "Couldn't sync just now. It'll try again within the hour.";
    await recordSync(env.DB, user.id, false, message);
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
      if (user.mode === 'shared') {
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

/** Syncs every user who is due (last synced over 55 minutes ago), in batches, until none are left or time runs out. */
export async function runDueSyncs(env: Env, budgetMs = RUN_BUDGET_MS) {
  const deadline = Date.now() + budgetMs;
  const batch = Math.max(1, Number(env.SYNC_BATCH) || 1);
  let synced = 0;
  let failed = 0;
  while (Date.now() < deadline) {
    const users = await dueUsers(env.DB, 55 * 60_000, batch);
    if (users.length === 0) break;
    for (const user of users) {
      if (Date.now() >= deadline) break;
      // syncUser records every attempt, so a user who fails isn't picked again in this run.
      if (await syncUser(env, user)) synced++;
      else failed++;
    }
  }
  return { synced, failed, timedOut: Date.now() >= deadline };
}
