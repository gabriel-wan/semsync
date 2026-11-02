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
export function teachingWeekDate(term: Term, week: number, dayOffset: number): string {
  const weeksAfterWeek1 = week <= 6 ? week - 1 : week;
  return addDays(term.week1, weeksAfterWeek1 * 7 + dayOffset);
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
