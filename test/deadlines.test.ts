import { describe, expect, it } from 'vitest';
import type { UserRow } from '../src/lib/db';
import {
  cleanReminders, eventId, hashBody, reminderLabel, reminderTimes, REMINDERS, toGoogleEvent, type CalEvent,
} from '../src/lib/events';
import { toIcs } from '../src/lib/feed';
import { markDone, SYNC_VERSION, syncInputHash } from '../src/lib/sync';

const deadline: CalEvent = {
  key: 'canvas:event-assignment-1', kind: 'deadline', title: '[CS2040S] Problem Set 5',
  start: { dateTime: '2026-11-14T23:59:00+08:00' }, end: { dateTime: '2026-11-14T23:59:00+08:00' }, url: 'https://canvas.nus.edu.sg/x', color: '9',
};
const exam: CalEvent = {
  key: 'nusmods:exam:CS2040S', kind: 'exam', title: '[CS2040S] Final exam',
  start: { dateTime: '2026-11-25T09:00:00+08:00' }, end: { dateTime: '2026-11-25T11:00:00+08:00' },
};
const lecture: CalEvent = {
  key: 'nusmods:CS2040S:LEC:1:1', kind: 'class', title: '[CS2040S] Lecture',
  start: { dateTime: '2026-11-10T10:00:00+08:00' }, end: { dateTime: '2026-11-10T12:00:00+08:00' }, location: 'LT19', color: '9',
};

describe('someone who never picks reminder times or ticks anything off', () => {
  // Fingerprints of these events as Semsync wrote them before reminder times and ticks existed. The same fingerprint
  // means Google gets nothing new, so nobody's calendar changes.
  const BEFORE = {
    main: { deadline: 'e2908e025ca8bb614382a60988dcf533', exam: 'b09271c6b55bf275d91d2ce652408eaf', class: '301d2ea9789ff20ddd4c8cacd9716f0b' },
    feed: { deadline: '3a218895e48f7266b2ca62998c5821bc', exam: '3c7ccc53bee266649dbab7df1ad8daeb', class: '301d2ea9789ff20ddd4c8cacd9716f0b' },
  };

  it('keeps exactly the events they had', async () => {
    const usual = reminderTimes(null, null);
    for (const mode of ['main', 'feed'] as const) {
      for (const ev of [deadline, exam, lecture]) {
        const want = BEFORE[mode][ev.kind as 'deadline' | 'exam' | 'class'];
        expect(await hashBody(toGoogleEvent(ev, mode))).toBe(want);
        expect(await hashBody(toGoogleEvent(ev, mode, usual))).toBe(want);
      }
    }
    const ics = await toIcs([deadline, exam, lecture], { name: 'NUS semester', now: Date.UTC(2026, 10, 9), appUrl: 'https://semsync.live', reminders: usual });
    expect(await hashBody(ics as unknown as Record<string, unknown>)).toBe('6ba42f9bc7170f6d0223ec87f2b69a49');
  });

  it("keeps the sync's fingerprint too, so they get no extra sync", async () => {
    const user = {
      nusmods_link: 'x', nusmods_ay: '2026-2027', hidden_courses: '[]', week_labels: 1, mode: 'main', calendar_id: 'c', feed_token_hash: null,
      deadline_reminders: null, exam_reminders: null,
    } as UserRow;
    const canvas = [deadline];
    const before = await hashBody({
      v: SYNC_VERSION, canvas, nusmods: user.nusmods_link, ay: user.nusmods_ay, hidden: user.hidden_courses,
      weeks: user.week_labels, mode: user.mode, calendar: user.calendar_id, feed: false,
    });
    expect(await syncInputHash(user, canvas)).toBe(before);
    expect(await syncInputHash(user, canvas, new Set())).toBe(before);
    // Picking reminder times or ticking something off is a change the next run acts on, whatever order the ticks are in.
    expect(await syncInputHash({ ...user, deadline_reminders: '[4320]' }, canvas)).not.toBe(before);
    const ticked = await syncInputHash(user, canvas, new Set(['ssb', 'ssa']));
    expect(ticked).not.toBe(before);
    expect(await syncInputHash(user, canvas, new Set(['ssa', 'ssb']))).toBe(ticked);
  });
});

describe('a deadline ticked off as done', () => {
  it('turns grey, gets a tick in front and stops reminding, in Google Calendar and the subscribe link', async () => {
    const [done] = await markDone([deadline], new Set([await eventId(deadline.key)]));
    expect(done.done).toBe(true);
    const body = toGoogleEvent(done, 'main');
    expect(body.summary).toBe('✓ [CS2040S] Problem Set 5');
    expect(body.colorId).toBe('8');
    expect(body.reminders).toEqual({ useDefault: false, overrides: [] });

    const ics = await toIcs([done, exam], { name: 'NUS semester', now: 0, appUrl: 'https://semsync.live' });
    const [, doneBlock, examBlock] = ics.split('BEGIN:VEVENT');
    expect(doneBlock).toContain('SUMMARY:✓ [CS2040S] Problem Set 5');
    expect(doneBlock).not.toContain('VALARM');
    expect(examBlock).toContain('TRIGGER:-PT1440M');
  });

  it('only ever applies to deadlines', async () => {
    const ids = new Set([await eventId(exam.key), await eventId(lecture.key)]);
    expect((await markDone([exam, lecture], ids)).some((e) => e.done)).toBe(false);
  });
});

describe('reminder times', () => {
  it('reads what someone picked, and falls back to the usual times for anything unreadable', () => {
    expect(reminderTimes('[4320,60]', null)).toMatchObject({ deadline: [4320, 60], exam: REMINDERS.exam });
    expect(reminderTimes('[]', '[]')).toMatchObject({ deadline: [], exam: [] });
    expect(reminderTimes('not json', '{"a":1}')).toMatchObject({ deadline: REMINDERS.deadline, exam: REMINDERS.exam });
    // A time Settings doesn't offer is dropped rather than sent to Google.
    expect(reminderTimes('[4320,999999,4320]', null).deadline).toEqual([4320]);
    expect(cleanReminders('deadline', ['60', 10080, 'x'])).toEqual([10080, 60]);
  });

  it('go to Google and the subscribe link', async () => {
    const times = reminderTimes('[4320]', '[]');
    expect(toGoogleEvent(deadline, 'main', times).reminders).toEqual({ useDefault: false, overrides: [{ method: 'popup', minutes: 4320 }] });
    expect(toGoogleEvent(exam, 'main', times).reminders).toEqual({ useDefault: false, overrides: [] });
    // Classes keep following the calendar's own reminders.
    expect(toGoogleEvent(lecture, 'main', times).reminders).toEqual({ useDefault: true });
    const ics = await toIcs([deadline], { name: 'NUS semester', now: 0, appUrl: 'https://semsync.live', reminders: times });
    expect(ics.match(/TRIGGER:[^\r]+/g)).toEqual(['TRIGGER:-PT4320M']);
  });

  it('read as people say them', () => {
    expect([10080, 4320, 1440, 180, 60, 20160].map(reminderLabel)).toEqual(['1 week', '3 days', '1 day', '3 hours', '1 hour', '2 weeks']);
  });
});
