import { Hono, type Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { allowedCanvasHosts, isDev, type Env } from './env';
import { validateCanvasFeedUrl } from './lib/canvas';
import { encrypt, safeEqual } from './lib/crypto';
import {
  deleteUserData, eventCounts, getUser, saveSources, setMode, setRefreshToken, upcomingEvents, upsertUserOnLogin, type UserRow,
} from './lib/db';
import { UserError } from './lib/errors';
import type { CalendarMode } from './lib/events';
import { authorizationUrl, CALENDAR_SCOPE, exchangeCode, type AuthPurpose } from './lib/googleSignIn';
import { parseNusmodsLink } from './lib/nusmods';
import { csrfToken, readSession, sessionValue, SESSION_MAX_AGE } from './lib/session';
import { disconnectCalendar, hasCalendarAccess, removeFromCalendar, runDueSyncs, SAMPLE_FEED, syncUser } from './lib/sync';
import {
  DevCalendar, DevLogin, Foundations, Home, Landing, Message, NotFound, OgCard, Privacy, Setup, Terms, type SetupErrors,
} from './views/pages';

type AppEnv = { Bindings: Env; Variables: { user: UserRow | null } };
type Ctx = Context<AppEnv>;

const SESSION_COOKIE = 'ss_session';
const STATE_COOKIE = 'ss_oauth_state';

const FLASH: Record<string, string> = {
  created: 'Your calendar is ready.',
  connected: "Calendar connected. Your deadlines, classes and exams are in your Google Calendar.",
  updated: 'Saved and synced.',
  synced: 'Synced.',
  recent: 'Synced less than a minute ago, so this one was skipped.',
};

const app = new Hono<AppEnv>();

app.use('*', async (c, next) => {
  const uid = await readSession(c.env.SESSION_SECRET, getCookie(c, SESSION_COOKIE));
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

/** Turns on main-calendar mode with a fresh grant, taking down the shared calendar if there was one. */
async function connectMainCalendar(env: Env, user: UserRow, refreshToken: string) {
  if (user.mode === 'shared') await removeFromCalendar(env, user);
  await setRefreshToken(env.DB, user.id, await encrypt(env.ENCRYPTION_KEY, refreshToken));
  await setMode(env.DB, user.id, 'main');
  const fresh = (await getUser(env.DB, user.id))!;
  if (fresh.canvas_feed_enc || fresh.nusmods_link) await syncUser(env, fresh);
}

/** Moves a main-calendar user to a shared calendar: removes Semsync's events from their calendar and revokes access. */
async function switchToShared(env: Env, user: UserRow) {
  if (user.mode === 'main') {
    await removeFromCalendar(env, user);
    await disconnectCalendar(env, user);
  }
  await setMode(env.DB, user.id, 'shared');
}

app.get('/', (c) => {
  const user = c.get('user');
  if (user) return c.redirect(user.calendar_id || user.canvas_feed_enc || user.nusmods_link ? '/home' : '/setup');
  return c.html(<Landing origin={origin(c)} />);
});

app.get('/privacy', (c) => c.html(<Privacy signedIn={!!c.get('user')} origin={origin(c)} />));
app.get('/terms', (c) => c.html(<Terms signedIn={!!c.get('user')} origin={origin(c)} />));

// Design reference (tokens and every component state), and the card behind public/og.png.
app.get('/foundations', (c) => c.html(<Foundations section={c.req.query('section')} />));
app.get('/og', (c) => c.html(<OgCard />));

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
            body="That's fine. You can try again, or use a separate shared calendar that needs no permission."
            action={{ href: '/setup?edit=1', label: 'Choose another option' }} />,
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
          body='On the Google screen, tick the box that lets Semsync manage events in your calendar. Or use a separate shared calendar instead.'
          action={{ href: '/connect', label: 'Try again' }} />, 400,
      );
    }
    await connectMainCalendar(c.env, user, result.refreshToken);
    return c.redirect('/home?done=connected');
  }

  await upsertUserOnLogin(c.env.DB, { id, email: result.identity.email, name: result.identity.name });
  await startSession(c, id);
  return c.redirect('/');
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
  return c.redirect('/');
});

// --- Setup and home ---

app.get('/setup', async (c) => {
  const user = c.get('user');
  if (!user) return c.redirect('/');
  return c.html(
    <Setup user={user} csrf={await csrfToken(c.env.SESSION_SECRET, user.id)} editing={!!user.calendar_id} dev={isDev(c.env)}
      values={{ canvas: '', nusmods: user.nusmods_link ?? '', mode: user.mode }} errors={{}} />,
  );
});

app.post('/setup', async (c) => {
  const user = c.get('user');
  if (!user) return c.redirect('/');
  const form = await c.req.parseBody();
  const csrf = await csrfToken(c.env.SESSION_SECRET, user.id);
  if (!(await validCsrf(c, user, form))) return c.redirect('/setup');

  const mode: CalendarMode = form.mode === 'shared' ? 'shared' : 'main';
  const values = { canvas: String(form.canvas ?? '').trim(), nusmods: String(form.nusmods ?? '').trim(), mode };
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
    return c.html(<Setup user={user} csrf={csrf} values={values} errors={errors} editing={editing} dev={isDev(c.env)} />, 400);
  }

  await saveSources(c.env.DB, user.id, canvasEnc, nusmods);

  if (mode === 'main' && !(user.mode === 'main' && hasCalendarAccess(user))) {
    // Calendar access comes next. A shared-calendar user keeps their calendar until access is actually granted.
    if (user.mode === 'main' || !user.calendar_id) await setMode(c.env.DB, user.id, 'main');
    return c.redirect('/connect');
  }
  if (mode === 'shared' && user.mode !== 'shared') await switchToShared(c.env, user);

  await syncUser(c.env, (await getUser(c.env.DB, user.id))!);
  return c.redirect(`/home?done=${editing ? 'updated' : 'created'}`);
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
      needsConnect={user.mode === 'main' && !hasCalendarAccess(user)}
      counts={counts} upcoming={upcoming} flash={FLASH[c.req.query('done') ?? '']} dev={isDev(c.env)} />,
  );
});

app.post('/sync', async (c) => {
  const user = c.get('user');
  if (!user || !(await validCsrf(c, user, await c.req.parseBody()))) return c.redirect('/');
  if (user.last_sync_at && Date.now() - user.last_sync_at < 60_000) return c.redirect('/home?done=recent');
  await syncUser(c.env, user);
  return c.redirect('/home?done=synced');
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
    : shared
      ? `Shared calendar "${shared.summary}", shared with ${shared.shared_with ?? 'nobody'}`
      : `${user.email}'s own calendar`;
  return c.html(<DevCalendar label={label} events={events} />);
});

app.notFound((c) => c.html(<NotFound signedIn={!!c.get('user')} />, 404));

app.onError((err, c) => {
  console.error(err);
  return c.html(<Message title="Something went wrong" body="Semsync hit an error. Try again in a minute." action={{ href: '/', label: 'Back to Semsync' }} />, 500);
});

export default {
  fetch: app.fetch,
  scheduled(_event, env, ctx) {
    ctx.waitUntil(runDueSyncs(env));
  },
} satisfies ExportedHandler<Env>;
