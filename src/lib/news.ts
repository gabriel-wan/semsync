// The note about what's new on the Semsync page. For the next one, change the id (so everyone who closed this one sees
// it), the dates, and the note's words in NewsNote (src/views/pages.tsx).

/** Semsync 1.1: reminder times, and ticking deadlines off. */
export const NEWS = {
  id: '1.1',
  /** When it went live: only people who were here before then see it, since for anyone newer it's all new. */
  from: Date.parse('2026-11-09T17:25:00+08:00'),
  /** Two weeks on, it goes by itself. */
  until: Date.parse('2026-11-23T23:59:59+08:00'),
};

/** The cookie that remembers, in this browser, which note someone closed. */
export const NEWS_COOKIE = 'ss_news';

export function showNews(user: { created_at: number }, now: number, dismissed: boolean): boolean {
  return !dismissed && user.created_at < NEWS.from && now <= NEWS.until;
}
