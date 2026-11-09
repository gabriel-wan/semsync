// The subscribe link: the same events as the Google calendar, written as an iCalendar (.ics) file that Outlook, Apple
// Calendar and any other calendar app can subscribe to. Each sync that changes something writes it again, gzipped,
// and the link serves it straight from the database.
import { TIME_ZONE } from '../config.js';
import { b64url, sha256Hex } from './crypto.js';
import { DONE_MARK, eventId, REMINDERS, type CalEvent, type CalTime, type ReminderTimes } from './events.js';

const KIND_NAME = { deadline: 'Deadline', event: 'Event', class: 'Class', exam: 'Exam', week: 'Week' } as const;

/** Text as an iCalendar value: backslashes, semicolons, commas and line breaks escaped. */
export function icsText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Long lines are folded at 75 bytes, as the standard asks, without splitting a character. */
export function foldLine(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let current = '';
  let bytes = 0;
  for (const ch of line) {
    const size = encoder.encode(ch).length;
    // Continuation lines start with a space, which counts towards their 75.
    if (bytes + size > (parts.length ? 74 : 75)) {
      parts.push(current);
      current = '';
      bytes = 0;
    }
    current += ch;
    bytes += size;
  }
  parts.push(current);
  return parts.join('\r\n ');
}

const utcStamp = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

function icsTime(name: 'DTSTART' | 'DTEND', t: CalTime): string {
  return 'date' in t ? `${name};VALUE=DATE:${t.date.replace(/-/g, '')}` : `${name}:${utcStamp(Date.parse(t.dateTime))}`;
}

/** The whole calendar as an .ics file. */
export async function toIcs(
  events: CalEvent[], opts: { name: string; now: number; appUrl: string; reminders?: ReminderTimes },
): Promise<string> {
  const times = opts.reminders ?? REMINDERS;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Semsync//NUS semester//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${icsText(opts.name)}`,
    `X-WR-CALDESC:${icsText(`Canvas deadlines, NUSMods classes and exams, kept up to date by Semsync (${opts.appUrl}).`)}`,
    `X-WR-TIMEZONE:${TIME_ZONE}`,
    // Asks apps to check back hourly. Most check less often anyway: Outlook every few hours.
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
    'X-PUBLISHED-TTL:PT1H',
  ];
  const seen = new Set<string>();
  const stamp = utcStamp(opts.now);
  for (const ev of events) {
    const id = await eventId(ev.key);
    if (seen.has(id)) continue;
    seen.add(id);
    const description = [ev.description, ev.url, 'Added by Semsync.'].filter(Boolean).join('\n\n');
    lines.push(
      'BEGIN:VEVENT',
      `UID:${id}@semsync`,
      `DTSTAMP:${stamp}`,
      icsTime('DTSTART', ev.start),
      icsTime('DTEND', ev.end),
      `SUMMARY:${icsText(ev.done ? `${DONE_MARK}${ev.title}` : ev.title)}`,
    );
    if (ev.location) lines.push(`LOCATION:${icsText(ev.location)}`);
    lines.push(`DESCRIPTION:${icsText(description)}`);
    if (ev.url && /^https?:\/\//.test(ev.url)) lines.push(`URL:${ev.url}`);
    lines.push(`CATEGORIES:${KIND_NAME[ev.kind]}`);
    // Deadlines, week labels and all day events shouldn't make you look busy.
    lines.push(`TRANSP:${ev.kind === 'deadline' || ev.kind === 'week' || 'date' in ev.start ? 'TRANSPARENT' : 'OPAQUE'}`);
    // A deadline ticked off as done reminds nobody, like the week labels.
    for (const minutes of ev.kind === 'week' || ev.done ? [] : times[ev.kind] ?? []) {
      lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsText(ev.title)}`, `TRIGGER:-PT${minutes}M`, 'END:VALARM');
    }
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return `${lines.map(foldLine).join('\r\n')}\r\n`;
}

async function streamToBytes(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Gzips text and returns it as base64, for the feeds table: an .ics shrinks to about a tenth. */
export async function gzipBase64(text: string): Promise<string> {
  const bytes = await streamToBytes(new Blob([text]).stream().pipeThrough(new CompressionStream('gzip')));
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export async function gunzipBase64(b64: string): Promise<string> {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const out = await streamToBytes(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')));
  return new TextDecoder().decode(out);
}

/** A new secret for a subscribe link: 24 random bytes, as 32 URL-safe characters. */
export const newFeedToken = () => b64url(crypto.getRandomValues(new Uint8Array(24)));

/** What the database keeps to find a link by: its SHA-256, so the link itself never sits there in the clear. */
export const feedTokenHash = (token: string): Promise<string> => sha256Hex(token);

export const feedUrl = (appUrl: string, token: string) => `${appUrl}/feed/${token}.ics`;
