import type { GoogleEventBody } from '../events';

export type EventOp =
  | { type: 'insert'; eventId: string; body: GoogleEventBody }
  | { type: 'update'; eventId: string; body: GoogleEventBody }
  | { type: 'delete'; eventId: string };

/** HTTP status Google returned for one operation (0 if it never came back). */
export type OpResult = { eventId: string; status: number };

/** The app's own calendar account: it owns one calendar per user and shares it with them. */
export interface CalendarBackend {
  createCalendar(summary: string, description: string): Promise<string>;
  shareWith(calendarId: string, email: string): Promise<void>;
  deleteCalendar(calendarId: string): Promise<void>;
  apply(calendarId: string, ops: EventOp[]): Promise<OpResult[]>;
}
