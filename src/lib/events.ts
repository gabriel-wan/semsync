import { TIME_ZONE, TZ_OFFSET } from '../config.js';

export type CalTime = { date: string } | { dateTime: string };

export type EventKind = 'deadline' | 'event' | 'class' | 'exam' | 'week';

/** 'main': the user's own calendar. 'shared': a calendar in the app's account, shared read-only. */
export type CalendarMode = 'main' | 'shared';

/** One event we want in a user's calendar, before it becomes a Google Calendar event. */
export type CalEvent = {
  /** Stable source identifier, e.g. "canvas:event-assignment-123". */
  key: string;
  kind: EventKind;
  title: string;
  start: CalTime;
  end: CalTime;
  location?: string;
  description?: string;
  url?: string;
  /** Which course it belongs to: the module code, or "canvas:<course name>" for courses without one. */
  course?: string;
  /** The course's name, for the course switches on the Semsync page. */
  courseLabel?: string;
  /** Other codes the same course is listed under (cross-listed Canvas courses), to match it to the NUSMods code. */
  courseAliases?: string[];
  /** A Google Calendar colour id, overriding the colour for its kind. */
  color?: string;
};

// Google Calendar event colour ids.
const COLORS: Partial<Record<EventKind, string>> = {
  deadline: '6', // Tangerine
  exam: '11', // Tomato
  week: '8', // Graphite
};

// Colours for modules, in the order they're handed out: every Google event colour except Tomato (exams) and Graphite
// (week labels). Nine, which covers a normal semester without repeats.
const MODULE_PALETTE = ['9', '2', '3', '5', '7', '4', '10', '1', '6'];

/** Google's hex value for each event colour id, to show the same colour on the Semsync page. */
export const GOOGLE_EVENT_COLORS: Record<string, string> = {
  '1': '#7986cb', '2': '#33b679', '3': '#8e24aa', '4': '#e67c73', '5': '#f6bf26', '6': '#f4511e', '7': '#039be5',
  '8': '#616161', '9': '#3f51b5', '10': '#0b8043', '11': '#d50000',
};

/** A colour per module code, handed out in alphabetical order, so each stays put while the course list does. */
export function moduleColors(courseKeys: string[]): Map<string, string> {
  const codes = [...new Set(courseKeys.filter((k) => !k.startsWith('canvas:')))].sort();
  return new Map(codes.map((code, i) => [code, MODULE_PALETTE[i % MODULE_PALETTE.length]]));
}

// Minutes before. Only possible in the user's own calendar: on a shared calendar, reminders are the reader's choice.
const REMINDERS: Partial<Record<EventKind, number[]>> = {
  deadline: [24 * 60, 3 * 60],
  exam: [7 * 24 * 60, 24 * 60],
};

export type GoogleEventBody = Record<string, unknown>;

export function toGoogleEvent(ev: CalEvent, mode: CalendarMode = 'shared'): GoogleEventBody {
  // Week labels never remind anyone of anything.
  const reminders = ev.kind === 'week' ? [] : mode === 'main' ? REMINDERS[ev.kind] : undefined;
  // The footer lets people find (and if needed, delete) everything Semsync added by searching "Semsync".
  const description = [ev.description, ev.url, 'Added by Semsync.'].filter(Boolean).join('\n\n');
  const body: GoogleEventBody = {
    summary: ev.title,
    start: withTimeZone(ev.start),
    end: withTimeZone(ev.end),
    status: 'confirmed',
    // Deadlines and week labels shouldn't make you look busy.
    transparency: ev.kind === 'deadline' || ev.kind === 'week' ? 'transparent' : 'opaque',
    // Tags every event as ours, so Semsync never touches anything else in the calendar.
    extendedProperties: { private: { semsync: '1', key: ev.key } },
    reminders: reminders
      ? { useDefault: false, overrides: reminders.map((minutes) => ({ method: 'popup', minutes })) }
      : { useDefault: true },
  };
  if (description) body.description = description;
  if (ev.location) body.location = ev.location;
  const colorId = ev.color ?? COLORS[ev.kind];
  if (colorId) body.colorId = colorId;
  return body;
}

function withTimeZone(t: CalTime) {
  return 'date' in t ? { date: t.date } : { dateTime: t.dateTime, timeZone: TIME_ZONE };
}

export function startMs(t: CalTime): number {
  return Date.parse('date' in t ? `${t.date}T00:00:00${TZ_OFFSET}` : t.dateTime);
}

const BASE32HEX = '0123456789abcdefghijklmnopqrstuv';

/** Google Calendar event id derived from the source key, so re-syncs update instead of duplicating. */
export async function eventId(key: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key)));
  let out = '';
  let value = 0;
  let bits = 0;
  for (const byte of digest) {
    value = ((value << 8) | byte) & 0xfff;
    bits += 8;
    while (bits >= 5) {
      out += BASE32HEX[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  return `ss${out.slice(0, 30)}`;
}

export async function hashBody(body: GoogleEventBody): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(body)));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}
