import type { Db } from './database.js';
import type { CalendarMode, EventKind } from './events.js';
import type { ModuleData } from './nusmods.js';

/**
 * Starts a write that only happens while the user still exists, so a sync that was running when someone deleted their
 * data can't write any of it back. It locks their row the way a foreign key would: a deletion at the same moment either
 * waits for this write and then removes it, or goes first and leaves this with no row to write for. Select from
 * `owner` (one column, the user's id) to insert.
 */
export const WHILE_USER_EXISTS = 'WITH owner AS (SELECT id FROM users WHERE id = ? FOR KEY SHARE)';

export type UserRow = {
  id: string;
  email: string;
  name: string | null;
  canvas_feed_enc: string | null;
  nusmods_link: string | null;
  mode: CalendarMode;
  calendar_id: string | null;
  google_refresh_enc: string | null;
  needs_reconnect: number;
  created_at: number;
  last_sync_at: number | null;
  last_sync_ok: number | null;
  last_sync_message: string | null;
  /** 1 to add "Week 7" style labels on each Monday, 0 not to. */
  week_labels: number;
  /** JSON: every course the last sync found, as { key, label }. */
  courses: string;
  /** JSON: the course keys the user switched off. */
  hidden_courses: string;
  /** The academic year the NUSMods link is for, as "2026-2027". */
  nusmods_ay: string | null;
  /** Fingerprint of what the last complete sync was built from, and when that was. */
  input_hash: string | null;
  full_sync_at: number | null;
  sync_claimed_at: number | null;
  /** The subscribe link's secret: hashed to look it up, encrypted to show it again. */
  feed_token_hash: string | null;
  feed_token_enc: string | null;
  /** JSON: when deadline and exam reminders go off, in minutes before. Null for Semsync's usual times. */
  deadline_reminders: string | null;
  exam_reminders: string | null;
};

export type Course = { key: string; label: string };

/** Reads one of the JSON list columns, treating anything unreadable as empty. */
export function jsonList<T>(text: string | null | undefined): T[] {
  try {
    const value = JSON.parse(text ?? '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export async function setCourses(db: Db, id: string, courses: Course[]) {
  await db.prepare('UPDATE users SET courses = ? WHERE id = ?').bind(JSON.stringify(courses), id).run();
}

export async function saveCourseSettings(db: Db, id: string, hidden: string[], weekLabels: boolean) {
  await db
    .prepare('UPDATE users SET hidden_courses = ?, week_labels = ? WHERE id = ?')
    .bind(JSON.stringify(hidden), weekLabels ? 1 : 0, id)
    .run();
}

export type TrackedRow = { event_id: string; hash: string; start_ms: number };
/** An event as the Semsync page lists it. Deadlines carry their id and whether they're ticked off, for the tick. */
export type UpcomingRow = { title: string; kind: EventKind; start_ms: number; all_day: number; event_id?: string; done?: number };

/** Saves reminder times from Settings: JSON lists of minutes before, or null to go back to the usual ones. */
export async function saveReminders(db: Db, id: string, deadline: string | null, exam: string | null) {
  await db.prepare('UPDATE users SET deadline_reminders = ?, exam_reminders = ? WHERE id = ?').bind(deadline, exam, id).run();
}

/** The ids of every deadline the user ticked off as done. */
export async function doneDeadlineIds(db: Db, userId: string): Promise<Set<string>> {
  const { results } = await db.prepare('SELECT event_id FROM done_deadlines WHERE user_id = ?').bind(userId).all<{ event_id: string }>();
  return new Set(results.map((r) => r.event_id));
}

/**
 * Ticks deadlines off, or back on. Only the user's own deadlines can be ticked: an id that isn't one of theirs is
 * ignored. Returns whether anything changed, so ticking something already ticked doesn't sync for nothing.
 */
export async function setDeadlinesDone(db: Db, userId: string, done: string[], undone: string[]): Promise<boolean> {
  let changed = 0;
  if (done.length) {
    const r = await db
      .prepare(
        `${WHILE_USER_EXISTS}
         INSERT INTO done_deadlines (user_id, event_id, done_at)
         SELECT s.user_id, s.event_id, ? FROM synced_events s, owner
         WHERE s.user_id = owner.id AND s.kind = 'deadline' AND s.event_id IN (${done.map(() => '?').join(',')})
         ON CONFLICT (user_id, event_id) DO NOTHING`,
      )
      .bind(userId, Date.now(), ...done)
      .run();
    changed += r.changes;
  }
  if (undone.length) {
    const r = await db
      .prepare(`DELETE FROM done_deadlines WHERE user_id = ? AND event_id IN (${undone.map(() => '?').join(',')})`)
      .bind(userId, ...undone)
      .run();
    changed += r.changes;
  }
  return changed > 0;
}

/** Every deadline from `fromMs` on, soonest first, each with whether it's ticked off. */
export async function deadlineList(db: Db, userId: string, fromMs: number): Promise<UpcomingRow[]> {
  const { results } = await db
    .prepare(
      `SELECT s.event_id, s.title, s.kind, s.start_ms, s.all_day, CASE WHEN d.event_id IS NULL THEN 0 ELSE 1 END AS done
       FROM synced_events s LEFT JOIN done_deadlines d ON d.user_id = s.user_id AND d.event_id = s.event_id
       WHERE s.user_id = ? AND s.kind = 'deadline' AND s.start_ms >= ?
       ORDER BY s.start_ms, s.title`,
    )
    .bind(userId, fromMs)
    .all<UpcomingRow>();
  return results;
}

export const getUser = (db: Db, id: string) =>
  db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first<UserRow>();

export async function upsertUserOnLogin(db: Db, u: { id: string; email: string; name: string | null }) {
  await db
    .prepare(
      `INSERT INTO users (id, email, name, created_at) VALUES (?, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET email = excluded.email, name = excluded.name`,
    )
    .bind(u.id, u.email, u.name, Date.now())
    .run();
}

export async function saveSources(db: Db, id: string, canvasFeedEnc: string | null, nusmodsLink: string | null, nusmodsAy: string | null) {
  await db
    .prepare('UPDATE users SET canvas_feed_enc = ?, nusmods_link = ?, nusmods_ay = ? WHERE id = ?')
    .bind(canvasFeedEnc, nusmodsLink, nusmodsLink ? nusmodsAy : null, id)
    .run();
}

export async function setCalendarId(db: Db, id: string, calendarId: string) {
  await db.prepare('UPDATE users SET calendar_id = ? WHERE id = ?').bind(calendarId, id).run();
}

export async function setMode(db: Db, id: string, mode: CalendarMode) {
  await db.prepare('UPDATE users SET mode = ? WHERE id = ?').bind(mode, id).run();
}

/** Stores (or clears) the user's encrypted refresh token, and un-pauses syncing when one is stored. */
export async function setRefreshToken(db: Db, id: string, refreshEnc: string | null) {
  await db
    .prepare('UPDATE users SET google_refresh_enc = ?, needs_reconnect = 0 WHERE id = ?')
    .bind(refreshEnc, id)
    .run();
  await db.prepare('DELETE FROM kv WHERE key = ?').bind(`token:user:${id}`).run();
}

export async function setNeedsReconnect(db: Db, id: string) {
  await db.prepare('UPDATE users SET needs_reconnect = 1 WHERE id = ?').bind(id).run();
}

/** Forgets which calendar the user's events are in and what was written there, so the next sync starts over. */
export async function clearCalendar(db: Db, id: string) {
  await db.batch([
    db.prepare('UPDATE users SET calendar_id = NULL, input_hash = NULL WHERE id = ?').bind(id),
    db.prepare('DELETE FROM synced_events WHERE user_id = ?').bind(id),
  ]);
}

export async function trackedEventIds(db: Db, userId: string): Promise<string[]> {
  const { results } = await db.prepare('SELECT event_id FROM synced_events WHERE user_id = ?').bind(userId).all<{ event_id: string }>();
  return results.map((r) => r.event_id);
}

/**
 * Records a sync. `inputHash` is what a complete sync was built from (stored with the time, so the next run can tell
 * nothing changed), or null after one that didn't finish, so the next run does everything again.
 */
export async function recordSync(db: Db, id: string, ok: boolean, message: string, inputHash?: string | null) {
  const now = Date.now();
  if (inputHash === undefined) {
    await db
      .prepare('UPDATE users SET last_sync_at = ?, last_sync_ok = ?, last_sync_message = ? WHERE id = ?')
      .bind(now, ok ? 1 : 0, message, id)
      .run();
  } else if (inputHash === null) {
    await db
      .prepare('UPDATE users SET last_sync_at = ?, last_sync_ok = ?, last_sync_message = ?, input_hash = NULL WHERE id = ?')
      .bind(now, ok ? 1 : 0, message, id)
      .run();
  } else {
    await db
      .prepare('UPDATE users SET last_sync_at = ?, last_sync_ok = ?, last_sync_message = ?, input_hash = ?, full_sync_at = ? WHERE id = ?')
      .bind(now, ok ? 1 : 0, message, inputHash, now, id)
      .run();
  }
}

/** A sync that found nothing new: only the time moves on, and the last message stays. */
export async function touchSync(db: Db, id: string) {
  await db.prepare('UPDATE users SET last_sync_at = ? WHERE id = ?').bind(Date.now(), id).run();
}

const CLAIM_MS = 10 * 60_000;
// A sync that didn't get everything through (more changes than one run sends) is picked up again at the next run
// rather than an hour later.
const UNFINISHED_MS = 15 * 60_000;

/**
 * Takes on up to `limit` users who are due, oldest first, marking them so another run that starts meanwhile skips
 * them. A claim lapses after 10 minutes, so anyone a run didn't get to is picked up by the next one.
 */
export async function claimDueUsers(db: Db, olderThanMs: number, limit: number): Promise<UserRow[]> {
  const now = Date.now();
  const due = `calendar_id IS NOT NULL AND needs_reconnect = 0
         AND (canvas_feed_enc IS NOT NULL OR nusmods_link IS NOT NULL)
         AND (last_sync_at IS NULL OR last_sync_at < ?
              OR (input_hash IS NULL AND last_sync_ok = 1 AND last_sync_at < ?))
         AND (sync_claimed_at IS NULL OR sync_claimed_at < ?)`;
  // The outer check runs again on each row as it's updated, so a row another run claimed in the meantime drops out.
  const { results } = await db
    .prepare(
      `UPDATE users SET sync_claimed_at = ?
       WHERE id IN (SELECT id FROM users WHERE ${due} ORDER BY last_sync_at NULLS FIRST LIMIT ?)
         AND ${due}
       RETURNING *`,
    )
    .bind(now, now - olderThanMs, now - UNFINISHED_MS, now - CLAIM_MS, limit, now - olderThanMs, now - UNFINISHED_MS, now - CLAIM_MS)
    .all<UserRow>();
  return results.sort((a, b) => (a.last_sync_at ?? 0) - (b.last_sync_at ?? 0));
}

/** Turns on (or replaces) the user's subscribe link. The next sync builds its .ics. */
export async function setFeedToken(db: Db, id: string, hash: string, enc: string) {
  await db.prepare('UPDATE users SET feed_token_hash = ?, feed_token_enc = ?, input_hash = NULL WHERE id = ?').bind(hash, enc, id).run();
}

/** Turns the subscribe link off: the old link stops working at once. */
export async function clearFeed(db: Db, id: string) {
  await db.batch([
    db.prepare('UPDATE users SET feed_token_hash = NULL, feed_token_enc = NULL WHERE id = ?').bind(id),
    db.prepare('DELETE FROM feeds WHERE user_id = ?').bind(id),
  ]);
}

export async function saveFeed(db: Db, userId: string, body: string) {
  await db
    .prepare(
      `${WHILE_USER_EXISTS}
       INSERT INTO feeds (user_id, body, updated_at) SELECT id, ?, ? FROM owner
       ON CONFLICT (user_id) DO UPDATE SET body = excluded.body, updated_at = excluded.updated_at`,
    )
    .bind(userId, body, Date.now())
    .run();
}

/** Who a subscribe link belongs to and when their .ics last changed, without reading the .ics itself. */
export const feedByHash = (db: Db, hash: string) =>
  db
    .prepare('SELECT u.id AS user_id, f.updated_at FROM users u LEFT JOIN feeds f ON f.user_id = u.id WHERE u.feed_token_hash = ?')
    .bind(hash)
    .first<{ user_id: string; updated_at: number | null }>();

export const feedBody = async (db: Db, userId: string) =>
  (await db.prepare('SELECT body FROM feeds WHERE user_id = ?').bind(userId).first<{ body: string }>())?.body ?? null;

export async function trackedEvents(db: Db, userId: string): Promise<TrackedRow[]> {
  const { results } = await db
    .prepare('SELECT event_id, hash, start_ms FROM synced_events WHERE user_id = ?')
    .bind(userId)
    .all<TrackedRow>();
  return results;
}

export async function upcomingEvents(db: Db, userId: string, kinds: EventKind[], limit: number) {
  const { results } = await db
    .prepare(
      `SELECT s.event_id, s.title, s.kind, s.start_ms, s.all_day, CASE WHEN d.event_id IS NULL THEN 0 ELSE 1 END AS done
       FROM synced_events s LEFT JOIN done_deadlines d ON d.user_id = s.user_id AND d.event_id = s.event_id
       WHERE s.user_id = ? AND s.start_ms >= ? AND s.kind IN (${kinds.map(() => '?').join(',')})
       ORDER BY s.start_ms LIMIT ?`,
    )
    .bind(userId, Date.now() - 3600_000, ...kinds, limit)
    .all<UpcomingRow>();
  return results;
}

export async function eventCounts(db: Db, userId: string): Promise<Record<string, number>> {
  const { results } = await db
    .prepare('SELECT kind, COUNT(*) AS n FROM synced_events WHERE user_id = ? GROUP BY kind')
    .bind(userId)
    .all<{ kind: string; n: number }>();
  return Object.fromEntries(results.map((r) => [r.kind, r.n]));
}

export async function deleteUserData(db: Db, id: string) {
  // The user's row goes first: a sync still writing for them holds a lock on it (see WHILE_USER_EXISTS), so this waits
  // for that write to finish, then removes it with the rest.
  await db.batch([
    db.prepare('DELETE FROM users WHERE id = ?').bind(id),
    db.prepare('DELETE FROM synced_events WHERE user_id = ?').bind(id),
    db.prepare('DELETE FROM feeds WHERE user_id = ?').bind(id),
    db.prepare('DELETE FROM done_deadlines WHERE user_id = ?').bind(id),
    db.prepare('DELETE FROM kv WHERE key = ?').bind(`token:user:${id}`),
    // AI apps they allowed, and every code and pass those apps hold.
    db.prepare('DELETE FROM oauth_tokens WHERE grant_id IN (SELECT id FROM oauth_grants WHERE user_id = ?)').bind(id),
    db.prepare('DELETE FROM oauth_grants WHERE user_id = ?').bind(id),
    db.prepare('DELETE FROM oauth_codes WHERE user_id = ?').bind(id),
  ]);
}

const MODULE_TTL_MS = 24 * 3600_000;

/** NUSMods module data, cached for a day; falls back to stale data if NUSMods is down. */
const moduleMemo = new Map<string, { at: number; data: Promise<ModuleData | null> }>();

/**
 * Remembers module data inside this process for 15 minutes, so a sync run reads each module from the database once
 * rather than once per student taking it (popular modules are taken by hundreds).
 */
export function memoModuleFetcher(fetch: (ay: string, code: string) => Promise<ModuleData | null>) {
  return (acadYear: string, code: string): Promise<ModuleData | null> => {
    const key = `${acadYear}:${code}`;
    const hit = moduleMemo.get(key);
    if (hit && Date.now() - hit.at < 15 * 60_000) return hit.data;
    const data = fetch(acadYear, code).catch((err) => {
      moduleMemo.delete(key);
      throw err;
    });
    moduleMemo.set(key, { at: Date.now(), data });
    return data;
  };
}

export function cachedModuleFetcher(db: Db, fetchFresh: (ay: string, code: string) => Promise<ModuleData | null>) {
  // The cache only saves NUSMods some requests: if the database can't be read or written, the sync carries on with a
  // fresh copy from NUSMods instead of failing.
  return async (acadYear: string, code: string): Promise<ModuleData | null> => {
    let cached: { data: string; fetched_at: number } | null = null;
    try {
      cached = await db
        .prepare('SELECT data, fetched_at FROM module_cache WHERE acad_year = ? AND code = ?')
        .bind(acadYear, code)
        .first<{ data: string; fetched_at: number }>();
    } catch (err) {
      console.warn('module cache read failed, fetching from NUSMods', code, err instanceof Error ? err.message : err);
    }
    if (cached && Date.now() - cached.fetched_at < MODULE_TTL_MS) return JSON.parse(cached.data);

    let fresh: ModuleData | null;
    try {
      fresh = await fetchFresh(acadYear, code);
    } catch (err) {
      if (cached) return JSON.parse(cached.data);
      throw err;
    }
    try {
      await db
        .prepare(
          `INSERT INTO module_cache (acad_year, code, data, fetched_at) VALUES (?, ?, ?, ?)
           ON CONFLICT (acad_year, code) DO UPDATE SET data = excluded.data, fetched_at = excluded.fetched_at`,
        )
        .bind(acadYear, code, JSON.stringify(fresh), Date.now())
        .run();
    } catch (err) {
      console.warn('module cache write failed', code, err instanceof Error ? err.message : err);
    }
    return fresh;
  };
}
