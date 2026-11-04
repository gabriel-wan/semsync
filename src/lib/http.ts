/** Thrown when a remote service doesn't answer in time. */
export class TimeoutError extends Error {}

/** How Semsync introduces itself to Canvas and NUSMods. Some firewalls stall requests that give no name at all. */
export const USER_AGENT = 'Semsync (calendar sync for NUS students)';

/**
 * fetch, but giving up after `ms` milliseconds, including while the body downloads. Without a limit, one service
 * that never answers holds the request until the platform kills it (300 s on Vercel), with nothing in the logs.
 */
export async function fetchWithin(ms: number, what: string, url: string, init: RequestInit = {}): Promise<Response> {
  const signal = AbortSignal.timeout(ms);
  try {
    const res = await fetch(url, { ...init, signal });
    // Read the body under the same limit, then hand back a response that's already in memory.
    const body = await res.arrayBuffer();
    const empty = [101, 204, 205, 304].includes(res.status); // these can't carry a body, not even an empty one
    return new Response(empty ? null : body, { status: res.status, statusText: res.statusText, headers: res.headers });
  } catch (err) {
    if (signal.aborted) throw new TimeoutError(`${what} didn't answer within ${Math.round(ms / 1000)} s`);
    throw err;
  }
}
