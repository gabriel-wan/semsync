import { describe, expect, it } from 'vitest';
import { courseOf } from '../src/lib/canvas';
import { toGoogleEvent, type CalEvent } from '../src/lib/events';
import { applyCourses, weekLabelEvents } from '../src/lib/sync';
import type { UserRow } from '../src/lib/db';
import { Settings } from '../src/views/pages';

const ev = (key: string, kind: CalEvent['kind'], course?: string): CalEvent => ({
  key, kind, title: key, course, courseLabel: course && `${course} name`, start: { date: '2026-11-06' }, end: { date: '2026-11-06' },
});

describe('courses', () => {
  it('keys a Canvas item by its module code, or by course name when there is none', () => {
    expect(courseOf('Problem Set 5 [CS2040 Data Structures and Algorithms [2610]]')).toEqual({ key: 'CS2040', label: 'CS2040 Data Structures and Algorithms', aliases: [] });
    expect(courseOf('Quiz 1 [Orientation Course]')).toEqual({ key: 'canvas:Orientation Course', label: 'Orientation Course', aliases: [] });
    expect(courseOf('Deepavali')).toEqual({ key: 'canvas:other', label: 'Other Canvas events', aliases: [] });
    expect(courseOf('Essay 2 [UTS2402/UTC2402 Senior Seminar [2610]]')).toEqual({ key: 'UTS2402', label: 'UTS2402/UTC2402 Senior Seminar', aliases: ['UTC2402'] });
  });

  it('drops switched off courses, lists every course, and colours modules but not exams', () => {
    const { events, courses } = applyCourses(
      [ev('a', 'deadline', 'CS2040'), ev('b', 'class', 'MA1521'), ev('c', 'exam', 'CS2040'), ev('d', 'event', 'canvas:other'), ev('e', 'class', 'ST2334')],
      new Set(['ST2334']),
    );
    expect(courses.map((c) => c.key)).toEqual(['CS2040', 'MA1521', 'ST2334', 'canvas:other']);
    expect(events.map((e) => e.key)).toEqual(['a', 'b', 'c', 'd']);
    const colour = Object.fromEntries(events.map((e) => [e.key, e.color]));
    expect(colour.a).toBeDefined();
    expect(colour.b).toBeDefined();
    expect(colour.a).not.toBe(colour.b);
    expect(colour.c).toBeUndefined(); // exams keep their red
    expect(colour.d).toBeUndefined(); // no module, no module colour
    expect(toGoogleEvent(events[2]).colorId).toBe('11');
  });

  it("doesn't colour a shared calendar's events, since Google wouldn't show it", () => {
    const { events } = applyCourses([ev('a', 'class', 'CS2040')], new Set(), false);
    expect(events[0].color).toBeUndefined();
  });

  it('lists a cross-listed Canvas course once, under the code the NUSMods link uses, with the NUSMods name', () => {
    const canvas: CalEvent = { ...ev('canvas:1', 'deadline', 'UTS2402'), title: '[UTS2402] Essay 2', courseLabel: 'UTS2402/UTC2402', courseAliases: ['UTC2402'] };
    const seminar: CalEvent = { ...ev('nusmods:x', 'class', 'UTC2402'), courseLabel: 'UTC2402 Environment and Civil Society in Singapore' };
    const { events, courses } = applyCourses([canvas, seminar, { ...ev('canvas:2', 'deadline', 'CS2101'), courseLabel: 'CS2101' }], new Set(), false);
    expect(courses).toEqual([
      { key: 'CS2101', label: 'CS2101' },
      { key: 'UTC2402', label: 'UTC2402 Environment and Civil Society in Singapore' },
    ]);
    expect(events[0]).toMatchObject({ course: 'UTC2402', title: '[UTC2402] Essay 2' });
  });

  it('keeps a module the same colour whether or not others are switched off', () => {
    const all = [ev('a', 'class', 'CS2040'), ev('b', 'class', 'MA1521')];
    const shown = applyCourses(all, new Set()).events.find((e) => e.key === 'b')!.color;
    const withHidden = applyCourses(all, new Set(['CS2040'])).events.find((e) => e.key === 'b')!.color;
    expect(withHidden).toBe(shown);
  });
});

describe('week labels', () => {
  it('labels every Monday of every term, counting recess and reading week', () => {
    const sem1 = weekLabelEvents(new Date('2026-11-04T04:00:00Z')).filter((e) => e.key.startsWith('week:2026-2027:1:'));
    expect(sem1.map((e) => e.title)).toEqual([
      'Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5', 'Week 6', 'Recess week', 'Week 7', 'Week 8', 'Week 9', 'Week 10',
      'Week 11', 'Week 12', 'Week 13', 'Reading week', 'Exams', 'Exams',
    ]);
    expect(sem1[11].start).toEqual({ date: '2026-10-26' });
    expect(sem1[12].start).toEqual({ date: '2026-11-02' });
  });

  it('are all day, free, grey, and never remind anyone', () => {
    const body = toGoogleEvent(weekLabelEvents(new Date('2026-11-04T04:00:00Z'))[0], 'main');
    expect(body).toMatchObject({ transparency: 'transparent', colorId: '8', reminders: { useDefault: false, overrides: [] } });
  });
});

describe('the course tiles on the Settings page', () => {
  const user: UserRow = {
    id: 'dev:a@example.com', email: 'a@example.com', name: 'A', canvas_feed_enc: 'x', nusmods_link: null, mode: 'main', calendar_id: 'primary',
    google_refresh_enc: 'x', needs_reconnect: 0, created_at: 0, last_sync_at: Date.now(), last_sync_ok: 1, last_sync_message: null,
    week_labels: 0, hidden_courses: '["MA1521"]', nusmods_ay: null, input_hash: null, full_sync_at: null, sync_claimed_at: null, feed_token_hash: null, feed_token_enc: null, deadline_reminders: null, exam_reminders: null,
    courses: JSON.stringify([{ key: 'CS2040', label: 'CS2040 Data Structures and Algorithms' }, { key: 'MA1521', label: 'MA1521 Calculus for Computing' }]),
  };
  const page = async (u: UserRow) =>
    String(await (Settings({ user: u, csrf: 't', counts: {}, dev: false }) as unknown as { toString(): Promise<string> }).toString());

  it('shows a switch per course, off for the hidden ones, and the week labels switch', async () => {
    const html = await page(user);
    expect(html).toMatch(/action="\/courses"/);
    expect(html).toMatch(/class="course-tile"><input type="checkbox" name="show" value="CS2040" checked=""/);
    expect(html).toMatch(/name="show" value="MA1521"(?! checked)/);
    expect(html).toMatch(/name="weeks" value="1"(?! checked)/);
    expect(html).toContain('<span class="caption-2 text-secondary tile-name">Data Structures and Algorithms</span>');
  });

  it('shows module colours only where Google shows them, in your own calendar', async () => {
    expect(await page(user)).toContain('class="course-dot"');
    expect(await page({ ...user, mode: 'shared' })).not.toContain('class="course-dot"');
  });
});

describe('the NUSMods cache', () => {
  it('fetches from NUSMods when the database cannot be read or written, instead of failing the sync', async () => {
    const { cachedModuleFetcher } = await import('../src/lib/db');
    const broken = { prepare: () => ({ bind: () => ({ first: () => Promise.reject(new Error('stuck')), run: () => Promise.reject(new Error('stuck')) }) }) };
    const module = { moduleCode: 'CS2040', title: 'Data Structures', semesterData: [] };
    const fetch = cachedModuleFetcher(broken as never, async () => module);
    await expect(fetch('2026-2027', 'CS2040')).resolves.toEqual(module);
  });
});
