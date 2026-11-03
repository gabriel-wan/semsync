import { UserError } from './errors.js';
import type { CalEvent } from './events.js';
import { parseIcs, parseIcsTime, unescapeText } from './ics.js';

const MAX_FEED_BYTES = 2_000_000;

/** Checks a pasted Canvas calendar feed link and returns it normalised to https. */
export function validateCanvasFeedUrl(raw: string, allowedHosts: string[]): string {
  const trimmed = raw.trim().replace(/^webcals?:\/\//i, 'https://');
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new UserError("That doesn't look like a link. Copy the Calendar Feed link from Canvas.");
  }
  const hostOk = allowedHosts.includes(url.hostname) || url.hostname.endsWith('.instructure.com');
  if (url.protocol !== 'https:' || !hostOk) {
    throw new UserError('Use the Calendar Feed link from your Canvas site, starting with https://canvas.nus.edu.sg.');
  }
  if (!url.pathname.startsWith('/feeds/calendars/') || !url.pathname.endsWith('.ics')) {
    throw new UserError("That's a Canvas link, but not the calendar feed. In Canvas, open Calendar and copy the Calendar Feed link.");
  }
  url.hash = '';
  return url.toString();
}

export async function fetchCanvasFeed(url: string): Promise<string> {
  const res = await fetch(url, { headers: { accept: 'text/calendar' } });
  if (res.status === 401 || res.status === 404) {
    throw new UserError('Canvas rejected your feed link. It may have been reset; paste the new one.');
  }
  if (!res.ok) throw new Error(`Canvas feed returned ${res.status}`);
  const text = await res.text();
  if (text.length > MAX_FEED_BYTES) throw new Error('Canvas feed is unexpectedly large');
  if (!text.includes('BEGIN:VCALENDAR')) throw new UserError("Canvas didn't return a calendar for that link.");
  return text;
}

export function canvasEvents(icsText: string): CalEvent[] {
  const byKey = new Map<string, CalEvent>();
  for (const ve of parseIcs(icsText)) {
    const uid = ve.UID?.value;
    const start = parseIcsTime(ve.DTSTART);
    if (!uid || !start) continue;

    const end = parseIcsTime(ve.DTEND) ?? start;
    const isDeadline = uid.includes('assignment');
    const summary = unescapeText(ve.SUMMARY?.value ?? 'Untitled');
    const description = isDeadline ? 'Due on Canvas.' : undefined;
    const location = ve.LOCATION ? unescapeText(ve.LOCATION.value) : undefined;

    byKey.set(uid, {
      key: `canvas:${uid}`,
      kind: isDeadline ? 'deadline' : 'event',
      title: formatTitle(summary),
      start,
      // A deadline is a moment, so it starts and ends at the due time.
      end: isDeadline ? start : end,
      location: location || undefined,
      description,
      url: ve.URL?.value,
    });
  }
  return [...byKey.values()];
}

const MODULE_CODE = /\b([A-Z]{2,4}\d{4}[A-Z]{0,3})\b/;

/** "Problem Set 3 [CS2040 Data Structures]" becomes "[CS2040] Problem Set 3". */
export function formatTitle(summary: string): string {
  const s = summary.trimEnd();
  if (!s.endsWith(']')) return summary;
  // Walk back to the "[" that opens the trailing course name; course names can contain brackets too.
  let depth = 0;
  for (let i = s.length - 1; i >= 0; i--) {
    if (s[i] === ']') depth++;
    else if (s[i] === '[' && --depth === 0) {
      const name = s.slice(0, i).trim();
      if (!name) return summary;
      const course = s.slice(i + 1, -1);
      return `[${MODULE_CODE.exec(course)?.[1] ?? course}] ${name}`;
    }
  }
  return summary;
}
