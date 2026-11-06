import type { CalendarBackend, EventOp, OpResult } from './types.js';

/**
 * For people on the subscribe link only, with no Google Calendar: every change "goes through" here, so the sync still
 * records what's in their calendar (for the Semsync page) while the .ics carries the events to their app.
 */
export class FeedOnlyCalendar implements CalendarBackend {
  async createCalendar(): Promise<string> {
    return 'feed';
  }
  async shareWith(): Promise<void> {}
  async deleteCalendar(): Promise<void> {}
  async apply(_calendarId: string, ops: EventOp[]): Promise<OpResult[]> {
    return ops.map((op) => ({ eventId: op.eventId, status: 200 }));
  }
}
