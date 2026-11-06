import { describe, expect, it } from 'vitest';
import { linkAcadYear, linkTerm, nextTerm, semesterWeek, termsOf, termWeeks } from '../src/config';
import type { UserRow } from '../src/lib/db';
import { BUILT_IN_NO_CLASS_DATES, noClassDates, parseMomHolidays, withObserved } from '../src/lib/holidays';
import { timetableNotice, timetableReminder } from '../src/lib/sync';
import type { Db } from '../src/lib/database';

const at = (date: string) => new Date(`${date}T04:00:00Z`); // noon in Singapore

describe('terms are worked out, not typed in', () => {
  it("gives the Registrar's AY2026/27 dates", () => {
    expect(termsOf(2026)).toEqual([
      { acadYear: '2026-2027', semester: 1, label: 'AY2026/27 Semester 1', week1: '2026-08-10', end: '2026-12-05' },
      { acadYear: '2026-2027', semester: 2, label: 'AY2026/27 Semester 2', week1: '2027-01-11', end: '2027-05-08' },
    ]);
  });

  it('carries on into the next academic years by the same rule (Week 0 on the first Monday of August)', () => {
    expect(termsOf(2027).map((t) => [t.label, t.week1, t.end])).toEqual([
      ['AY2027/28 Semester 1', '2027-08-09', '2027-12-04'],
      ['AY2027/28 Semester 2', '2028-01-10', '2028-05-06'],
    ]);
    // Every Week 1 is a Monday.
    for (let year = 2026; year < 2040; year++) {
      for (const t of termsOf(year)) expect(new Date(`${t.week1}T00:00:00Z`).getUTCDay()).toBe(1);
    }
  });

  it('knows the week next year without anyone adding dates', () => {
    expect(semesterWeek(at('2027-08-20'))).toEqual({ label: 'Week 2', detail: 'AY2027/28 Semester 1' });
    expect(semesterWeek(at('2027-12-20'))).toEqual({ label: 'Semester break', detail: 'AY2027/28 Semester 2 starts 10 Jan' });
  });

  it('labels the weeks of the term on now and the next one, not last year', () => {
    const june = termWeeks(at('2027-06-15')).map((w) => `${w.term.acadYear}:${w.term.semester}`);
    expect(new Set(june)).toEqual(new Set(['2027-2028:1']));
    const nov = termWeeks(at('2026-11-06')).map((w) => `${w.term.acadYear}:${w.term.semester}`);
    expect(new Set(nov)).toEqual(new Set(['2026-2027:1', '2026-2027:2']));
  });

  it('reads a NUSMods link as this academic year, moving on in June like NUSMods does', () => {
    expect(linkAcadYear(at('2026-11-06'))).toBe('2026-2027');
    expect(linkAcadYear(at('2027-03-01'))).toBe('2026-2027');
    expect(linkAcadYear(at('2027-06-15'))).toBe('2027-2028');
    expect(linkTerm(2, '2026-2027').week1).toBe('2027-01-11');
    expect(nextTerm(linkTerm(2, '2026-2027')).label).toBe('AY2027/28 Semester 1');
  });
});

describe('holidays', () => {
  it('adds the Monday after a holiday on a Sunday, which MOM leaves out', () => {
    // National Day 2026 and Deepavali 2026 fall on Sundays; Hari Raya Puasa 2026 on a Saturday moves nowhere.
    expect(withObserved(['2026-08-09', '2026-11-08', '2026-03-21'])).toEqual(['2026-03-21', '2026-08-09', '2026-08-10', '2026-11-08', '2026-11-09']);
    // Chinese New Year 2027 is Saturday and Sunday, so Monday is off.
    expect(BUILT_IN_NO_CLASS_DATES.has('2027-02-08')).toBe(true);
    expect(BUILT_IN_NO_CLASS_DATES.has('2026-10-09')).toBe(true); // NUS Well-Being Day
  });

  it("reads MOM's calendar file", () => {
    const ics = ['BEGIN:VCALENDAR', '', 'BEGIN:VEVENT', 'DTSTART;VALUE=DATE:20271225', 'SUMMARY:Christmas Day', 'END:VEVENT', '',
      'BEGIN:VEVENT', 'DTSTART;VALUE=DATE:20270809', 'SUMMARY:National Day', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    expect(parseMomHolidays(ics)).toEqual(['2027-08-09', '2027-12-25']);
  });

  it("falls back to the built-in dates when MOM can't be reached or hasn't published the year", async () => {
    const kv = new Map<string, string>();
    const db = {
      prepare: (sql: string) => ({
        bind: (...args: unknown[]) => ({
          first: async () => (sql.startsWith('SELECT') && kv.has(String(args[0])) ? { value: kv.get(String(args[0])) } : null),
          run: async () => { kv.set(String(args[0]), String(args[1])); },
        }),
      }),
    } as unknown as Db;
    const down = async () => { throw new Error('offline'); };
    const dates = await noClassDates(db, [2026], down);
    expect(dates.has('2026-08-10')).toBe(true);
    const later = await noClassDates(db, [2031], async () => ['2031-08-10']);
    expect(later.has('2031-08-11')).toBe(true); // 10 Aug 2031 is a Sunday
  });
});

describe('a new semester', () => {
  const user = {
    nusmods_link: 'https://nusmods.com/timetable/sem-1/share?CS2040=LEC:1', nusmods_ay: '2026-2027',
  } as UserRow;

  it('puts a reminder in the calendar two weeks before the next term, linking to Semsync', () => {
    expect(timetableReminder(user, 'https://semsync.live', at('2026-11-06'))).toMatchObject({
      kind: 'event',
      title: 'Add your new timetable to Semsync',
      start: { date: '2026-12-28' },
      end: { date: '2026-12-29' },
      url: 'https://semsync.live/setup?edit=1',
    });
    // Long after that term started, the page asks instead.
    expect(timetableReminder(user, 'x', at('2027-03-01'))).toBeNull();
  });

  it('asks on the Semsync page from three weeks before the next term', () => {
    expect(timetableNotice(user, at('2026-11-06'))).toBeNull();
    expect(timetableNotice(user, at('2026-12-25'))).toEqual({ saved: 'AY2026/27 Semester 1', wanted: 'AY2026/27 Semester 2' });
    // Months later it asks for whichever term is on.
    expect(timetableNotice(user, at('2027-09-01'))).toEqual({ saved: 'AY2026/27 Semester 1', wanted: 'AY2027/28 Semester 1' });
  });
});

describe('a first sync too big for one run', () => {
  it('says calmly what is still coming, and when', async () => {
    const { addingMessage, isAddingMessage } = await import('../src/lib/messages');
    expect(addingMessage(23)).toBe("Adding the last 23 events to your calendar. They'll be there within 20 minutes.");
    expect(addingMessage(1)).toBe("Adding one more event to your calendar. It'll be there within 20 minutes.");
    expect(isAddingMessage(addingMessage(23))).toBe(true);
    // Mixed with a real warning, it stays a warning.
    expect(isAddingMessage(`CS9999 isn't offered in AY2026/27 Semester 1, so it was skipped. ${addingMessage(3)}`)).toBe(false);
  });
});
