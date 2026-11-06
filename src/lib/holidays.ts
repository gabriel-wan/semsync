// Days with no classes: Singapore's public holidays, from the Ministry of Manpower's own calendar file for each year,
// plus NUS's own days off. Fetched once a month per year and kept in the kv table, so a new year's holidays arrive by
// themselves once MOM publishes them.
import { addDays } from '../config.js';
import type { Db } from './database.js';
import { fetchWithin } from './http.js';
import { parseIcs } from './ics.js';

const MOM_URL = (year: number) =>
  `https://www.mom.gov.sg/-/media/mom/documents/employment-practices/public-holidays/public-holidays-sg-${year}.ics`;

/** MOM's dates as published, for when its file can't be fetched. */
export const PUBLIC_HOLIDAYS_FALLBACK: Record<number, string[]> = {
  2026: ['2026-01-01', '2026-02-17', '2026-02-18', '2026-03-21', '2026-04-03', '2026-05-01', '2026-05-27', '2026-05-31', '2026-08-09', '2026-11-08', '2026-12-25'],
  2027: ['2027-01-01', '2027-02-06', '2027-02-07', '2027-03-10', '2027-03-26', '2027-05-01', '2027-05-17', '2027-05-20', '2027-08-09', '2027-10-28', '2027-12-25'],
};

/** NUS Well-Being Days: no classes, but not public holidays, so they're added here when NUS announces them. */
export const NUS_DAYS_OFF = ['2026-10-09', '2027-03-11'];

/** A holiday on a Sunday gives the Monday after it off, as Singapore's law says. MOM's file lists only the holiday. */
export function withObserved(dates: string[]): string[] {
  const all = new Set(dates);
  for (const date of dates) {
    if (new Date(`${date}T00:00:00Z`).getUTCDay() === 0) all.add(addDays(date, 1));
  }
  return [...all].sort();
}

/** The dates in MOM's .ics file, as YYYY-MM-DD. */
export function parseMomHolidays(ics: string): string[] {
  return parseIcs(ics)
    .map((e) => e.DTSTART?.value ?? '')
    .filter((v) => /^\d{8}$/.test(v))
    .map((v) => `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`)
    .sort();
}

export type HolidayFetcher = (year: number) => Promise<string[]>;

export const fetchMomHolidays: HolidayFetcher = async (year) => {
  const res = await fetchWithin(10_000, 'MOM public holidays', MOM_URL(year));
  if (!res.ok) throw new Error(`MOM public holidays ${year}: ${res.status}`);
  return parseMomHolidays(await res.text());
};

const DAY_MS = 24 * 3600_000;
// Within one run, every user's sync shares the same answer instead of reading the cache again.
const memo = new Map<number, { at: number; dates: Promise<string[]> }>();

async function holidaysFor(db: Db, year: number, fetchYear: HolidayFetcher): Promise<string[]> {
  const key = `holidays:${year}`;
  try {
    const row = await db.prepare('SELECT value FROM kv WHERE key = ? AND expires_at > ?').bind(key, Date.now()).first<{ value: string }>();
    if (row) return JSON.parse(row.value) as string[];
  } catch (err) {
    console.warn('holiday cache read failed', year, err instanceof Error ? err.message : err);
  }
  let dates: string[] = [];
  try {
    dates = await fetchYear(year);
  } catch (err) {
    console.warn('holidays fetch failed', year, err instanceof Error ? err.message : err);
  }
  // An empty answer usually means MOM hasn't published that year yet: ask again tomorrow rather than in a month.
  const found = dates.length > 0;
  if (!found) dates = PUBLIC_HOLIDAYS_FALLBACK[year] ?? [];
  try {
    await db
      .prepare('INSERT INTO kv (key, value, expires_at) VALUES (?, ?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value, expires_at = excluded.expires_at')
      .bind(key, JSON.stringify(dates), Date.now() + (found ? 30 : 1) * DAY_MS)
      .run();
  } catch (err) {
    console.warn('holiday cache write failed', year, err instanceof Error ? err.message : err);
  }
  return dates;
}

/** Every day without classes in these calendar years. Never throws: it falls back to the dates built in. */
export async function noClassDates(db: Db, years: number[], fetchYear: HolidayFetcher = fetchMomHolidays): Promise<Set<string>> {
  const lists = await Promise.all(
    [...new Set(years)].map((year) => {
      const hit = memo.get(year);
      if (hit && Date.now() - hit.at < 15 * 60_000 && fetchYear === fetchMomHolidays) return hit.dates;
      const dates = holidaysFor(db, year, fetchYear);
      if (fetchYear === fetchMomHolidays) memo.set(year, { at: Date.now(), dates });
      return dates;
    }),
  );
  return new Set([...withObserved(lists.flat()), ...NUS_DAYS_OFF]);
}

/** The built-in dates alone, for code that has no database to hand (and tests). */
export const BUILT_IN_NO_CLASS_DATES = new Set([
  ...withObserved(Object.values(PUBLIC_HOLIDAYS_FALLBACK).flat()),
  ...NUS_DAYS_OFF,
]);
