export type Term = {
  acadYear: string;
  semester: 1 | 2;
  label: string;
  /** Monday of Week 1. */
  week1: string;
  /** Last day of the exam period. */
  end: string;
};

// From the NUS Registrar's AY2026/27 academic calendar (version dated 30/07/2026).
// Add the next academic year here once the Registrar publishes it.
export const TERMS: Term[] = [
  { acadYear: '2026-2027', semester: 1, label: 'AY2026/27 Semester 1', week1: '2026-08-10', end: '2026-12-05' },
  { acadYear: '2026-2027', semester: 2, label: 'AY2026/27 Semester 2', week1: '2027-01-11', end: '2027-05-08' },
];

// University holidays (observed dates) with no classes.
export const NO_CLASS_DATES = new Set([
  '2026-08-10', // National Day, observed
  '2026-10-09', // NUS Well-Being Day
  '2026-11-09', // Deepavali, observed
  '2027-02-08', // Chinese New Year, observed
  '2027-03-10', // Hari Raya Puasa
  '2027-03-11', // NUS Well-Being Day
  '2027-03-26', // Good Friday
]);

/**
 * A real quote from a real user, for the landing page's proof slot. Leave it null until you have one and their
 * permission; never invent it. While it's null, the slot shows what Semsync works with instead.
 */
export const TESTIMONIAL: { quote: string; name: string; detail: string } | null = null;

export const TIME_ZONE = 'Asia/Singapore';
export const TZ_OFFSET = '+08:00';

/** The current or next term for a semester number, by date. */
export function findTerm(semester: number, now = new Date()): Term | undefined {
  const today = now.toISOString().slice(0, 10);
  const matching = TERMS.filter((t) => t.semester === semester);
  return matching.find((t) => t.end >= today) ?? matching[matching.length - 1];
}

/** Date (YYYY-MM-DD) of a weekday in a teaching week. Recess week sits between Weeks 6 and 7. */
/** The name of the week that starts `i` weeks after Week 1's Monday: Weeks 1 to 6, recess, 7 to 13, reading, exams. */
export function weekName(i: number): string {
  return i < 6 ? `Week ${i + 1}` : i === 6 ? 'Recess week' : i < 14 ? `Week ${i}` : i === 14 ? 'Reading week' : 'Exams';
}

/** Every Monday of every term, with its week's name: for the week labels in the calendar. */
export function termWeeks(): { term: Term; index: number; monday: string; name: string }[] {
  return TERMS.flatMap((term) => {
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
  const today = new Date(now.getTime() + 8 * 3600_000).toISOString().slice(0, 10); // the date in Singapore
  for (const term of TERMS) {
    if (today < term.week1 || today > term.end) continue;
    const i = Math.floor((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${term.week1}T00:00:00Z`)) / (7 * 86_400_000));
    return { label: weekName(i), detail: term.label };
  }
  const next = TERMS.find((t) => t.week1 > today);
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
