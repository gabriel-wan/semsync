import { NO_CLASS_DATES, addDays, teachingWeekDate, TZ_OFFSET, type Term } from '../config';
import { UserError } from './errors';
import type { CalEvent } from './events';

export type LessonChoice = { lessonType: string; classNos: string[]; indices: number[] };
export type ModuleChoice = { code: string; lessons: LessonChoice[] };
export type NusmodsLink = { semester: 1 | 2; modules: ModuleChoice[] };

type WeekRange = { start: string; end: string; weekInterval?: number; weeks?: number[] };
export type Lesson = {
  classNo: string;
  lessonType: string;
  day: string;
  startTime: string;
  endTime: string;
  venue?: string;
  weeks: number[] | WeekRange;
};
export type SemesterData = { semester: number; timetable?: Lesson[]; examDate?: string; examDuration?: number };
export type ModuleData = { moduleCode: string; title: string; semesterData: SemesterData[] };
export type ModuleFetcher = (acadYear: string, code: string) => Promise<ModuleData | null>;

// Mirrors NUSMods' LESSON_TYPE_ABBREV, used in share links.
const LESSON_TYPE_ABBREV: Record<string, string> = {
  'Design Lecture': 'DLEC',
  Laboratory: 'LAB',
  Lecture: 'LEC',
  'Packaged Laboratory': 'PLAB',
  'Packaged Lecture': 'PLEC',
  'Packaged Tutorial': 'PTUT',
  Recitation: 'REC',
  'Sectional Teaching': 'SEC',
  'Seminar-Style Module Class': 'SEM',
  Tutorial: 'TUT',
  'Tutorial Type 2': 'TUT2',
  'Tutorial Type 3': 'TUT3',
  Workshop: 'WS',
};

const DAY_OFFSET: Record<string, number> = {
  Monday: 0,
  Tuesday: 1,
  Wednesday: 2,
  Thursday: 3,
  Friday: 4,
  Saturday: 5,
  Sunday: 6,
};

const MODULE_CODE = /^[A-Z]{2,4}\d{4}[A-Z]{0,3}$/;

/**
 * Reads a NUSMods share link. Handles all three formats NUSMods has used:
 *   v1  CS2040=LEC:1,TUT:05
 *   v2  CS2040=LEC:(0,1);TUT:(30)        (indices into the module's timetable)
 *   v3  CS2040=LEC:(1|THU|0900|...);TUT:05 (lesson details, or plain class numbers)
 */
export function parseNusmodsLink(raw: string): NusmodsLink {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new UserError("That doesn't look like a NUSMods link. In NUSMods, use Share/Sync and copy the link.");
  }
  if (!/^(www\.)?nusmods\.com$/.test(url.hostname)) {
    throw new UserError('Use a share link from nusmods.com.');
  }
  const sem = /\/timetable\/sem-([12])\/share/.exec(url.pathname);
  if (!sem) {
    throw new UserError('Use the Share/Sync link from your Semester 1 or Semester 2 timetable on NUSMods.');
  }

  const hidden = new Set((url.searchParams.get('hidden') ?? '').split(',').filter(Boolean));
  const modules: ModuleChoice[] = [];
  for (const [key, value] of url.searchParams) {
    const code = key.toUpperCase();
    if (!MODULE_CODE.test(code) || hidden.has(code)) continue;
    modules.push({ code, lessons: parseLessonConfig(value) });
  }
  if (modules.length === 0) throw new UserError("That NUSMods link doesn't have any courses in it.");
  return { semester: Number(sem[1]) as 1 | 2, modules };
}

function parseLessonConfig(value: string): LessonChoice[] {
  const parts = value.includes(';') ? value.split(';') : value.includes('(') ? [value] : value.split(',');
  const byType = new Map<string, LessonChoice>();
  for (const part of parts) {
    const m = /^([A-Z0-9]+):(.*)$/i.exec(part.trim());
    if (!m) continue;
    const lessonType = m[1].toUpperCase();
    const choice = byType.get(lessonType) ?? { lessonType, classNos: [], indices: [] };
    byType.set(lessonType, choice);

    const wrapped = /^\((.*)\)$/.exec(m[2]);
    if (!wrapped) {
      if (m[2]) choice.classNos.push(m[2]);
      continue;
    }
    for (const item of wrapped[1].split(',')) {
      if (/^\d+$/.test(item)) choice.indices.push(Number(item));
      else if (item.includes('|')) choice.classNos.push(item.split('|')[0]);
    }
  }
  return [...byType.values()];
}

function abbrev(lessonType: string): string {
  return LESSON_TYPE_ABBREV[lessonType] ?? lessonType.slice(0, 3).toUpperCase();
}

/** The lessons a module choice refers to, in that module's timetable. */
export function chosenLessons(choice: ModuleChoice, timetable: Lesson[]): Lesson[] {
  const picked: Lesson[] = [];
  for (const lc of choice.lessons) {
    const classNos = new Set(lc.classNos);
    for (const i of lc.indices) {
      const lesson = timetable[i];
      if (lesson && abbrev(lesson.lessonType) === lc.lessonType) classNos.add(lesson.classNo);
    }
    for (const lesson of timetable) {
      if (abbrev(lesson.lessonType) === lc.lessonType && classNos.has(lesson.classNo)) picked.push(lesson);
    }
  }
  return picked;
}

function lessonDates(lesson: Lesson, term: Term): string[] {
  const offset = DAY_OFFSET[lesson.day];
  if (offset === undefined) return [];
  if (Array.isArray(lesson.weeks)) return lesson.weeks.map((w) => teachingWeekDate(term, w, offset));

  // Some courses list explicit date ranges instead of teaching weeks.
  const { start, end, weekInterval = 1, weeks } = lesson.weeks;
  const startDay = new Date(`${start}T00:00:00Z`).getUTCDay();
  const monday = addDays(start, -((startDay + 6) % 7));
  const dates: string[] = [];
  for (let w = 0; w < 60; w++) {
    const date = addDays(monday, w * 7 + offset);
    if (date > end) break;
    if (date < start) continue;
    if (weeks ? weeks.includes(w + 1) : w % weekInterval === 0) dates.push(date);
  }
  return dates;
}

function hhmm(time: string): string {
  return `${time.slice(0, 2)}:${time.slice(2, 4)}:00`;
}

export function lessonEvents(code: string, lessons: Lesson[], term: Term): CalEvent[] {
  const events: CalEvent[] = [];
  for (const lesson of lessons) {
    const label = lesson.lessonType === 'Lecture' ? 'Lecture' : `${lesson.lessonType} ${lesson.classNo}`;
    for (const date of lessonDates(lesson, term)) {
      if (NO_CLASS_DATES.has(date)) continue;
      events.push({
        key: `nusmods:${term.acadYear}:${term.semester}:${code}:${abbrev(lesson.lessonType)}:${lesson.classNo}:${date}:${lesson.startTime}`,
        kind: 'class',
        title: `${code} ${label}`,
        start: { dateTime: `${date}T${hhmm(lesson.startTime)}${TZ_OFFSET}` },
        end: { dateTime: `${date}T${hhmm(lesson.endTime)}${TZ_OFFSET}` },
        location: lesson.venue || undefined,
      });
    }
  }
  return events;
}

export function examEvent(module: ModuleData, sem: SemesterData, term: Term): CalEvent | null {
  if (!sem.examDate) return null;
  const start = new Date(sem.examDate);
  if (Number.isNaN(start.getTime())) return null;
  const end = new Date(start.getTime() + (sem.examDuration ?? 120) * 60_000);
  const iso = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, 'Z');
  return {
    key: `nusmods:${term.acadYear}:${term.semester}:${module.moduleCode}:exam`,
    kind: 'exam',
    title: `${module.moduleCode} final exam`,
    start: { dateTime: iso(start) },
    end: { dateTime: iso(end) },
    description: `${module.title}. Check your venue and seat on the NUS exam timetable closer to the date.`,
  };
}

export async function nusmodsEvents(
  link: NusmodsLink,
  term: Term,
  fetchModule: ModuleFetcher,
): Promise<{ events: CalEvent[]; warnings: string[] }> {
  const events: CalEvent[] = [];
  const warnings: string[] = [];
  const modules = await Promise.all(link.modules.map((m) => fetchModule(term.acadYear, m.code)));

  link.modules.forEach((choice, i) => {
    const module = modules[i];
    const sem = module?.semesterData.find((s) => s.semester === term.semester);
    if (!module || !sem) {
      warnings.push(`${choice.code} isn't offered in ${term.label}, so it was skipped.`);
      return;
    }
    events.push(...lessonEvents(choice.code, chosenLessons(choice, sem.timetable ?? []), term));
    const exam = examEvent(module, sem, term);
    if (exam) events.push(exam);
  });
  return { events, warnings };
}

export async function fetchModuleFromApi(acadYear: string, code: string): Promise<ModuleData | null> {
  const res = await fetch(`https://api.nusmods.com/v2/${acadYear}/modules/${encodeURIComponent(code)}.json`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`NUSMods returned ${res.status} for ${code}`);
  return res.json();
}
