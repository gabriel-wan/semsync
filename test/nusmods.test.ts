import { describe, expect, it } from 'vitest';
import { termsOf, teachingWeekDate } from '../src/config';
import {
  chosenLessons,
  examEvent,
  lessonEvents,
  nusmodsEvents,
  parseNusmodsLink,
  type ModuleData,
} from '../src/lib/nusmods';
import CS2040 from './fixtures/CS2040.json';
import ES2660 from './fixtures/ES2660.json';

const [SEM1, SEM2] = termsOf(2026);
const modules: Record<string, ModuleData> = { CS2040: CS2040 as ModuleData, ES2660: ES2660 as ModuleData };
const fetcher = async (_ay: string, code: string) => modules[code] ?? null;
const cs2040Sem1 = modules.CS2040.semesterData.find((s) => s.semester === 1)!.timetable!;

describe('teachingWeekDate', () => {
  it('skips recess week between Weeks 6 and 7', () => {
    expect(teachingWeekDate(SEM1, 1, 0)).toBe('2026-08-10');
    expect(teachingWeekDate(SEM1, 6, 4)).toBe('2026-09-18');
    expect(teachingWeekDate(SEM1, 7, 0)).toBe('2026-09-28');
    expect(teachingWeekDate(SEM2, 7, 0)).toBe('2027-03-01');
    expect(teachingWeekDate(SEM2, 13, 0)).toBe('2027-04-12');
  });
});

describe('parseNusmodsLink', () => {
  it('reads v1 links', () => {
    const link = parseNusmodsLink('https://nusmods.com/timetable/sem-1/share?CS2040=LEC:1,TUT:05,LAB:2A&ES2660=SEC:G01');
    expect(link.semester).toBe(1);
    expect(link.modules[0]).toEqual({
      code: 'CS2040',
      lessons: [
        { lessonType: 'LEC', classNos: ['1'], indices: [] },
        { lessonType: 'TUT', classNos: ['05'], indices: [] },
        { lessonType: 'LAB', classNos: ['2A'], indices: [] },
      ],
    });
  });

  it('reads v2 index links and v3 detail links', () => {
    const v2 = parseNusmodsLink('https://nusmods.com/timetable/sem-2/share?CS2040=LEC:(0,1);TUT:(30)');
    expect(v2.semester).toBe(2);
    expect(v2.modules[0].lessons).toEqual([
      { lessonType: 'LEC', classNos: [], indices: [0, 1] },
      { lessonType: 'TUT', classNos: [], indices: [30] },
    ]);
    const v3 = parseNusmodsLink(
      'https://nusmods.com/timetable/sem-1/share?CS4243=LAB:(2|TUE|1600|1800|AS6-0421|3_4_5);LEC:1',
    );
    expect(v3.modules[0].lessons).toEqual([
      { lessonType: 'LAB', classNos: ['2'], indices: [] },
      { lessonType: 'LEC', classNos: ['1'], indices: [] },
    ]);
  });

  it('skips hidden courses and rejects other links', () => {
    const link = parseNusmodsLink('https://nusmods.com/timetable/sem-1/share?CS2040=LEC:1&ES2660=SEC:G01&hidden=ES2660');
    expect(link.modules.map((m) => m.code)).toEqual(['CS2040']);
    expect(() => parseNusmodsLink('https://example.com/timetable/sem-1/share?CS2040=LEC:1')).toThrow();
    expect(() => parseNusmodsLink('https://modsn.us/abc123')).toThrow(/shortened link/);
    expect(() => parseNusmodsLink('https://nusmods.com/timetable/st-i/share?CS2040=LEC:1')).toThrow();
    expect(() => parseNusmodsLink('https://nusmods.com/timetable/sem-1/share')).toThrow();
  });
});

describe('chosenLessons', () => {
  it('picks every session of the chosen class, by class number or by index', () => {
    const byClass = chosenLessons({ code: 'CS2040', lessons: [{ lessonType: 'LEC', classNos: ['1'], indices: [] }] }, cs2040Sem1);
    const lectureIndex = cs2040Sem1.findIndex((l) => l.lessonType === 'Lecture');
    const byIndex = chosenLessons({ code: 'CS2040', lessons: [{ lessonType: 'LEC', classNos: [], indices: [lectureIndex] }] }, cs2040Sem1);
    expect(byClass.length).toBe(cs2040Sem1.filter((l) => l.lessonType === 'Lecture' && l.classNo === '1').length);
    expect(byIndex).toEqual(byClass);
  });
});

describe('lessonEvents', () => {
  it('creates one event per teaching week in Singapore time, skipping holidays', () => {
    const lesson = { classNo: '1', lessonType: 'Lecture', day: 'Monday', startTime: '0900', endTime: '1000', venue: 'LT19', weeks: [1, 2, 13] };
    const events = lessonEvents('CS2040', [lesson], SEM1);
    // Mondays of Week 1 (National Day) and Week 13 (Deepavali) are holidays.
    expect(events.map((e) => e.start)).toEqual([{ dateTime: '2026-08-17T09:00:00+08:00' }]);
    expect(events[0]).toMatchObject({ title: 'CS2040 Lecture', location: 'LT19', kind: 'class' });
  });

  it('handles date-range lessons', () => {
    const lesson = {
      classNo: '01', lessonType: 'Tutorial', day: 'Wednesday', startTime: '1400', endTime: '1500',
      weeks: { start: '2027-01-11', end: '2027-02-05', weekInterval: 2 },
    };
    expect(lessonEvents('GEX1000', [lesson], SEM2).map((e) => e.start)).toEqual([
      { dateTime: '2027-01-13T14:00:00+08:00' },
      { dateTime: '2027-01-27T14:00:00+08:00' },
    ]);
  });
});

describe('examEvent', () => {
  it('uses the NUSMods exam date and duration', () => {
    const sem = modules.CS2040.semesterData.find((s) => s.semester === 1)!;
    expect(examEvent(modules.CS2040, sem, SEM1)).toMatchObject({
      kind: 'exam',
      title: 'CS2040 final exam',
      start: { dateTime: '2026-11-24T01:00:00Z' },
      end: { dateTime: '2026-11-24T03:00:00Z' },
    });
  });
});

describe('nusmodsEvents', () => {
  it('combines classes and exams, and warns about courses not offered', async () => {
    const link = parseNusmodsLink('https://nusmods.com/timetable/sem-1/share?CS2040=LEC:1&ES2660=SEC:G01&XX1234=LEC:1');
    const { events, warnings } = await nusmodsEvents(link, SEM1, fetcher);
    expect(events.some((e) => e.kind === 'exam' && e.title.startsWith('CS2040'))).toBe(true);
    expect(events.some((e) => e.title === 'ES2660 Sectional Teaching G01')).toBe(true);
    expect(events.some((e) => e.kind === 'exam' && e.title.startsWith('ES2660'))).toBe(false);
    expect(warnings).toEqual(["XX1234 isn't offered in AY2026/27 Semester 1, so it was skipped."]);
    expect(new Set(events.map((e) => e.key)).size).toBe(events.length);
  });
});
