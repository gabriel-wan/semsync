// A small iCalendar (.ics) reader: enough for Canvas feeds, cheap on CPU.
import { TZ_OFFSET } from '../config';
import type { CalTime } from './events';

export type IcsProp = { name: string; params: Record<string, string>; value: string };
/** Properties of one VEVENT, keyed by name (first occurrence wins). */
export type IcsEvent = Record<string, IcsProp>;

export function parseIcs(text: string): IcsEvent[] {
  const lines = text.replace(/\r\n?/g, '\n').replace(/\n[ \t]/g, '').split('\n');
  const events: IcsEvent[] = [];
  let current: IcsEvent | null = null;
  // Depth of components nested inside the VEVENT, such as VALARM.
  let nested = 0;

  for (const line of lines) {
    if (!line) continue;
    if (line === 'BEGIN:VEVENT') {
      current = {};
      nested = 0;
    } else if (!current) {
      continue;
    } else if (line === 'END:VEVENT') {
      events.push(current);
      current = null;
    } else if (line.startsWith('BEGIN:')) {
      nested++;
    } else if (line.startsWith('END:')) {
      nested--;
    } else if (nested === 0) {
      const prop = parseLine(line);
      if (prop && !(prop.name in current)) current[prop.name] = prop;
    }
  }
  return events;
}

function parseLine(line: string): IcsProp | null {
  let inQuotes = false;
  let colon = -1;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') inQuotes = !inQuotes;
    else if (ch === ':' && !inQuotes) {
      colon = i;
      break;
    }
  }
  if (colon < 0) return null;

  const [name, ...rawParams] = line.slice(0, colon).split(';');
  const params: Record<string, string> = {};
  for (const p of rawParams) {
    const eq = p.indexOf('=');
    if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, '');
  }
  return { name: name.toUpperCase(), params, value: line.slice(colon + 1) };
}

export function unescapeText(value: string): string {
  return value.replace(/\\([\\;,nN])/g, (_, ch: string) => (ch === 'n' || ch === 'N' ? '\n' : ch));
}

export function parseIcsTime(prop: IcsProp | undefined): CalTime | null {
  if (!prop) return null;
  const v = prop.value.trim();
  if (prop.params.VALUE === 'DATE' || /^\d{8}$/.test(v)) {
    return { date: `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}` };
  }
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/.exec(v);
  if (!m) return null;
  const [, y, mo, d, h, mi, s, utc] = m;
  const local = `${y}-${mo}-${d}T${h}:${mi}:${s}`;
  // Canvas writes UTC times; anything else is read as Singapore time.
  return { dateTime: utc ? `${local}Z` : `${local}${TZ_OFFSET}` };
}
