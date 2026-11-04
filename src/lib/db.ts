import type { Db } from './database.js';
import type { CalendarMode, EventKind } from './events.js';
import type { ModuleData } from './nusmods.js';

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
};

export type TrackedRow = { event_id: string; hash: string; start_ms: number };
export type UpcomingRow = { title: string; kind: EventKind; start_ms: number; all_day: number };

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

export async function saveSources(db: Db, id: string, canvasFeedEnc: string | null, nusmodsLink: string | null) {
  await db
    .prepare('UPDATE users SET canvas_feed_enc = ?, nusmods_link = ? WHERE id = ?')
    .bind(canvasFeedEnc, nusmodsLink, id)
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

/** Forgets which calendar the user's events are in and what was written there. */
export async function clearCalendar(db: Db, id: string) {
  await db.batch([
    db.prepare('UPDATE users SET calendar_id = NULL WHERE id = ?').bind(id),
    db.prepare('DELETE FROM synced_events WHERE user_id = ?').bind(id),
  ]);
}

export async function trackedEventIds(db: Db, userId: string): Promise<string[]> {
  const { results } = await db.prepare('SELECT event_id FROM synced_events WHERE user_id = ?').bind(userId).all<{ event_id: string }>();
  return results.map((r) => r.event_id);
}

export async function recordSync(db: Db, id: string, ok: boolean, message: string) {
  await db
    .prepare('UPDATE users SET last_sync_at = ?, last_sync_ok = ?, last_sync_message = ? WHERE id = ?')
    .bind(Date.now(), ok ? 1 : 0, message, id)
    .run();
}

/** Set-up users whose last sync is older than `olderThanMs`, oldest first. */
export async function dueUsers(db: Db, olderThanMs: number, limit: number): Promise<UserRow[]> {
  const { results } = await db
    .prepare(
      `SELECT * FROM users
       WHERE calendar_id IS NOT NULL AND needs_reconnect = 0
         AND (canvas_feed_enc IS NOT NULL OR nusmods_link IS NOT NULL)
         AND (last_sync_at IS NULL OR last_sync_at < ?)
       ORDER BY last_sync_at NULLS FIRST
       LIMIT ?`,
    )
    .bind(Date.now() - olderThanMs, limit)
    .all<UserRow>();
  return results;
}

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
      `SELECT title, kind, start_ms, all_day FROM synced_events
       WHERE user_id = ? AND start_ms >= ? AND kind IN (${kinds.map(() => '?').join(',')})
       ORDER BY start_ms LIMIT ?`,
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
  await db.batch([
    db.prepare('DELETE FROM synced_events WHERE user_id = ?').bind(id),
    db.prepare('DELETE FROM kv WHERE key = ?').bind(`token:user:${id}`),
    db.prepare('DELETE FROM users WHERE id = ?').bind(id),
  ]);
}

const MODULE_TTL_MS = 24 * 3600_000;

/** NUSMods module data, cached for a day; falls back to stale data if NUSMods is down. */
export function cachedModuleFetcher(db: Db, fetchFresh: (ay: string, code: string) => Promise<ModuleData | null>) {
  return async (acadYear: string, code: string): Promise<ModuleData | null> => {
    const cached = await db
      .prepare('SELECT data, fetched_at FROM module_cache WHERE acad_year = ? AND code = ?')
      .bind(acadYear, code)
      .first<{ data: string; fetched_at: number }>();
    if (cached && Date.now() - cached.fetched_at < MODULE_TTL_MS) return JSON.parse(cached.data);

    try {
      const fresh = await fetchFresh(acadYear, code);
      await db
        .prepare(
          `INSERT INTO module_cache (acad_year, code, data, fetched_at) VALUES (?, ?, ?, ?)
           ON CONFLICT (acad_year, code) DO UPDATE SET data = excluded.data, fetched_at = excluded.fetched_at`,
        )
        .bind(acadYear, code, JSON.stringify(fresh), Date.now())
        .run();
      return fresh;
    } catch (err) {
      if (cached) return JSON.parse(cached.data);
      throw err;
    }
  };
}
