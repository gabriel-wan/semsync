export type Term = {
  acadYear: string;
  semester: 1 | 2;
  label: string;
  /** Monday of Week 1. */
  week1: string;
  /** Last day of the exam period. */
  end: string;
};

/**
 * NUS terms are worked out, not typed in, so Semsync carries on into the next academic year by itself. The rule is the
 * one NUSMods uses: an academic year's Week 0 starts on the first Monday of August, Semester 1's Week 1 a week later,
 * and Semester 2's Week 1 22 weeks after that. A semester is 17 weeks (Weeks 1 to 6, recess, Weeks 7 to 13, reading
 * week, two weeks of exams) and ends on its last Saturday. This gives exactly the Registrar's AY2026/27 dates.
 */
export function termsOf(startYear: number): Term[] {
  const week0 = firstMonday(startYear, 8);
  const label = `AY${startYear}/${String((startYear + 1) % 100).padStart(2, '0')}`;
  const acadYear = `${startYear}-${startYear + 1}`;
  return ([1, 2] as const).map((semester) => {
    const week1 = addDays(week0, semester === 1 ? 7 : 7 + 22 * 7);
    return { acadYear, semester, label: `${label} Semester ${semester}`, week1, end: addDays(week1, 17 * 7 - 2) };
  });
}

/** The first Monday of a month (1 to 12), as YYYY-MM-DD. */
function firstMonday(year: number, month: number): string {
  const first = new Date(Date.UTC(year, month - 1, 1));
  return addDays(first.toISOString().slice(0, 10), (8 - first.getUTCDay()) % 7);
}

/** The date in Singapore, as YYYY-MM-DD. */
export const sgDate = (now = new Date()) => new Date(now.getTime() + 8 * 3600_000).toISOString().slice(0, 10);

/** The first year of the academic year a day is in: from Week 0 in August to the next one. */
export function acadYearOf(now = new Date()): number {
  const year = Number(sgDate(now).slice(0, 4));
  return sgDate(now) >= firstMonday(year, 8) ? year : year - 1;
}

/** Last, this and next academic year's terms: enough for any date Semsync needs to place. */
export function termsAround(now = new Date()): Term[] {
  const year = acadYearOf(now);
  return [year - 1, year, year + 1].flatMap(termsOf);
}

/** The academic year a NUSMods link means when it's saved: NUSMods moves on to the next one in June. */
export function linkAcadYear(now = new Date()): string {
  const [year, month] = sgDate(now).split('-').map(Number);
  const start = month >= 6 ? year : year - 1;
  return `${start}-${start + 1}`;
}

/** The term a saved NUSMods link is for. */
export function linkTerm(semester: 1 | 2, acadYear: string): Term {
  return termsOf(Number(acadYear.slice(0, 4))).find((t) => t.semester === semester)!;
}

/** The term after this one. */
export function nextTerm(term: Term): Term {
  const year = Number(term.acadYear.slice(0, 4));
  return term.semester === 1 ? termsOf(year)[1] : termsOf(year + 1)[0];
}

/**
 * A real quote from a real user, for the landing page's proof slot. Leave it null until you have one and their
 * permission; never invent it. While it's null, the slot shows what Semsync works with instead.
 */
export const TESTIMONIAL: { quote: string; name: string; detail: string } | null = null;

export const TIME_ZONE = 'Asia/Singapore';
export const TZ_OFFSET = '+08:00';

/** Date (YYYY-MM-DD) of a weekday in a teaching week. Recess week sits between Weeks 6 and 7. */
/** The name of the week that starts `i` weeks after Week 1's Monday: Weeks 1 to 6, recess, 7 to 13, reading, exams. */
export function weekName(i: number): string {
  return i < 6 ? `Week ${i + 1}` : i === 6 ? 'Recess week' : i < 14 ? `Week ${i}` : i === 14 ? 'Reading week' : 'Exams';
}

/**
 * Every Monday of the terms that matter now, with each week's name, for the week labels in the calendar: the term
 * that's on (or just ended) and the next one once it's within about six months. Older weeks stay in calendars as they are.
 */
export function termWeeks(now = new Date()): { term: Term; index: number; monday: string; name: string }[] {
  const today = sgDate(now);
  const soon = addDays(today, 200);
  return termsAround(now).filter((t) => t.end >= addDays(today, -7) && t.week1 <= soon).flatMap((term) => {
    const weeks = [];
    for (let i = 0; addDays(term.week1, i * 7) <= term.end; i++) {
      weeks.push({ term, index: i, monday: addDays(term.week1, i * 7), name: weekName(i) });
    }
    return weeks;
  });
}

/**
 * Where a day falls in the NUS calendar, for the top of the Semsync page: "Week 12", "Recess week", "Reading week",
 * "Exams", or between semesters, when the next one starts.
 */
export function semesterWeek(now = new Date()): { label: string; detail: string } {
  const today = sgDate(now);
  const terms = termsAround(now);
  for (const term of terms) {
    if (today < term.week1 || today > term.end) continue;
    const i = Math.floor((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${term.week1}T00:00:00Z`)) / (7 * 86_400_000));
    return { label: weekName(i), detail: term.label };
  }
  const next = terms.find((t) => t.week1 > today);
  const starts = next && new Date(`${next.week1}T00:00:00Z`).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  return { label: 'Semester break', detail: next ? `${next.label} starts ${starts}` : 'Your NUS semester' };
}

export function teachingWeekDate(term: Term, week: number, dayOffset: number): string {
  const weeksAfterWeek1 = week <= 6 ? week - 1 : week;
  return addDays(term.week1, weeksAfterWeek1 * 7 + dayOffset);
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
