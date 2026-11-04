import { TIME_ZONE } from '../../config.js';
import { fetchWithin } from '../http.js';
import type { TokenProvider } from './tokens.js';
import type { CalendarBackend, EventOp, OpResult } from './types.js';

const API = 'https://www.googleapis.com/calendar/v3';
const BATCH_URL = 'https://www.googleapis.com/batch/calendar/v3';
const BATCH_SIZE = 50;

/** Google Calendar, acting as whichever account the token provider is for. */
export class GoogleCalendar implements CalendarBackend {
  constructor(private token: TokenProvider) {}

  async createCalendar(summary: string, description: string): Promise<string> {
    const res = await this.call('POST', '/calendars', { summary, description, timeZone: TIME_ZONE });
    return ((await res.json()) as { id: string }).id;
  }

  async shareWith(calendarId: string, email: string): Promise<void> {
    // Read-only: Canvas and NUSMods stay the source of truth. No email: Google's invite comes from the service
    // account's robot address and reads like spam; the "Add to Google Calendar" button on their page does the same.
    await this.call('POST', `/calendars/${encodeURIComponent(calendarId)}/acl?sendNotifications=false`, {
      role: 'reader',
      scope: { type: 'user', value: email },
    });
  }

  async deleteCalendar(calendarId: string): Promise<void> {
    await this.call('DELETE', `/calendars/${encodeURIComponent(calendarId)}`, undefined, [404, 410]);
  }

  async apply(calendarId: string, ops: EventOp[]): Promise<OpResult[]> {
    const results: OpResult[] = [];
    for (let i = 0; i < ops.length; i += BATCH_SIZE) {
      results.push(...(await this.batch(calendarId, ops.slice(i, i + BATCH_SIZE))));
    }
    return results;
  }

  private async batch(calendarId: string, ops: EventOp[]): Promise<OpResult[]> {
    const boundary = `semsync_${crypto.randomUUID()}`;
    const events = `/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;
    const parts = ops.map((op, i) => {
      const head = [`--${boundary}`, 'Content-Type: application/http', `Content-ID: <item${i}>`, ''];
      if (op.type === 'delete') return [...head, `DELETE ${events}/${op.eventId} HTTP/1.1`, '', ''].join('\r\n');
      const [method, path, body] =
        op.type === 'insert'
          ? ['POST', events, { id: op.eventId, ...op.body }]
          : ['PUT', `${events}/${op.eventId}`, op.body];
      return [...head, `${method} ${path} HTTP/1.1`, 'Content-Type: application/json', '', JSON.stringify(body)].join('\r\n');
    });

    const res = await fetchWithin(45_000, 'Google Calendar', BATCH_URL, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${await this.token()}`,
        'content-type': `multipart/mixed; boundary=${boundary}`,
      },
      body: `${parts.join('\r\n')}\r\n--${boundary}--\r\n`,
    });
    if (!res.ok) throw new Error(`Calendar batch failed: ${res.status} ${await res.text()}`);
    return parseBatchResponse(res.headers.get('content-type') ?? '', await res.text(), ops);
  }

  private async call(method: string, path: string, body?: unknown, okStatuses: number[] = []): Promise<Response> {
    const res = await fetchWithin(30_000, 'Google Calendar', `${API}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${await this.token()}`,
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok && !okStatuses.includes(res.status)) {
      throw new Error(`Google Calendar ${method} ${path} failed: ${res.status} ${await res.text()}`);
    }
    return res;
  }
}

/** Reads Google's multipart batch response; parts can come back in any order. */
export function parseBatchResponse(contentType: string, text: string, ops: EventOp[]): OpResult[] {
  const boundary = /boundary="?([^";]+)"?/.exec(contentType)?.[1];
  if (!boundary) throw new Error(`Unexpected batch response type: ${contentType}`);
  const results: OpResult[] = ops.map((op) => ({ eventId: op.eventId, status: 0 }));
  for (const part of text.split(`--${boundary}`)) {
    const id = /Content-ID:\s*<response-item(\d+)>/i.exec(part);
    const status = /HTTP\/1\.1 (\d{3})/.exec(part);
    if (id && status && results[Number(id[1])]) results[Number(id[1])].status = Number(status[1]);
  }
  return results;
}
