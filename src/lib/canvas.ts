import { UserError } from './errors.js';
import { TimeoutError, USER_AGENT, fetchWithin } from './http.js';
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
  let res: Response | undefined;
  for (let attempt = 1; !res; attempt++) {
    try {
      res = await fetchWithin(15_000, 'Canvas', url, { headers: { accept: 'text/calendar', 'user-agent': USER_AGENT } });
    } catch (err) {
      if (!(err instanceof TimeoutError)) throw err;
      console.warn('Canvas timed out, attempt', attempt);
      if (attempt === 2) throw new UserError("Canvas didn't answer in time. Semsync will try again shortly.");
    }
  }
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

    const course = courseOf(summary);
    byKey.set(uid, {
      key: `canvas:${uid}`,
      kind: isDeadline ? 'deadline' : 'event',
      title: formatTitle(summary),
      course: course.key,
      courseLabel: course.label,
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

/**
 * "Problem Set 3 [CS2040 Data Structures]" becomes "[CS2040] Problem Set 3". When the item's own name repeats the
 * course (course events often do), the repeat goes too: "ST2334 Probability [2610] [ST2334 Probability [2610]]"
 * becomes "[ST2334] Probability", without the code twice or the section number.
 */
export function formatTitle(summary: string): string {
  const parts = splitCourse(summary);
  if (!parts) return summary;
  const { name, course } = parts;
  const code = MODULE_CODE.exec(course)?.[1];
  if (!code) return `[${course}] ${name}`;
  // Drop a leading copy of the code and Canvas's trailing section number, like "[2610]".
  const tidy = name.replace(new RegExp(`^${code}\\b[\\s:-]*`), '').replace(/\s*\[\d{4}\]$/, '').trim();
  return `[${code}] ${tidy || name}`;
}

/** Splits "Problem Set 5 [CS2040 Data Structures [2610]]" into the item's name and the trailing course name. */
function splitCourse(summary: string): { name: string; course: string } | null {
  const s = summary.trimEnd();
  if (!s.endsWith(']')) return null;
  // Walk back to the "[" that opens the trailing course name; course names can contain brackets too.
  let depth = 0;
  for (let i = s.length - 1; i >= 0; i--) {
    if (s[i] === ']') depth++;
    else if (s[i] === '[' && --depth === 0) {
      const name = s.slice(0, i).trim();
      return name ? { name, course: s.slice(i + 1, -1) } : null;
    }
  }
  return null;
}

/**
 * The course a Canvas item belongs to, for the course switches: keyed by module code when the course name has one,
 * so it matches the same module from NUSMods. Items with no course (holidays, your own Canvas events) share one key.
 */
export function courseOf(summary: string): { key: string; label: string } {
  const parts = splitCourse(summary);
  if (!parts) return { key: 'canvas:other', label: 'Other Canvas events' };
  const label = parts.course.replace(/\s*\[\d{4}\]$/, '').trim();
  const code = MODULE_CODE.exec(parts.course)?.[1];
  return { key: code ?? `canvas:${label}`, label };
}
