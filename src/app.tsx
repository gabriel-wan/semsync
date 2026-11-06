import { Hono, type Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { allowedCanvasHosts, getEnv, isDev, type Env } from './env.js';
import { validateCanvasFeedUrl } from './lib/canvas.js';
import { linkAcadYear } from './config.js';
import { decrypt, encrypt, safeEqual } from './lib/crypto.js';
import {
  clearFeed, deleteUserData, eventCounts, feedBody, feedByHash, getUser, jsonList, saveCourseSettings, saveSources, setFeedToken, setMode,
  setRefreshToken, upcomingEvents, upsertUserOnLogin,
  type Course, type UserRow,
} from './lib/db.js';
import { UserError } from './lib/errors.js';
import { authorizationUrl, CALENDAR_SCOPE, exchangeCode, type AuthPurpose } from './lib/googleSignIn.js';
import { feedTokenHash, feedUrl, gunzipBase64, newFeedToken } from './lib/feed.js';
import { parseNusmodsLink } from './lib/nusmods.js';
import { csrfToken, readSession, sessionValue, SESSION_MAX_AGE } from './lib/session.js';
import { disconnectCalendar, hasCalendarAccess, removeFromCalendar, runDueSyncs, SAMPLE_FEED, syncUser, timetableNotice } from './lib/sync.js';
import {
  DeleteData, DevCalendar, DevLogin, Foundations, Help, Settings, Home, Landing, Message, NotFound, OgCard, Privacy, Setup, Terms, type SetupErrors, type Viewer,
} from './views/pages.js';

type AppEnv = { Bindings: Env; Variables: { user: UserRow | null } };
type Ctx = Context<AppEnv>;

const SESSION_COOKIE = 'ss_session';
const STATE_COOKIE = 'ss_oauth_state';

const FLASH: Record<string, string> = {
  created: 'Your calendar is ready.',
  connected: 'Calendar connected. Look for "NUS semester" in your Google Calendar.',
  updated: 'Saved and synced.',
  synced: 'Synced.',
  recent: 'Synced less than a minute ago, so this one was skipped.',
  saved: "Saved. The sync didn't finish this time, so your calendar catches up on the next one.",
  feed: 'Your subscribe link is ready. Add it to your calendar app.',
  'feed-on': 'Subscribe link on. Add it to your calendar app.',
  'feed-reset': 'New link made. The old one has stopped working, so add this one to your calendar app.',
  'feed-off': 'Subscribe link turned off.',
};

const app = new Hono<AppEnv>();

/**
 * On the live site, the old getsemsync.vercel.app address (and Vercel's per-deployment ones) send people on to the
 * site's own domain, so nobody sees the old address. Two things stay put: the scheduled sync, which the GitHub Action
 * calls at whatever address it's set to, and subscribe links, which calendar apps keep exactly as they were given.
 * Nothing moves until the site has a domain of its own.
 */
export function movedTo(requestUrl: string, env: Pick<Env, 'APP_URL' | 'PRODUCTION'>): string | null {
  if (!env.PRODUCTION) return null;
  const url = new URL(requestUrl);
  const home = new URL(env.APP_URL);
  if (url.host === home.host || home.host.endsWith('.vercel.app') || !url.host.endsWith('.vercel.app')) return null;
  if (/^\/(api|feed)\//.test(url.pathname)) return null;
  return `${home.origin}${url.pathname}${url.search}`;
}

app.use('*', async (c, next) => {
  // Settings come from environment variables on Vercel (and .env.local in development), not platform bindings.
  c.env = getEnv();
  const moved = movedTo(c.req.url, c.env);
  if (moved) return c.redirect(moved, 308);
  const cookie = getCookie(c, SESSION_COOKIE);
  const uid = cookie ? await readSession(c.env.SESSION_SECRET, cookie) : null;
  c.set('user', uid ? await getUser(c.env.DB, uid) : null);
  await next();
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
});

const isHttps = (c: Ctx) => new URL(c.req.url).protocol === 'https:';
const origin = (c: Ctx) => new URL(c.req.url).origin;
const callbackUrl = (c: Ctx) => `${origin(c)}/auth/callback`;

async function startSession(c: Ctx, userId: string) {
  setCookie(c, SESSION_COOKIE, await sessionValue(c.env.SESSION_SECRET, userId), {
    httpOnly: true, secure: isHttps(c), sameSite: 'Lax', path: '/', maxAge: SESSION_MAX_AGE,
  });
}

async function validCsrf(c: Ctx, user: UserRow, form: Record<string, unknown>) {
  return typeof form.csrf === 'string' && safeEqual(form.csrf, await csrfToken(c.env.SESSION_SECRET, user.id));
}

/** Sends the browser to Google, remembering why (sign-in or calendar access) in a short-lived cookie. */
function redirectToGoogle(c: Ctx, purpose: AuthPurpose, loginHint?: string) {
  const state = crypto.randomUUID();
  setCookie(c, STATE_COOKIE, `${purpose}:${state}`, { httpOnly: true, secure: isHttps(c), sameSite: 'Lax', path: '/auth', maxAge: 600 });
  return c.redirect(authorizationUrl(c.env.GOOGLE_OAUTH_CLIENT_ID!, callbackUrl(c), state, purpose, loginHint));
}

function addSharedCalendarUrl(env: Env, user: UserRow): string | null {
  if (user.mode !== 'shared' || !user.calendar_id) return null;
  if (env.FAKE_GOOGLE === '1') return '/dev/calendar';
  const cid = encodeURIComponent(btoa(user.calendar_id).replace(/=+$/, ''));
  return `https://calendar.google.com/calendar/r?cid=${cid}&authuser=${encodeURIComponent(user.email)}`;
}

/** Someone who set up before the shared-calendar option went away, and hasn't moved to their own calendar yet. */
const keepsShared = (user: UserRow) => user.mode === 'shared' && !!user.calendar_id;

/**
 * Turns on own-calendar mode with a fresh grant, taking down an old shared calendar if there was one. Someone moving
 * from the subscribe link keeps it, but their events start over in the new Google calendar.
 */
async function connectMainCalendar(env: Env, user: UserRow, refreshToken: string) {
  if (user.mode !== 'main') await removeFromCalendar(env, user);
  await setRefreshToken(env.DB, user.id, await encrypt(env.ENCRYPTION_KEY, refreshToken));
  await setMode(env.DB, user.id, 'main');
  const fresh = (await getUser(env.DB, user.id))!;
  if (fresh.canvas_feed_enc || fresh.nusmods_link) await syncUser(env, fresh);
}

app.get('/', (c) => {
  const user = c.get('user');
  if (user && (user.calendar_id || user.canvas_feed_enc || user.nusmods_link)) return c.redirect('/home');
  // Signed in but not set up yet: they can still read the landing page, and its buttons lead back to setup.
  return c.html(<Landing origin={origin(c)} pendingSetup={!!user} />);
});

/** The nav for a plain page: signed-out links, or your account menu (and Finish setup if you haven't). */
async function viewer(c: Ctx): Promise<Viewer> {
  const user = c.get('user');
  if (!user) return { origin: origin(c) };
  const setUp = !!(user.calendar_id || user.canvas_feed_enc || user.nusmods_link);
  const csrf = await csrfToken(c.env.SESSION_SECRET, user.id);
  return { origin: origin(c), signedIn: true, setupPending: !setUp, account: { email: user.email, name: user.name, csrf } };
}

app.get('/privacy', async (c) => c.html(<Privacy {...await viewer(c)} />));
app.get('/help', async (c) => c.html(<Help {...await viewer(c)} />));

app.get('/settings', async (c) => {
  const user = c.get('user');
  if (!user) return c.redirect('/');
  if (!user.calendar_id && !user.canvas_feed_enc && !user.nusmods_link) return c.redirect('/setup');
  return c.html(
    <Settings user={user} csrf={await csrfToken(c.env.SESSION_SECRET, user.id)} counts={await eventCounts(c.env.DB, user.id)}
      feedLink={await feedLinkOf(c, user)}
      flash={FLASH[c.req.query('done') ?? '']} dev={isDev(c.env)} />,
  );
});
app.get('/terms', async (c) => c.html(<Terms {...await viewer(c)} />));

// Design reference (tokens and every component state), and the card behind public/og.png.
app.get('/foundations', (c) => (isDev(c.env) ? c.html(<Foundations section={c.req.query('section')} />) : c.notFound()));
app.get('/og', (c) => (isDev(c.env) ? c.html(<OgCard />) : c.notFound()));

// --- Google sign-in and calendar access ---

app.get('/auth/google', (c) => {
  if (!c.env.GOOGLE_OAUTH_CLIENT_ID) {
    if (isDev(c.env)) return c.redirect('/auth/dev');
    return c.html(<Message title="Google sign in isn't set up yet" body="This copy of Semsync has no Google client configured." />, 503);
  }
  return redirectToGoogle(c, 'signin');
});

app.get('/connect', async (c) => {
  const user = c.get('user');
  if (!user) return c.redirect('/');
  if (c.env.FAKE_GOOGLE === '1') {
    // Local dev: pretend Google granted calendar access.
    await connectMainCalendar(c.env, user, 'fake-refresh-token');
    return c.redirect('/home?done=connected');
  }
  return redirectToGoogle(c, 'connect', user.email);
});

app.get('/auth/callback', async (c) => {
  const { code, state, error } = c.req.query();
  const [purpose, expected] = (getCookie(c, STATE_COOKIE) ?? '').split(':');
  deleteCookie(c, STATE_COOKIE, { path: '/auth' });
  const user = c.get('user');

  if (error) {
    return purpose === 'connect' && user
      ? c.html(
          <Message title="Calendar access wasn't given" signedIn
            body={'Semsync needs it to make its "NUS semester" calendar in your Google account. It can\'t see or change your other calendars.'}
            action={{ href: '/connect', label: 'Try again' }} />,
        )
      : c.html(<Message title="You cancelled signing in" body="No problem. You can try again whenever you like." action={{ href: '/', label: 'Back to Semsync' }} />);
  }
  if (!code || !state || !expected || !safeEqual(state, expected)) {
    return c.html(<Message title="That link expired" body="It was too old or opened in another browser. Try signing in again." action={{ href: '/', label: 'Back to Semsync' }} />, 400);
  }

  const result = await exchangeCode(code, c.env.GOOGLE_OAUTH_CLIENT_ID!, c.env.GOOGLE_OAUTH_CLIENT_SECRET!, callbackUrl(c));
  const id = `google:${result.identity.sub}`;

  if (purpose === 'connect') {
    if (!user) return c.redirect('/');
    if (user.id !== id) {
      return c.html(
        <Message title="That's a different Google account" signedIn
          body={`You're signed in to Semsync as ${user.email}. Connect the calendar of that same account.`}
          action={{ href: '/connect', label: 'Try again' }} />, 400,
      );
    }
    if (!result.scopes.includes(CALENDAR_SCOPE) || !result.refreshToken) {
      return c.html(
        <Message title="Calendar access is needed" signedIn
          body="On the Google screen, tick the box that lets Semsync make its own calendar. It can't see or change your other calendars."
          action={{ href: '/connect', label: 'Try again' }} />, 400,
      );
    }
    await connectMainCalendar(c.env, user, result.refreshToken);
    return c.redirect('/home?done=connected');
  }

  await upsertUserOnLogin(c.env.DB, { id, email: result.identity.email, name: result.identity.name });
  await startSession(c, id);
  return c.redirect('/home'); // which sends anyone not set up yet on to /setup
});

app.post('/auth/logout', async (c) => {
  const user = c.get('user');
  if (user && (await validCsrf(c, user, await c.req.parseBody()))) deleteCookie(c, SESSION_COOKIE, { path: '/' });
  return c.redirect('/');
});

app.get('/auth/dev', (c) => (isDev(c.env) ? c.html(<DevLogin />) : c.notFound()));

app.post('/auth/dev', async (c) => {
  if (!isDev(c.env)) return c.notFound();
  const email = String((await c.req.parseBody()).email ?? '').trim().toLowerCase();
  if (!email.includes('@')) return c.redirect('/auth/dev');
  const id = `dev:${email}`;
  await upsertUserOnLogin(c.env.DB, { id, email, name: email.split('@')[0] });
  await startSession(c, id);
  return c.redirect('/home');
});

// --- Setup and home ---

/**
 * Whether saving setup goes on to Google to ask for calendar access: everyone but those who have it, those on the
 * subscribe link only, and those still on the old shared calendar.
 */
const asksAccess = (user: UserRow) => !keepsShared(user) && user.mode !== 'feed' && !(user.mode === 'main' && hasCalendarAccess(user));

/** Turns on the subscribe link if it isn't on yet, or replaces it with a new one. */
async function newFeedLink(env: Env, user: UserRow) {
  const token = newFeedToken();
  await setFeedToken(env.DB, user.id, await feedTokenHash(token), await encrypt(env.ENCRYPTION_KEY, token));
}

/** The subscribe link to show the user, on this site's address. */
async function feedLinkOf(c: Ctx, user: UserRow): Promise<string | null> {
  return user.feed_token_enc ? feedUrl(origin(c), await decrypt(c.env.ENCRYPTION_KEY, user.feed_token_enc)) : null;
}

app.get('/setup', async (c) => {
  const user = c.get('user');
  if (!user) return c.redirect('/');
  return c.html(
    <Setup user={user} csrf={await csrfToken(c.env.SESSION_SECRET, user.id)} editing={!!user.calendar_id} dev={isDev(c.env)}
      values={{ canvas: '', nusmods: user.nusmods_link ?? '' }} errors={{}} asksAccess={asksAccess(user)} />,
  );
});

app.post('/setup', async (c) => {
  const user = c.get('user');
  if (!user) return c.redirect('/');
  const form = await c.req.parseBody();
  const csrf = await csrfToken(c.env.SESSION_SECRET, user.id);
  if (!(await validCsrf(c, user, form))) return c.redirect('/setup');

  const values = { canvas: String(form.canvas ?? '').trim(), nusmods: String(form.nusmods ?? '').trim() };
  const errors: SetupErrors = {};
  const editing = !!user.calendar_id;

  // A blank Canvas field keeps the current link, since it isn't shown back.
  let canvasEnc = user.canvas_feed_enc;
  if (values.canvas) {
    try {
      const url = isDev(c.env) && values.canvas === SAMPLE_FEED ? SAMPLE_FEED : validateCanvasFeedUrl(values.canvas, allowedCanvasHosts(c.env));
      canvasEnc = await encrypt(c.env.ENCRYPTION_KEY, url);
    } catch (err) {
      errors.canvas = err instanceof UserError ? err.message : 'Check this link and try again.';
    }
  }
  let nusmods: string | null = null;
  if (values.nusmods) {
    try {
      parseNusmodsLink(values.nusmods);
      nusmods = values.nusmods;
    } catch (err) {
      errors.nusmods = err instanceof UserError ? err.message : 'Check this link and try again.';
    }
  }
  if (!errors.canvas && !errors.nusmods && !canvasEnc && !nusmods) {
    errors.canvas = 'Paste your Canvas calendar feed link to get started.';
  }
  if (Object.keys(errors).length) {
    return c.html(<Setup user={user} csrf={csrf} values={values} errors={errors} editing={editing} dev={isDev(c.env)} asksAccess={asksAccess(user)} />, 400);
  }

  // A link that didn't change keeps the year it was saved in, so re-saving last year's link doesn't move it.
  const nusmodsAy = nusmods && nusmods === user.nusmods_link && user.nusmods_ay ? user.nusmods_ay : linkAcadYear();
  await saveSources(c.env.DB, user.id, canvasEnc, nusmods, nusmodsAy);

  if (form.dest === 'feed' && asksAccess(user)) {
    // Outlook, Apple Calendar or another app: no Google Calendar, just the subscribe link.
    await setMode(c.env.DB, user.id, 'feed');
    if (!user.feed_token_hash) await newFeedLink(c.env, user);
    await syncUser(c.env, (await getUser(c.env.DB, user.id))!, { force: true });
    return c.redirect('/home?done=feed');
  }
  if (asksAccess(user)) {
    // Google's OK for the user's own calendar comes next, then the first sync.
    if (user.mode !== 'main') await setMode(c.env.DB, user.id, 'main');
    return c.redirect('/connect');
  }

  const ok = await syncUser(c.env, (await getUser(c.env.DB, user.id))!, { force: true });
  return c.redirect(ok ? `/home?done=${editing ? 'updated' : 'created'}` : '/home');
});

app.get('/home', async (c) => {
  const user = c.get('user');
  if (!user) return c.redirect('/');
  if (!user.calendar_id && !user.canvas_feed_enc && !user.nusmods_link) return c.redirect('/setup');
  const [counts, upcoming] = await Promise.all([
    eventCounts(c.env.DB, user.id),
    upcomingEvents(c.env.DB, user.id, ['deadline', 'exam', 'event'], 8),
  ]);
  return c.html(
    <Home user={user} csrf={await csrfToken(c.env.SESSION_SECRET, user.id)} addUrl={addSharedCalendarUrl(c.env, user)}
      needsConnect={user.mode === 'main' && !hasCalendarAccess(user)} feedLink={await feedLinkOf(c, user)} timetable={timetableNotice(user)}
      counts={counts} upcoming={upcoming} flash={FLASH[c.req.query('done') ?? '']} dev={isDev(c.env)} />,
  );
});

app.post('/sync', async (c) => {
  const user = c.get('user');
  if (!user || !(await validCsrf(c, user, await c.req.parseBody()))) return c.redirect('/');
  if (user.last_sync_at && Date.now() - user.last_sync_at < 60_000) return c.redirect('/home?done=recent');
  // Only say it worked when it did; a failed sync shows its own message on the page.
  const ok = await syncUser(c.env, user, { force: true });
  return c.redirect(ok ? '/home?done=synced' : '/home');
});

// The course tiles in Settings: save them, then sync so switched off courses leave the calendar now.
app.post('/courses', async (c) => {
  const user = c.get('user');
  if (!user) return c.redirect('/');
  const form = await c.req.parseBody({ all: true });
  if (!(await validCsrf(c, user, form))) return c.redirect('/home');
  const shown = new Set([form.show ?? []].flat().map(String));
  const hidden = jsonList<Course>(user.courses).map((k) => k.key).filter((k) => !shown.has(k));
  await saveCourseSettings(c.env.DB, user.id, hidden, form.weeks === '1');
  const ok = await syncUser(c.env, (await getUser(c.env.DB, user.id))!, { force: true });
  return c.redirect(ok ? '/settings?done=updated' : '/settings?done=saved');
});

// The confirmation as a page, for when JavaScript is off and the confirmation dialog can't open.
app.get('/account/delete', async (c) => {
  const user = c.get('user');
  if (!user) return c.redirect('/');
  return c.html(<DeleteData user={user} csrf={await csrfToken(c.env.SESSION_SECRET, user.id)} counts={await eventCounts(c.env.DB, user.id)} />);
});

app.post('/account/delete', async (c) => {
  const user = c.get('user');
  const form = await c.req.parseBody();
  if (!user || !(await validCsrf(c, user, form))) return c.redirect('/');
  if (form.confirm !== 'yes') return c.redirect('/home');

  const removed = await removeFromCalendar(c.env, user);
  await disconnectCalendar(c.env, user);
  await deleteUserData(c.env.DB, user.id);
  deleteCookie(c, SESSION_COOKIE, { path: '/' });

  const body = removed
    ? 'Everything Semsync added to your calendar is gone, its access is revoked, and nothing about you is stored any more.'
    : 'Nothing about you is stored any more. Some events couldn\'t be removed because calendar access was already gone: search your Google Calendar for "Added by Semsync" to find and delete them.';
  return c.html(<Message title="Your data is deleted" body={body} action={{ href: '/', label: 'Back to Semsync' }} />);
});

// --- Local development ---

app.get('/dev/calendar', async (c) => {
  const user = c.get('user');
  if (!isDev(c.env) || c.env.FAKE_GOOGLE !== '1' || !user) return c.notFound();
  const shared = user.calendar_id
    ? await c.env.DB.prepare('SELECT summary, shared_with FROM fake_calendars WHERE id = ?').bind(user.calendar_id)
        .first<{ summary: string; shared_with: string | null }>()
    : null;
  const { results } = await c.env.DB.prepare('SELECT body FROM fake_events WHERE calendar_id = ?').bind(user.calendar_id ?? '').all<{ body: string }>();
  const events = results
    .map((r) => JSON.parse(r.body) as {
      summary: string; status: string; start: { date?: string; dateTime?: string }; reminders?: { overrides?: { minutes: number }[] };
    })
    .map((e) => ({
      summary: e.summary,
      status: e.status,
      start: e.start.dateTime ?? e.start.date ?? '',
      reminders: (e.reminders?.overrides ?? []).map((r) => r.minutes),
    }))
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  const label = !user.calendar_id
    ? 'No calendar yet.'
    : user.mode === 'shared'
      ? `Shared calendar "${shared?.summary}", shared with ${shared?.shared_with ?? 'nobody'}`
      : `"${shared?.summary ?? 'NUS semester'}" in ${user.email}'s own Google account`;
  return c.html(<DevCalendar label={label} events={events} />);
});

// --- Subscribe link (Outlook, Apple Calendar and other apps) ---

/** The .ics itself. The secret in the address is the only key, so it's checked against its hash and never logged. */
app.get('/feed/:file', async (c) => {
  const token = /^([A-Za-z0-9_-]{20,64})\.ics$/.exec(c.req.param('file'))?.[1];
  const found = token ? await feedByHash(c.env.DB, await feedTokenHash(token)) : null;
  if (!found) return c.text('This calendar link is turned off or was replaced. Get the current one in Semsync\'s Settings.', 404);
  if (!found.updated_at) return c.text('This calendar is being made. Try again in a few minutes.', 503, { 'Retry-After': '300' });
  const modified = new Date(Math.floor(found.updated_at / 1000) * 1000).toUTCString();
  const headers = { 'Cache-Control': 'private, max-age=900', 'Last-Modified': modified };
  const since = c.req.header('if-modified-since');
  if (since && Date.parse(since) >= Math.floor(found.updated_at / 1000) * 1000) return c.body(null, 304, headers);
  const body = await feedBody(c.env.DB, found.user_id);
  if (!body) return c.text('This calendar is being made. Try again in a few minutes.', 503, { 'Retry-After': '300' });
  return c.body(await gunzipBase64(body), 200, {
    ...headers,
    'Content-Type': 'text/calendar; charset=utf-8',
    'Content-Disposition': 'inline; filename="nus-semester.ics"',
  });
});

/** Turns the subscribe link on, makes a new one (the old one stops working), or turns it off. */
app.post('/feed/:action', async (c) => {
  const user = c.get('user');
  if (!user || !(await validCsrf(c, user, await c.req.parseBody()))) return c.redirect('/');
  const action = c.req.param('action');
  if (action === 'use' && user.mode === 'main' && !hasCalendarAccess(user)) {
    // From the "Connect Google Calendar" card: Outlook or Apple Calendar instead.
    await setMode(c.env.DB, user.id, 'feed');
    if (!user.feed_token_hash) await newFeedLink(c.env, user);
    await syncUser(c.env, (await getUser(c.env.DB, user.id))!, { force: true });
    return c.redirect('/home?done=feed');
  }
  if (action === 'on' || action === 'reset') {
    await newFeedLink(c.env, user);
    await syncUser(c.env, (await getUser(c.env.DB, user.id))!, { force: true });
    return c.redirect(`/settings?done=feed-${action}#apps`);
  }
  // Someone on the link alone keeps it: it's the only way their events reach them.
  if (action === 'off' && user.mode !== 'feed') {
    await clearFeed(c.env.DB, user.id);
    return c.redirect('/settings?done=feed-off#apps');
  }
  return c.redirect('/settings');
});

// --- Scheduled sync ---

// Called hourly by the GitHub Action (.github/workflows/hourly-sync.yml) and daily by Vercel Cron as a backup.
// Both send "Authorization: Bearer <CRON_SECRET>".
app.get('/api/cron', async (c) => {
  const secret = c.env.CRON_SECRET;
  if (!secret || !safeEqual(c.req.header('authorization') ?? '', `Bearer ${secret}`)) return c.json({ error: 'unauthorized' }, 401);
  const result = await runDueSyncs(c.env);
  // A run where many syncs fail on our side answers 500, so the GitHub Action fails and GitHub emails the owner.
  const tried = result.synced + result.unchanged + result.failed;
  const broken = result.failed >= 5 && result.failed > tried / 4;
  if (broken) console.error('sync run mostly failed', result);
  return c.json(result, broken ? 500 : 200);
});

app.notFound((c) => c.html(<NotFound signedIn={!!c.get('user')} />, 404));

app.onError((err, c) => {
  console.error(err);
  return c.html(<Message title="Something went wrong" body="Semsync hit an error. Try again in a minute." action={{ href: '/', label: 'Back to Semsync' }} />, 500);
});

export default app;
