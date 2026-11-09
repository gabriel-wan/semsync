import { describe, expect, it } from 'vitest';
import type { UserRow } from '../src/lib/db';
import { Approve, Deadlines, Help, Home, Landing, Message, NotFound, Privacy, Settings, Setup, Terms } from '../src/views/pages';

const user: UserRow = {
  id: 'dev:a@example.com', email: 'a@example.com', name: 'A', canvas_feed_enc: 'x', nusmods_link: null, mode: 'main',
  calendar_id: 'primary', google_refresh_enc: 'x', needs_reconnect: 0, created_at: 0, last_sync_at: Date.now(),
  last_sync_ok: 1, last_sync_message: null, week_labels: 1, courses: '[]', hidden_courses: '[]', nusmods_ay: null, input_hash: null, full_sync_at: null, sync_claimed_at: null, feed_token_hash: null, feed_token_enc: null, deadline_reminders: null, exam_reminders: null,
};
const upcoming = [{ title: '[CS2040] Problem Set 5', kind: 'deadline' as const, start_ms: Date.now() + 86_400_000, all_day: 0 }];
const home = { csrf: 't', addUrl: null, counts: { deadline: 3 }, upcoming, dev: false };

/** Visible text of a rendered page: no tags, styles, scripts or attribute values. */
async function visibleText(node: unknown): Promise<string> {
  const html = String(await (node as { toString(): string | Promise<string> }).toString());
  return html
    .replace(/<(style|script)[\s\S]*?<\/\1>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&');
}

const PAGES: [string, unknown][] = [
  ['landing', Landing({ origin: 'https://semsync.example' })],
  ['setup, new', Setup({ user: { ...user, canvas_feed_enc: null }, csrf: 't', values: { canvas: '', nusmods: '' }, errors: {}, editing: false, dev: false })],
  ['setup, editing with errors', Setup({ user, csrf: 't', values: { canvas: 'x', nusmods: 'y' }, errors: { canvas: 'Bad link.', nusmods: 'Bad link.' }, editing: true, dev: false })],
  ['home, main', Home({ user, ...home, needsConnect: false })],
  ['home, with the note about what is new', Home({ user, ...home, needsConnect: false, news: true })],
  ['home, needs connect', Home({ user, ...home, needsConnect: true, upcoming: [] })],
  ['home, shared', Home({ user: { ...user, mode: 'shared' }, ...home, addUrl: 'https://calendar.google.com', needsConnect: false })],
  ['privacy', Privacy({})],
  ['help', Help({})],
  ['settings', Settings({ user, csrf: 't', counts: { deadline: 3 }, dev: false })],
  ['settings, subscribe link', Settings({ user: { ...user, mode: 'feed', deadline_reminders: '[4320]' }, csrf: 't', counts: {}, dev: false })],
  ['deadlines', Deadlines({ user, csrf: 't', deadlines: [
    { event_id: `ss${'a'.repeat(30)}`, title: '[CS2040] Problem Set 5', kind: 'deadline', start_ms: Date.now() + 3_600_000, all_day: 0, done: 1 },
    { event_id: `ss${'b'.repeat(30)}`, title: '[MA1521] Quiz 3', kind: 'deadline', start_ms: Date.now() + 9 * 86_400_000, all_day: 0, done: 0 },
    { event_id: `ss${'c'.repeat(30)}`, title: '[ES2660] Essay', kind: 'deadline', start_ms: Date.now() + 30 * 86_400_000, all_day: 1, done: 0 },
  ] })],
  ['deadlines, one module', Deadlines({ user, csrf: 't', m: 'MA1521', deadlines: [
    { event_id: `ss${'a'.repeat(30)}`, title: '[CS2040] Problem Set 5', kind: 'deadline', start_ms: Date.now() + 3_600_000, all_day: 0, done: 0 },
    { event_id: `ss${'b'.repeat(30)}`, title: '[MA1521] Quiz 3', kind: 'deadline', start_ms: Date.now() + 30 * 86_400_000, all_day: 0, done: 0 },
  ] })],
  ['deadlines, none', Deadlines({ user: { ...user, mode: 'feed' }, csrf: 't', deadlines: [] })],
  ['deadlines, search with no match', Deadlines({ user, csrf: 't', q: 'zzz', deadlines: [
    { event_id: `ss${'a'.repeat(30)}`, title: '[CS2040] Problem Set 5', kind: 'deadline', start_ms: Date.now() + 3_600_000, all_day: 0, done: 0 },
  ] })],
  ['settings, with AI assistants', Settings({
    user, csrf: 't', counts: { deadline: 3 }, dev: false, mcpUrl: 'https://semsync.example/mcp',
    apps: [
      { id: 'a', name: 'Claude', host: 'claude.ai', local: false, created_at: 0, last_used_at: null },
      { id: 'b', name: 'Cursor', host: 'localhost', local: true, created_at: 0, last_used_at: 1 },
    ],
  })],
  ['approval, hosted app', Approve({ user, csrf: 't', appName: 'Claude', host: 'claude.ai', local: false, setUp: true, fields: { client_id: 'x' } })],
  ['approval, app on this computer, not set up', Approve({ user, csrf: 't', appName: 'Cursor', host: 'localhost', local: true, setUp: false, fields: {} })],
  ['terms', Terms({})],
  ['home, sync failed', Home({ user: { ...user, last_sync_ok: 0, last_sync_message: "Couldn't sync just now." }, ...home, upcoming: [], needsConnect: false })],
  ['message', Message({ title: 'Your data is deleted', body: 'Gone.' })],
  ['not found', NotFound({})],
];

describe('copy rules from the design skills', () => {
  for (const [name, page] of PAGES) {
    it(`${name}: no hyphenated words`, async () => {
      const text = await visibleText(page);
      expect(text.match(/\b[A-Za-z]+-[A-Za-z]+\b/g) ?? []).toEqual([]);
    });

    it(`${name}: no banned filler words`, async () => {
      const text = (await visibleText(page)).toLowerCase();
      for (const banned of ['revolutionize', 'supercharge', 'cutting edge', 'effortless', 'world class', 'harness the power']) {
        expect(text).not.toContain(banned);
      }
    });
  }

  it('landing has exactly one call to action above the fold, and FAQ structured data', async () => {
    const html = String(await (Landing({}) as { toString(): string }).toString());
    const nav = /<nav[\s\S]*?<\/nav>/.exec(html)![0];
    const hero = /<header class="hero">[\s\S]*?<\/header>/.exec(html)![0];
    expect(nav).not.toContain('/auth/google');
    expect(hero.match(/href="\/auth\/google"/g)).toHaveLength(1);
    expect(html).toContain('"@type":"FAQPage"');
  });

  it('every page links to Privacy and Terms', async () => {
    for (const [, page] of PAGES) {
      const html = await visibleText(page);
      expect(html).toContain('Privacy');
      expect(html).toContain('Terms');
    }
  });

  it('hero heading has no periods', async () => {
    const html = String(await (Landing({}) as { toString(): string }).toString());
    const h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html)![1].replace(/<[^>]+>/g, '');
    expect(h1).not.toContain('.');
  });
});
