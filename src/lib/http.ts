/** Thrown when a remote service, or the database, doesn't answer in time. */
export class TimeoutError extends Error {}

/** How Semsync introduces itself to Canvas and NUSMods. Some firewalls stall requests that give no name at all. */
export const USER_AGENT = 'Semsync (calendar sync for NUS students)';

/**
 * Settles with `work`, or rejects with a TimeoutError after `ms`, whichever comes first. It races a plain timer rather
 * than relying on an abort signal, because a platform's wrapped fetch (Vercel wraps it for its logs) may not pass the
 * signal on. A stalled request then still ends in seconds with a message that names it, instead of holding the whole
 * request until the platform kills it at 300 s with nothing in the logs.
 */
export async function within<T>(ms: number, what: string, work: Promise<T>, onTimeout?: () => void): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const limit = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      try { onTimeout?.(); } catch { /* best effort */ }
      reject(new TimeoutError(`${what} didn't answer within ${Math.round(ms / 1000)} s`));
    }, ms);
  });
  try {
    return await Promise.race([work, limit]);
  } finally {
    clearTimeout(timer);
  }
}

/** fetch, giving up after `ms` milliseconds, including while the body downloads; the body comes back in memory. */
export async function fetchWithin(ms: number, what: string, url: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const read = async () => {
    const res = await fetch(url, { ...init, signal: controller.signal });
    const body = await res.arrayBuffer();
    const empty = [101, 204, 205, 304].includes(res.status); // these can't carry a body, not even an empty one
    return new Response(empty ? null : body, { status: res.status, statusText: res.statusText, headers: res.headers });
  };
  return within(ms, what, read(), () => controller.abort());
}
