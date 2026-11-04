import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TimeoutError, fetchWithin } from '../src/lib/http';

// A server with three behaviours: never answers, answers headers then stalls the body, or answers normally.
let server: Server;
let base: string;
beforeAll(async () => {
  server = createServer((req, res) => {
    if (req.url === '/silent') return; // never responds
    if (req.url === '/slow-body') { res.writeHead(200); res.write('BEGIN'); return; } // never finishes
    if (req.url === '/empty') { res.writeHead(204); res.end(); return; }
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end('hello');
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => {
  server.closeAllConnections();
  server.close();
});

describe('fetchWithin', () => {
  it('gives up on a service that never answers, naming it', async () => {
    const started = Date.now();
    await expect(fetchWithin(200, 'Canvas', `${base}/silent`)).rejects.toThrow(new TimeoutError("Canvas didn't answer within 0 s"));
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it('also gives up when the body stalls halfway', async () => {
    await expect(fetchWithin(200, 'Canvas', `${base}/slow-body`)).rejects.toBeInstanceOf(TimeoutError);
  });

  it('returns normal responses, including ones with no body', async () => {
    const ok = await fetchWithin(2000, 'x', `${base}/`);
    expect(ok.status).toBe(200);
    expect(await ok.text()).toBe('hello');
    const empty = await fetchWithin(2000, 'x', `${base}/empty`);
    expect(empty.status).toBe(204);
  });
});
