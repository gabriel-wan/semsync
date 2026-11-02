import { describe, expect, it } from 'vitest';
import { parseBatchResponse } from '../src/lib/calendar/google';
import type { CalendarBackend, EventOp, OpResult } from '../src/lib/calendar/types';
import { canvasEvents } from '../src/lib/canvas';
import type { TrackedRow } from '../src/lib/db';
import type { CalEvent } from '../src/lib/events';
import { applyPlan, planSync, type PlannedUpsert } from '../src/lib/sync';
import { SAMPLE_CANVAS_FEED } from '../src/fixtures/sampleCanvas';

/** In-memory calendar with Google's semantics: deletes leave a cancelled event behind. */
class MemoryCalendar implements CalendarBackend {
  events = new Map<string, { status: string; body: unknown }>();
  calls: EventOp['type'][][] = [];
  async createCalendar() {
    return 'cal@group.calendar.google.com';
  }
  async shareWith() {}
  async deleteCalendar() {}
  async apply(_cal: string, ops: EventOp[]): Promise<OpResult[]> {
    this.calls.push(ops.map((o) => o.type));
    return ops.map((op) => {
      const e = this.events.get(op.eventId);
      let status: number;
      if (op.type === 'insert') status = e ? 409 : 200;
      else if (op.type === 'update') status = e ? 200 : 404;
      else status = e && e.status !== 'cancelled' ? 204 : 410;
      if (status < 300) {
        this.events.set(op.eventId, op.type === 'delete' ? { ...e!, status: 'cancelled' } : { status: 'confirmed', body: op.body });
      }
      return { eventId: op.eventId, status };
    });
  }
}

const NOW = Date.parse('2026-11-03T00:00:00Z');
const asTracked = (u: PlannedUpsert[]): TrackedRow[] => u.map((x) => ({ event_id: x.eventId, hash: x.hash, start_ms: x.startMs }));
const live = (cal: MemoryCalendar) => [...cal.events.values()].filter((e) => e.status === 'confirmed').length;

describe('planSync + applyPlan', () => {
  const events = canvasEvents(SAMPLE_CANVAS_FEED);

  it('inserts everything on the first sync, then does nothing when nothing changed', async () => {
    const cal = new MemoryCalendar();
    const plan = await planSync(events, [], NOW);
    expect(plan.upserts).toHaveLength(4);
    const applied = await applyPlan(cal, 'cal', plan);
    expect(applied).toMatchObject({ failed: 0, remaining: 0 });
    expect(live(cal)).toBe(4);

    const again = await planSync(events, asTracked(applied.upserts), NOW);
    expect(again).toEqual({ upserts: [], deletes: [] });
  });

  it('updates changed events and removes upcoming ones that disappeared, but keeps past ones', async () => {
    const cal = new MemoryCalendar();
    const first = await applyPlan(cal, 'cal', await planSync(events, [], NOW));
    const tracked = asTracked(first.upserts);

    const renamed: CalEvent[] = events
      .filter((e) => !e.key.endsWith('512500')) // Nov 12 deadline removed (upcoming)
      .filter((e) => !e.key.endsWith('512341')) // Nov 6 deadline gone from the feed, but it's in the past below
      .map((e) => (e.key.endsWith('90210') ? { ...e, title: 'Midterm review (moved)' } : e));
    const later = Date.parse('2026-11-09T00:00:00Z');
    const plan = await planSync(renamed, tracked, later);

    expect(plan.upserts.map((u) => u.title)).toEqual(['Midterm review (moved)']);
    expect(plan.deletes).toHaveLength(1);
    const applied = await applyPlan(cal, 'cal', plan);
    expect(applied.failed).toBe(0);
    expect(live(cal)).toBe(3);
  });

  it('recovers when our records and the calendar disagree', async () => {
    const cal = new MemoryCalendar();
    const plan = await planSync(events, [], NOW);
    await applyPlan(cal, 'cal', plan);
    // Lost our records: everything looks new, so inserts hit 409 and get retried as updates.
    const applied = await applyPlan(cal, 'cal', await planSync(events, [], NOW));
    expect(applied.failed).toBe(0);
    expect(cal.calls.at(-1)).toEqual(['update', 'update', 'update', 'update']);

    // Event deleted on the calendar side: the update hits 404... or a cancelled event, which update restores.
    const [first] = plan.upserts;
    cal.events.delete(first.eventId);
    const tracked = asTracked(plan.upserts).map((t) => (t.event_id === first.eventId ? { ...t, hash: 'stale' } : t));
    const fixed = await applyPlan(cal, 'cal', await planSync(events, tracked, NOW));
    expect(fixed.upserts.map((u) => u.eventId)).toEqual([first.eventId]);
    expect(cal.events.get(first.eventId)?.status).toBe('confirmed');
  });

  it('only adds new events from now on after the first sync', async () => {
    const tracked = asTracked((await planSync(events, [], NOW)).upserts);
    const newSlot = (date: string): CalEvent => ({
      key: `nusmods:tut:${date}`, kind: 'class', title: 'CS2040 Tutorial 03',
      start: { dateTime: `${date}T10:00:00+08:00` }, end: { dateTime: `${date}T11:00:00+08:00` },
    });
    const plan = await planSync([...events, newSlot('2026-10-27'), newSlot('2026-11-10')], tracked, NOW);
    expect(plan.upserts.map((u) => u.title)).toEqual(['CS2040 Tutorial 03']);
    expect(plan.upserts[0].startMs).toBe(Date.parse('2026-11-10T02:00:00Z'));
  });

  it('caps the work per run and reports what is left', async () => {
    const plan = await planSync(events, [], NOW);
    const applied = await applyPlan(new MemoryCalendar(), 'cal', plan, 3);
    expect(applied.upserts).toHaveLength(3);
    expect(applied.remaining).toBe(1);
  });
});

describe('parseBatchResponse', () => {
  it('matches parts by Content-ID, in any order', () => {
    const ops: EventOp[] = [
      { type: 'insert', eventId: 'a', body: {} },
      { type: 'delete', eventId: 'b' },
    ];
    const body = [
      '--batch_x',
      'Content-Type: application/http',
      'Content-ID: <response-item1>',
      '',
      'HTTP/1.1 410 Gone',
      '',
      '--batch_x',
      'Content-Type: application/http',
      'Content-ID: <response-item0>',
      '',
      'HTTP/1.1 200 OK',
      'Content-Type: application/json',
      '',
      '{"id":"a"}',
      '--batch_x--',
    ].join('\r\n');
    expect(parseBatchResponse('multipart/mixed; boundary=batch_x', body, ops)).toEqual([
      { eventId: 'a', status: 200 },
      { eventId: 'b', status: 410 },
    ]);
  });
});
