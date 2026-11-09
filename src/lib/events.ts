import { TIME_ZONE, TZ_OFFSET } from '../config.js';

export type CalTime = { date: string } | { dateTime: string };

export type EventKind = 'deadline' | 'event' | 'class' | 'exam' | 'week';

/**
 * 'main': a calendar in the user's own Google account. 'feed': no Google Calendar, only a subscribe link for Outlook,
 * Apple Calendar and others. 'shared': the old option, a calendar in the app's account shared read-only.
 */
export type CalendarMode = 'main' | 'shared' | 'feed';

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
  /** A deadline the user ticked off: no reminders, greyed out, with a tick in front of its title. */
  done?: boolean;
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
export const REMINDERS: Partial<Record<EventKind, number[]>> = {
  deadline: [24 * 60, 3 * 60],
  exam: [7 * 24 * 60, 24 * 60],
};

/** When each kind's reminders go off, in minutes before. Classes and events aren't listed: they follow the calendar's own. */
export type ReminderTimes = Partial<Record<EventKind, number[]>>;

/** The times Settings offers, longest first. Google allows five reminders an event, so a whole row always fits. */
export const REMINDER_CHOICES = {
  deadline: [7 * 24 * 60, 3 * 24 * 60, 24 * 60, 3 * 60, 60],
  exam: [14 * 24 * 60, 7 * 24 * 60, 3 * 24 * 60, 24 * 60],
} as const;

export type RemindedKind = keyof typeof REMINDER_CHOICES;

/** "3 days", "1 hour": a reminder time as Settings shows it. */
export function reminderLabel(minutes: number): string {
  const [n, unit] = minutes % (7 * 1440) === 0 ? [minutes / (7 * 1440), 'week'] : minutes % 1440 === 0 ? [minutes / 1440, 'day'] : [minutes / 60, 'hour'];
  return `${n} ${unit}${n === 1 ? '' : 's'}`;
}

/**
 * Only times Settings offers, each once, longest first. Anything else (an old or tampered value) is dropped rather than
 * sent to Google.
 */
export function cleanReminders(kind: RemindedKind, minutes: unknown[]): number[] {
  const wanted = new Set(minutes.map(Number));
  return REMINDER_CHOICES[kind].filter((m) => wanted.has(m));
}

/**
 * Someone's reminder times: the ones they picked in Settings (stored as JSON lists), or the usual ones where they
 * haven't. An empty list is a choice too: no reminders.
 */
export function reminderTimes(deadline: string | null, exam: string | null): ReminderTimes {
  const picked = (kind: RemindedKind, text: string | null) => {
    if (text === null) return REMINDERS[kind]!;
    try {
      const value = JSON.parse(text);
      return Array.isArray(value) ? cleanReminders(kind, value) : REMINDERS[kind]!;
    } catch {
      return REMINDERS[kind]!;
    }
  };
  return { ...REMINDERS, deadline: picked('deadline', deadline), exam: picked('exam', exam) };
}

/** What the calendar shows for a deadline ticked off as done. Grey (Graphite) like the week labels, so it recedes. */
export const DONE_MARK = '✓ ';
const DONE_COLOR = '8';

export type GoogleEventBody = Record<string, unknown>;

export function toGoogleEvent(ev: CalEvent, mode: CalendarMode = 'shared', times: ReminderTimes = REMINDERS): GoogleEventBody {
  // Week labels never remind anyone of anything, and nor does a deadline that's done.
  const reminders = ev.kind === 'week' || ev.done ? [] : mode === 'main' ? times[ev.kind] : undefined;
  // The footer lets people find (and if needed, delete) everything Semsync added by searching "Semsync".
  const description = [ev.description, ev.url, 'Added by Semsync.'].filter(Boolean).join('\n\n');
  const body: GoogleEventBody = {
    summary: ev.done ? `${DONE_MARK}${ev.title}` : ev.title,
    start: withTimeZone(ev.start),
    end: withTimeZone(ev.end),
    status: 'confirmed',
    // Deadlines, week labels and all day events shouldn't make you look busy.
    transparency: ev.kind === 'deadline' || ev.kind === 'week' || 'date' in ev.start ? 'transparent' : 'opaque',
    // Tags every event as ours, so Semsync never touches anything else in the calendar.
    extendedProperties: { private: { semsync: '1', key: ev.key } },
    reminders: reminders
      ? { useDefault: false, overrides: reminders.map((minutes) => ({ method: 'popup', minutes })) }
      : { useDefault: true },
  };
  if (description) body.description = description;
  if (ev.location) body.location = ev.location;
  const colorId = ev.done ? DONE_COLOR : ev.color ?? COLORS[ev.kind];
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
