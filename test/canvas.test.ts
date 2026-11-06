import { describe, expect, it, vi } from 'vitest';
import { canvasEvents, fetchCanvasFeed, formatTitle, validateCanvasFeedUrl } from '../src/lib/canvas';
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
    expect(validateCanvasFeedUrl('https://canvas.nus.edu.sg:443/feeds/calendars/user_x.ics', HOSTS)).toBe(
      'https://canvas.nus.edu.sg/feeds/calendars/user_x.ics',
    );
  });

  it('rejects other hosts, plain http and non-feed Canvas pages', () => {
    expect(() => validateCanvasFeedUrl('https://evil.example.com/feeds/calendars/user_x.ics', HOSTS)).toThrow();
    expect(() => validateCanvasFeedUrl('http://canvas.nus.edu.sg/feeds/calendars/user_x.ics', HOSTS)).toThrow();
    expect(() => validateCanvasFeedUrl('https://canvas.nus.edu.sg/calendar', HOSTS)).toThrow(/calendar feed/);
    expect(() => validateCanvasFeedUrl('not a link', HOSTS)).toThrow();
  });

  it('accepts only the listed hosts, on the usual port, with no name or password in the link', () => {
    expect(() => validateCanvasFeedUrl('https://school.instructure.com/feeds/calendars/user_x.ics', HOSTS)).toThrow();
    expect(() => validateCanvasFeedUrl('https://canvas.nus.edu.sg:8443/feeds/calendars/user_x.ics', HOSTS)).toThrow();
    expect(() => validateCanvasFeedUrl('https://a@canvas.nus.edu.sg/feeds/calendars/user_x.ics', HOSTS)).toThrow();
    expect(() => validateCanvasFeedUrl('https://a:b@canvas.nus.edu.sg/feeds/calendars/user_x.ics', HOSTS)).toThrow();
  });
});

describe('fetchCanvasFeed', () => {
  const FEED = 'https://canvas.nus.edu.sg/feeds/calendars/user_x.ics';
  const redirect = (location: string) => new Response(null, { status: 302, headers: { location } });

  // Answers each request with the next response in the list, and records which links were fetched.
  async function withCanvas(responses: Response[], run: (fetched: string[]) => Promise<void>) {
    const original = globalThis.fetch;
    const fetched: string[] = [];
    globalThis.fetch = vi.fn(async (url: string | URL | Request) => {
      fetched.push(String(url));
      return responses.shift()!;
    }) as typeof fetch;
    try {
      await run(fetched);
    } finally {
      globalThis.fetch = original;
    }
  }

  it('follows a redirect within the same Canvas site', async () => {
    await withCanvas([redirect('/feeds/calendars/user_y.ics'), new Response(SAMPLE_CANVAS_FEED)], async (fetched) => {
      expect(await fetchCanvasFeed(FEED)).toContain('BEGIN:VCALENDAR');
      expect(fetched).toEqual([FEED, 'https://canvas.nus.edu.sg/feeds/calendars/user_y.ics']);
    });
  });

  it('never follows a redirect to another host, plain http or another port', async () => {
    for (const elsewhere of ['https://evil.example.com/x.ics', 'http://canvas.nus.edu.sg/x.ics', 'https://canvas.nus.edu.sg:8443/x.ics']) {
      await withCanvas([redirect(elsewhere)], async (fetched) => {
        await expect(fetchCanvasFeed(FEED)).rejects.toThrow(/somewhere else/);
        expect(fetched).toEqual([FEED]);
      });
    }
  });

  it("asks for a new link when Canvas doesn't recognise the feed", async () => {
    for (const status of [400, 401, 404]) {
      await withCanvas([new Response('<title>Invalid Feed</title>', { status })], async () => {
        await expect(fetchCanvasFeed(FEED)).rejects.toThrow(/rejected your feed link/);
      });
    }
  });

  it('stops after a few redirects', async () => {
    const loop = Array.from({ length: 10 }, () => redirect(FEED));
    await withCanvas(loop, async (fetched) => {
      await expect(fetchCanvasFeed(FEED)).rejects.toThrow(/somewhere else/);
      expect(fetched).toHaveLength(4);
    });
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

  it("doesn't repeat the course when the item's name already is the course", () => {
    expect(formatTitle('ST2334 Probability and Statistics [2610] [ST2334 Probability and Statistics [2610]]')).toBe('[ST2334] Probability and Statistics');
    expect(formatTitle('CS2040 Problem Set 5 [CS2040 Data Structures and Algorithms [2610]]')).toBe('[CS2040] Problem Set 5');
    expect(formatTitle('CS2040 [CS2040 Data Structures and Algorithms [2610]]')).toBe('[CS2040] CS2040');
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
