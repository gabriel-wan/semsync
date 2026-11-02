import { describe, expect, it } from 'vitest';
import { eventId, hashBody, startMs, toGoogleEvent, type CalEvent } from '../src/lib/events';

const deadline: CalEvent = {
  key: 'canvas:event-assignment-1',
  kind: 'deadline',
  title: '[CS2040] PS5',
  start: { dateTime: '2026-11-06T15:59:00Z' },
  end: { dateTime: '2026-11-06T15:59:00Z' },
  url: 'https://canvas.nus.edu.sg/courses/1/assignments/1',
  description: 'Due on Canvas.',
};

describe('eventId', () => {
  it('is a stable, valid Google Calendar event id', async () => {
    const id = await eventId(deadline.key);
    expect(id).toMatch(/^[0-9a-v]{32}$/);
    expect(await eventId(deadline.key)).toBe(id);
    expect(await eventId('canvas:event-assignment-2')).not.toBe(id);
  });
});

describe('toGoogleEvent', () => {
  it('marks deadlines as free time, colours them and tags them as ours', () => {
    expect(toGoogleEvent(deadline)).toEqual({
      summary: '[CS2040] PS5',
      description: 'Due on Canvas.\n\nhttps://canvas.nus.edu.sg/courses/1/assignments/1\n\nAdded by Semsync.',
      start: { dateTime: '2026-11-06T15:59:00Z', timeZone: 'Asia/Singapore' },
      end: { dateTime: '2026-11-06T15:59:00Z', timeZone: 'Asia/Singapore' },
      status: 'confirmed',
      transparency: 'transparent',
      colorId: '6',
      extendedProperties: { private: { semsync: '1', key: 'canvas:event-assignment-1' } },
      reminders: { useDefault: true },
    });
  });

  it('sets reminders in the user\'s own calendar only', () => {
    expect(toGoogleEvent(deadline, 'main').reminders).toEqual({
      useDefault: false,
      overrides: [{ method: 'popup', minutes: 1440 }, { method: 'popup', minutes: 180 }],
    });
    expect(toGoogleEvent({ ...deadline, kind: 'exam' }, 'main').reminders).toMatchObject({ overrides: [{ minutes: 10080 }, { minutes: 1440 }] });
    expect(toGoogleEvent({ ...deadline, kind: 'class' }, 'main').reminders).toEqual({ useDefault: true });
    expect(toGoogleEvent(deadline, 'shared').reminders).toEqual({ useDefault: true });
  });

  it('changes hash when the event changes', async () => {
    const a = await hashBody(toGoogleEvent(deadline));
    const b = await hashBody(toGoogleEvent({ ...deadline, title: '[CS2040] PS5 (extended)' }));
    expect(a).not.toBe(b);
  });
});

describe('startMs', () => {
  it('reads all-day dates as Singapore midnight', () => {
    expect(startMs({ date: '2026-11-08' })).toBe(Date.parse('2026-11-07T16:00:00Z'));
  });
});
