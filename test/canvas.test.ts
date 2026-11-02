import { describe, expect, it } from 'vitest';
import { canvasEvents, formatTitle, validateCanvasFeedUrl } from '../src/lib/canvas';
import { parseIcs, unescapeText } from '../src/lib/ics';
import { SAMPLE_CANVAS_FEED } from '../src/fixtures/sampleCanvas';

const HOSTS = ['canvas.nus.edu.sg'];

describe('parseIcs', () => {
  it('unfolds lines, unescapes text and ignores nested alarms', () => {
    const [first] = parseIcs(SAMPLE_CANVAS_FEED);
    expect(unescapeText(first.DESCRIPTION.value)).toBe('Submit your solutions as a single PDF, named with your matric number.');
    expect(first.SUMMARY.value).toBe('Problem Set 5 [CS2040 Data Structures and Algorithms [2610]]');
    expect(first.URL.params.VALUE).toBe('URI');
  });
});

describe('validateCanvasFeedUrl', () => {
  it('accepts NUS Canvas feed links, including webcal ones', () => {
    expect(validateCanvasFeedUrl(' webcal://canvas.nus.edu.sg/feeds/calendars/user_abc123.ics ', HOSTS)).toBe(
      'https://canvas.nus.edu.sg/feeds/calendars/user_abc123.ics',
    );
    expect(validateCanvasFeedUrl('https://school.instructure.com/feeds/calendars/user_x.ics', HOSTS)).toContain('instructure.com');
  });

  it('rejects other hosts, plain http and non-feed Canvas pages', () => {
    expect(() => validateCanvasFeedUrl('https://evil.example.com/feeds/calendars/user_x.ics', HOSTS)).toThrow();
    expect(() => validateCanvasFeedUrl('http://canvas.nus.edu.sg/feeds/calendars/user_x.ics', HOSTS)).toThrow();
    expect(() => validateCanvasFeedUrl('https://canvas.nus.edu.sg/calendar', HOSTS)).toThrow(/calendar feed/);
    expect(() => validateCanvasFeedUrl('not a link', HOSTS)).toThrow();
  });
});

describe('formatTitle', () => {
  it('moves the module code to the front', () => {
    expect(formatTitle('Problem Set 5 [CS2040 Data Structures and Algorithms [2610]]')).toBe('[CS2040] Problem Set 5');
    expect(formatTitle('Reflection [Part 2] [UTC2402 Thinking with Images]')).toBe('[UTC2402] Reflection [Part 2]');
  });

  it('keeps the course name when there is no module code, and leaves other titles alone', () => {
    expect(formatTitle('Quiz 1 [Orientation Course]')).toBe('[Orientation Course] Quiz 1');
    expect(formatTitle('Office hours')).toBe('Office hours');
    expect(formatTitle('[CS2040]')).toBe('[CS2040]');
  });
});

describe('canvasEvents', () => {
  const events = canvasEvents(SAMPLE_CANVAS_FEED);

  it('turns assignments into deadlines at the due time', () => {
    const ps5 = events.find((e) => e.key === 'canvas:event-assignment-512341')!;
    expect(ps5).toMatchObject({
      kind: 'deadline',
      title: '[CS2040] Problem Set 5',
      start: { dateTime: '2026-11-06T15:59:00Z' },
      end: { dateTime: '2026-11-06T15:59:00Z' },
      url: 'https://canvas.nus.edu.sg/courses/81234/assignments/512341',
    });
  });

  it('keeps all-day deadlines and timed calendar events', () => {
    expect(events.find((e) => e.key.endsWith('512399'))?.start).toEqual({ date: '2026-11-08' });
    expect(events.find((e) => e.key.endsWith('90210'))).toMatchObject({
      kind: 'event',
      location: 'LT19',
      end: { dateTime: '2026-11-10T07:30:00Z' },
    });
  });

  it('returns one event per Canvas item', () => {
    expect(events).toHaveLength(4);
  });
});
