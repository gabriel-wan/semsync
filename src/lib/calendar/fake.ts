import type { Db } from '../database.js';
import type { CalendarBackend, EventOp, OpResult } from './types.js';

/**
 * Stand-in for Google Calendar in local development (FAKE_GOOGLE=1), stored in the local database.
 * Mirrors Google's behaviour that matters to the sync: deleted events stay as "cancelled",
 * inserting an existing id returns 409, and updating a missing id returns 404.
 */
export class FakeCalendar implements CalendarBackend {
  constructor(private db: Db) {}

  async createCalendar(summary: string): Promise<string> {
    const id = `fake_${crypto.randomUUID().replace(/-/g, '')}@group.calendar.google.com`;
    await this.db.prepare('INSERT INTO fake_calendars (id, summary) VALUES (?, ?)').bind(id, summary).run();
    return id;
  }

  async shareWith(calendarId: string, email: string): Promise<void> {
    await this.db.prepare('UPDATE fake_calendars SET shared_with = ? WHERE id = ?').bind(email, calendarId).run();
  }

  async deleteCalendar(calendarId: string): Promise<void> {
    await this.db.batch([
      this.db.prepare('DELETE FROM fake_events WHERE calendar_id = ?').bind(calendarId),
      this.db.prepare('DELETE FROM fake_calendars WHERE id = ?').bind(calendarId),
    ]);
  }

  async apply(calendarId: string, ops: EventOp[]): Promise<OpResult[]> {
    const results: OpResult[] = [];
    for (const op of ops) {
      const row = await this.db
        .prepare('SELECT body FROM fake_events WHERE calendar_id = ? AND event_id = ?')
        .bind(calendarId, op.eventId)
        .first<{ body: string }>();
      const cancelled = row ? JSON.parse(row.body).status === 'cancelled' : false;

      let status: number;
      if (op.type === 'insert') status = row ? 409 : 200;
      else if (op.type === 'update') status = row ? 200 : 404;
      else status = row && !cancelled ? 204 : 410;

      if (status < 300) {
        const body = op.type === 'delete' ? { ...JSON.parse(row!.body), status: 'cancelled' } : op.body;
        await this.db
          .prepare(
            `INSERT INTO fake_events (calendar_id, event_id, body) VALUES (?, ?, ?)
             ON CONFLICT (calendar_id, event_id) DO UPDATE SET body = excluded.body`,
          )
          .bind(calendarId, op.eventId, JSON.stringify(body))
          .run();
      }
      results.push({ eventId: op.eventId, status });
    }
    return results;
  }
}
