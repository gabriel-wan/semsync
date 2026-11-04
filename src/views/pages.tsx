import type { Child, FC, PropsWithChildren } from 'hono/jsx';
import { raw } from 'hono/html';
import { TESTIMONIAL } from '../config.js';
import type { UpcomingRow, UserRow } from '../lib/db.js';
import type { CalendarMode } from '../lib/events.js';
import { GoogleMark, Icon } from './icons.js';
import { CSS, SCRIPT } from './styles.js';
import { CORE, RADIUS, SPACING, SYSTEM, SYSTEM_SPEC, TEXT_STYLES } from './tokens.js';

const FAVICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%239e5021'/%3E%3Cpath d='M9 12h14M9 17h9M9 22h6' stroke='white' stroke-width='2.5' stroke-linecap='round'/%3E%3C/svg%3E";

const FONTS = 'https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Geist+Mono:wght@500&display=swap';

type LayoutProps = PropsWithChildren<{
  title: string; description?: string; current?: string; signedIn?: boolean; noindex?: boolean; origin?: string;
  /** Hide the nav's "Sign in" where the page's own call to action does the same thing (one action above the fold). */
  navCta?: boolean;
  head?: Child;
}>;

export const Layout: FC<LayoutProps> = ({ title, description, current, signedIn, noindex, origin, navCta = true, head, children }) => {
  const desc = description ?? 'Canvas deadlines, NUSMods classes and exams in your Google Calendar, kept up to date.';
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title}</title>
        <meta name="description" content={desc} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={desc} />
        <meta property="og:type" content="website" />
        {origin && <meta property="og:url" content={origin} />}
        {origin && <meta property="og:image" content={`${origin}/og.png`} />}
        {origin && <meta property="og:image:width" content="1200" />}
        {origin && <meta property="og:image:height" content="630" />}
        <meta name="twitter:card" content={origin ? 'summary_large_image' : 'summary'} />
        {noindex && <meta name="robots" content="noindex" />}
        <link rel="icon" href={FAVICON} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
        <link href={FONTS} rel="stylesheet" />
        <style>{raw(CSS)}</style>
        {head}
      </head>
      <body>
        <a class="skip body-5" href="#main">Skip to content</a>
        <nav class="nav" aria-label="Main">
          <div class={`nav-bar${!signedIn && !navCta ? ' solo' : ''}`}>
            <a class="brand title-3" href="/" aria-current={current === 'landing' ? 'page' : undefined}>
              <span class="brand-mark"><Icon name="calendar" size={14} /></span>Semsync
            </a>
            {signedIn ? (
              <a class="nav-link title-4" href="/home" aria-current={current === 'home' ? 'page' : undefined}>Your calendar</a>
            ) : (
              navCta && <a class="nav-link title-4" href="/auth/google">Sign in</a>
            )}
          </div>
        </nav>
        <main id="main">{children}</main>
        <footer class="wrap">
          <div class="divider" />
          <div class="footer-row caption-2">
            <span>Made by an NUS student. Not affiliated with NUS or Instructure.</span>
            <span class="footer-links">
              <a href="/privacy" aria-current={current === 'privacy' ? 'page' : undefined}>Privacy</a>
              <a href="/terms" aria-current={current === 'terms' ? 'page' : undefined}>Terms</a>
            </span>
          </div>
        </footer>
        <script>{raw(SCRIPT)}</script>
      </body>
    </html>
  );
};

const SignInButton: FC = () => (
  <a class="btn btn-google btn-lg button-lg" href="/auth/google">
    <GoogleMark />Continue with Google
  </a>
);

/** Proof beside the claim: a real testimonial once there is one, otherwise what Semsync works with (both true). */
const Proof: FC = () =>
  TESTIMONIAL ? (
    <figure class="proof" style="margin-left: auto; margin-right: auto;">
      <blockquote class="body-3">"{TESTIMONIAL.quote}"</blockquote>
      <figcaption class="caption-2">{TESTIMONIAL.name}, {TESTIMONIAL.detail}</figcaption>
    </figure>
  ) : (
    <p class="proof" aria-label="Works with Canvas, NUSMods and Google Calendar">
      <span class="caption-2">Works with</span>
      <span class="title-3">Canvas</span>
      <span class="title-3">NUSMods</span>
      <span class="title-3">Google Calendar</span>
    </p>
  );

/** FAQ structured data, so search engines and answer engines can read the questions directly. */
const faqSchema = (faq: [string, string][]) =>
  raw(
    `<script type="application/ld+json">${JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
    }).replace(/</g, '\\u003c')}</script>`,
  );

const Chip: FC<{ kind: 'class' | 'deadline' | 'exam'; title: string; time: string; large?: boolean }> = ({ kind, title, time, large }) => (
  <div class={`chip chip-${kind} ${large ? 'title-2' : 'caption-4'}`} style={large ? 'padding: var(--space-100) var(--space-200);' : undefined}>
    {title}
    <span class={`mono ${large ? 'body-3' : 'caption-5'}`}>{time}</span>
  </div>
);

function words(text: string) {
  return text.split(' ').map((w) => (
    <>
      <span class="w">{w}</span>{' '}
    </>
  ));
}

const FAQ: [string, string][] = [
  ['Is this an official NUS app?', "No. It's made by a student and isn't affiliated with NUS or Instructure. It only reads the calendar feed Canvas already gives you."],
  ['What does it do in my calendar?', 'It adds your deadlines, classes and exams, and keeps them up to date. Every event it adds is tagged, and it only ever changes or removes those. It never reads or edits your other events.'],
  ['Do I have to give calendar access?', 'No. During setup you can pick a separate shared calendar instead. It shows up as "NUS semester" next to your own calendars, and needs no calendar permission at all.'],
  ["Why does Google say the app isn't verified?", "Google reviews apps that ask for calendar access, and Semsync is still waiting for that review. Until then Google shows a warning: choose Advanced, then Go to Semsync. The separate shared calendar option doesn't show it."],
  ['How quickly do changes show up?', 'Semsync checks Canvas about once an hour. If a deadline moves, your calendar follows within the hour.'],
  ['Do I get reminders?', 'Yes: 1 day and 3 hours before each deadline, and 1 week and 1 day before each exam. With the shared calendar, you set reminders yourself in Google Calendar settings.'],
  ['How do I stop using it?', 'Delete your data from your Semsync page. That removes every event Semsync added, revokes its calendar access and deletes everything it stored about you.'],
];

export const Landing: FC<{ origin?: string }> = ({ origin }) => (
  <Layout title="Semsync: your NUS semester in Google Calendar" origin={origin} current="landing" navCta={false} head={faqSchema(FAQ)}>
    <div class="wrap">
      <header class="hero">
        <h1 class="heading-1 hero-title">
          Every Canvas deadline<br /> in your calendar,<br /> without typing a thing
        </h1>
        <p class="hero-sub body-7">
          Paste your Canvas calendar link and your NUSMods timetable once. Semsync puts your deadlines, classes and exams straight
          into your Google Calendar, with reminders, and keeps them up to date every hour.
        </p>
        <div class="cta">
          <SignInButton />
          <p class="caption-2 text-secondary">Free. Only touches the events it adds. Delete anytime.</p>
        </div>
        <Proof />
        <div class="week" role="img" aria-label="Example week with classes, Canvas deadlines and a final exam">
          <div class="day"><span class="day-name caption-4">Mon</span><Chip kind="class" title="CS2040 Tutorial 05" time="10:00" /></div>
          <div class="day"><span class="day-name caption-4">Tue</span><Chip kind="class" title="ES2660 Sectional G01" time="09:00" /></div>
          <div class="day"><span class="day-name caption-4">Wed</span><Chip kind="class" title="CS2040 Lecture" time="09:00" /><Chip kind="deadline" title="[UTC2402] Reflection" time="23:59" /></div>
          <div class="day"><span class="day-name caption-4">Thu</span><Chip kind="class" title="CS2040 Lecture" time="09:00" /></div>
          <div class="day"><span class="day-name caption-4">Fri</span><Chip kind="deadline" title="[CS2040] Problem Set 5" time="23:59" /><Chip kind="exam" title="MA1521 final exam" time="17:00" /></div>
        </div>
      </header>

      <section class="reveal split" aria-labelledby="how">
        <div>
          <h2 id="how" class="heading-4">Set up in about a minute</h2>
          <p class="body-3 text-secondary mt-75">Three steps, then it runs on its own.</p>
        </div>
        <ol class="steps">
          <li class="step"><span class="step-no title-4">1</span><div><h3 class="title-3">Sign in with Google</h3><p class="body-6 text-secondary mt-25">Just your name and email to start.</p></div></li>
          <li class="step"><span class="step-no title-4">2</span><div><h3 class="title-3">Paste two links</h3><p class="body-6 text-secondary mt-25">Your Canvas calendar feed and, if you like, your NUSMods share link.</p></div></li>
          <li class="step"><span class="step-no title-4">3</span><div><h3 class="title-3">Allow calendar access</h3><p class="body-6 text-secondary mt-25">Everything lands in your Google Calendar and keeps itself up to date. Prefer not to? Pick a separate shared calendar instead.</p></div></li>
        </ol>
      </section>

      <section aria-label="Why">
        <p class="tagline heading-3">
          {words('Stop copying deadlines into your calendar.')}<br />{words('Spend that time actually doing them.')}
        </p>
      </section>

      <section class="reveal" aria-labelledby="what">
        <h2 id="what" class="heading-4">Your whole semester, tidy</h2>
        <div class="bento">
          <div class="card">
            <h3 class="title-2">Module code up front</h3>
            <p class="body-6">Short titles you can scan, instead of the full Canvas course name in brackets.</p>
            <div class="before-after">
              <span class="caption-2 was">Problem Set 5 [CS2040 Data Structures and Algorithms [2610]]</span>
              <span class="chip chip-deadline caption-4" style="align-self: flex-start;">[CS2040] Problem Set 5 <span class="mono">23:59</span></span>
            </div>
          </div>
          <div class="card"><h3 class="title-2">Classes on the right weeks</h3><p class="body-6">Only the slots you picked on NUSMods. Recess week and public holidays are skipped.</p></div>
          <div class="card"><h3 class="title-2">Exams included</h3><p class="body-6">Final exam dates and times from NUSMods, so Week 13 has no surprises.</p></div>
          <div class="card"><h3 class="title-2">Reminders built in</h3><p class="body-6">1 day and 3 hours before every deadline, and a week before each exam.</p></div>
          <div class="card"><h3 class="title-2">Updates itself</h3><p class="body-6">Deadline moved or a new quiz posted on Canvas? Your calendar follows within the hour.</p></div>
        </div>
      </section>

      <section class="reveal narrow" aria-labelledby="faq" style="margin: 0 auto;">
        <h2 id="faq" class="heading-4">Questions</h2>
        <div class="mt-300">
          {FAQ.map(([q, a]) => (
            <details class="faq">
              <summary class="title-3">{q}</summary>
              <p class="body-6">{a}</p>
            </details>
          ))}
        </div>
      </section>

      <section class="reveal" style="text-align: center;">
        <h2 class="heading-4">Get your semester into your calendar</h2>
        <div class="cta">
          <SignInButton />
          <p class="caption-2 text-secondary">Free. Only touches the events it adds. Delete anytime.</p>
        </div>
      </section>
    </div>
  </Layout>
);

export type SetupValues = { canvas: string; nusmods: string; mode: CalendarMode };
export type SetupErrors = Partial<Record<'canvas' | 'nusmods' | 'form', string>>;

const FieldError: FC<{ id: string; message?: string }> = ({ id, message }) => (
  <p class="field-error caption-2" id={id} hidden={!message} role="alert">
    <Icon name="warningCircle" size={16} />
    <span>{message ?? ''}</span>
  </p>
);

export const Setup: FC<{ user: UserRow; csrf: string; values: SetupValues; errors: SetupErrors; editing: boolean; dev: boolean }> = ({
  user, csrf, values, errors, editing, dev,
}) => {
  const keepCanvas = editing && !!user.canvas_feed_enc;
  return (
    <Layout title="Set up your calendar · Semsync" signedIn noindex>
      <div class="wrap narrow page">
        <h1 class="heading-4">{editing ? 'Update your links' : 'Paste your links'}</h1>
        <p class="lead body-3">You only do this once. Semsync checks them every hour after that.</p>
        {errors.form && (
          <div class="notice notice-error body-6" role="alert"><Icon name="warningCircle" />{errors.form}</div>
        )}
        <form method="post" action="/setup" novalidate data-setup data-keep-canvas={keepCanvas ? '1' : '0'} data-dev={dev ? '1' : '0'}
          data-busy-label={editing ? 'Saving and syncing…' : 'Setting up your calendar…'}>
          <input type="hidden" name="csrf" value={csrf} />
          <div class="field">
            <label class="title-3" for="canvas">Canvas calendar feed</label>
            <p class="hint caption-2" id="canvas-hint">Starts with https://canvas.nus.edu.sg/feeds/calendars/. It works like a password, so it's stored encrypted.</p>
            <input class="input body-3" id="canvas" name="canvas" type="url" inputmode="url" autocomplete="off" spellcheck={false}
              placeholder="https://canvas.nus.edu.sg/feeds/calendars/user_….ics" value={values.canvas}
              aria-describedby="canvas-hint canvas-error" aria-invalid={errors.canvas ? 'true' : undefined} />
            <FieldError id="canvas-error" message={errors.canvas} />
            {keepCanvas && !errors.canvas && <p class="hint caption-2">Leave blank to keep your current link.</p>}
            <details class="help">
              <summary class="caption-1">Where do I find this?</summary>
              <ol class="caption-2">
                <li>Open <a href="https://canvas.nus.edu.sg/calendar" target="_blank" rel="noopener">Canvas Calendar</a>.</li>
                <li>At the bottom of the column on the right, select <b>Calendar Feed</b>.</li>
                <li>Copy the link and paste it here.</li>
              </ol>
            </details>
            {dev && <p class="hint caption-2">Local dev: type <code>sample</code> to use a sample Canvas feed.</p>}
          </div>
          <div class="field">
            <label class="title-3" for="nusmods">NUSMods share link (optional)</label>
            <p class="hint caption-2" id="nusmods-hint">Adds your classes on the right weeks, plus final exam dates.</p>
            <input class="input body-3" id="nusmods" name="nusmods" type="url" inputmode="url" autocomplete="off" spellcheck={false}
              placeholder="https://nusmods.com/timetable/sem-2/share?…" value={values.nusmods}
              aria-describedby="nusmods-hint nusmods-error" aria-invalid={errors.nusmods ? 'true' : undefined} />
            <FieldError id="nusmods-error" message={errors.nusmods} />
            <details class="help">
              <summary class="caption-1">Where do I find this?</summary>
              <ol class="caption-2">
                <li>Open your timetable on <a href="https://nusmods.com/timetable" target="_blank" rel="noopener">NUSMods</a>.</li>
                <li>Select <b>Share/Sync</b> and copy the link.</li>
              </ol>
            </details>
          </div>
          <fieldset class="choices">
            <legend class="title-3">Where should events go?</legend>
            <label class="choice">
              <input type="radio" name="mode" value="main" checked={values.mode === 'main'} />
              <span>
                <span class="title-3">Straight into my Google Calendar</span>
                <span class="hint caption-2">
                  Recommended. You'll allow calendar access next, and deadlines get reminders. Semsync only touches the events it adds.
                  Google may say the app isn't verified yet: choose Advanced, then Go to Semsync.
                </span>
              </span>
            </label>
            <label class="choice">
              <input type="radio" name="mode" value="shared" checked={values.mode === 'shared'} />
              <span>
                <span class="title-3">A separate shared calendar</span>
                <span class="hint caption-2">No calendar permission needed. Shows up as "NUS semester" next to your calendars; you set reminders yourself.</span>
              </span>
            </label>
          </fieldset>
          <div class="actions">
            <button class="btn btn-primary button-md" type="submit">{editing ? 'Save and sync' : 'Continue'}</button>
            {editing && <a class="btn btn-secondary button-md" href="/home">Cancel</a>}
          </div>
        </form>
        <div class="loading-panel" data-loading hidden aria-live="polite">
          <p class="title-3">{editing ? 'Saving and syncing' : 'Setting up your calendar'}</p>
          <p class="caption-2 text-secondary mt-25">This takes a few seconds.</p>
          <ListSkeleton />
        </div>
      </div>
    </Layout>
  );
};

/** Loading state shaped like the "Coming up" list. */
const ListSkeleton: FC = () => (
  <div class="list" aria-hidden="true">
    {[0, 1, 2].map((i) => (
      <>
        {i > 0 && <div class="divider" />}
        <div class="skeleton-row">
          <div class="skeleton" style={`height: 20px; width: ${[60, 45, 52][i]}%;`} />
          <div class="skeleton" style="height: 20px; width: 96px;" />
        </div>
      </>
    ))}
  </div>
);

const KIND_LABEL = { deadline: 'Due', exam: 'Exam', event: 'Event', class: 'Class' } as const;
const KIND_CLASS = { deadline: 'chip-deadline', exam: 'chip-exam', event: 'chip-class', class: 'chip-class' } as const;

function formatWhen(ms: number, allDay: boolean) {
  return new Intl.DateTimeFormat('en-SG', {
    timeZone: 'Asia/Singapore', weekday: 'short', day: 'numeric', month: 'short',
    ...(allDay ? {} : { hour: '2-digit', minute: '2-digit', hour12: false }),
  }).format(ms);
}

function timeAgo(ms: number) {
  const mins = Math.round((Date.now() - ms) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  return hours < 48 ? `${hours} h ago` : `${Math.round(hours / 24)} days ago`;
}

const MainCalendarActions: FC<{ needsConnect: boolean; dev: boolean }> = ({ needsConnect, dev }) =>
  needsConnect ? (
    <>
      <div class="actions">
        <a class="btn btn-primary btn-lg button-lg" href="/connect"><Icon name="calendar" />Connect Google Calendar</a>
        <a class="btn btn-secondary button-md" href="/setup?edit=1">Use a separate calendar instead</a>
      </div>
      <p class="caption-2 text-secondary mt-100">Semsync needs permission to add events to your calendar. It only touches the events it adds.</p>
    </>
  ) : (
    <>
      <div class="actions">
        <a class="btn btn-primary btn-lg button-lg" href={dev ? '/dev/calendar' : 'https://calendar.google.com/calendar/r'} target="_blank" rel="noopener">
          <Icon name="calendar" />Open Google Calendar
        </a>
      </div>
      <p class="caption-2 text-secondary mt-100">
        Deadlines are orange and exams red. You'll get reminders 1 day and 3 hours before each deadline, and 1 week and 1 day before each exam.
      </p>
    </>
  );

const SharedCalendarActions: FC<{ addUrl: string | null }> = ({ addUrl }) => (
  <>
    <div class="actions">
      {addUrl && (
        <a class="btn btn-primary btn-lg button-lg" href={addUrl} target="_blank" rel="noopener"><Icon name="calendar" />Add to Google Calendar</a>
      )}
      <a class="btn btn-secondary button-md" href="https://calendar.google.com/calendar/r/settings" target="_blank" rel="noopener">Set up reminders</a>
    </div>
    <p class="caption-2 text-secondary mt-100">
      Already added? It shows up as "NUS semester" in Google Calendar. For reminders, open it under Settings and add notifications.
    </p>
  </>
);

const UpcomingList: FC<{ upcoming: UpcomingRow[]; failed?: boolean }> = ({ upcoming, failed }) =>
  upcoming.length === 0 && failed ? (
    <div class="list">
      <div class="empty failed">
        <Icon name="warningCircle" size={24} />
        <p class="title-3">Couldn't load your events</p>
        <p class="body-6">The last sync didn't finish. Try Sync now, or check your links.</p>
      </div>
    </div>
  ) : upcoming.length === 0 ? (
    <div class="list">
      <div class="empty">
        <Icon name="checkCircle" size={24} />
        <p class="title-3">Nothing due soon</p>
        <p class="body-6">New Canvas deadlines and exams show up here within the hour.</p>
      </div>
    </div>
  ) : (
    <div class="list">
      {upcoming.map((e, i) => (
        <>
          {i > 0 && <div class="divider" />}
          <div class="row">
            <span class="body-5"><span class={`tag ${KIND_CLASS[e.kind]} caption-4`}>{KIND_LABEL[e.kind]}</span>{e.title}</span>
            <time class="mono caption-2" datetime={new Date(e.start_ms).toISOString()}>{formatWhen(e.start_ms, e.all_day === 1)}</time>
          </div>
        </>
      ))}
    </div>
  );

export const Home: FC<{
  user: UserRow; csrf: string; addUrl: string | null; needsConnect: boolean; counts: Record<string, number>;
  upcoming: UpcomingRow[]; flash?: string; dev: boolean;
}> = ({ user, csrf, addUrl, needsConnect, counts, upcoming, flash, dev }) => {
  const failing = user.last_sync_ok === 0 || needsConnect;
  return (
    <Layout title="Your calendar · Semsync" signedIn current="home" noindex>
      <div class="wrap narrow page">
        <h1 class="heading-4">Your NUS semester calendar</h1>
        <p class="status caption-2">
          <span class={`dot${failing ? ' bad' : ''}`} aria-hidden="true" />
          <span>{needsConnect ? 'Not syncing' : user.last_sync_at ? `Synced ${timeAgo(user.last_sync_at)}` : 'Not synced yet'}</span>
          <span>·</span>
          <span>{user.mode === 'main' ? `${user.email}'s Google Calendar` : `Shared with ${user.email}`}</span>
        </p>
        {flash && <div class="notice notice-success body-6" role="status"><Icon name="checkCircle" />{flash}</div>}
        {user.last_sync_message && (
          <div class={`notice ${user.last_sync_ok === 0 ? 'notice-error' : 'notice-warning'} body-6`} role="status">
            <Icon name="warningCircle" />{user.last_sync_message}
          </div>
        )}

        {user.mode === 'main' ? <MainCalendarActions needsConnect={needsConnect} dev={dev} /> : <SharedCalendarActions addUrl={addUrl} />}

        <div class="stat-bar">
          <div class="stat"><b class="heading-5 mono">{counts.deadline ?? 0}</b><span class="caption-2">deadlines</span></div>
          <div class="vdivider" />
          <div class="stat"><b class="heading-5 mono">{counts.class ?? 0}</b><span class="caption-2">classes</span></div>
          <div class="vdivider" />
          <div class="stat"><b class="heading-5 mono">{counts.exam ?? 0}</b><span class="caption-2">exams</span></div>
        </div>

        <h2 class="heading-6 mt-400">Coming up</h2>
        <UpcomingList upcoming={upcoming} failed={failing} />

        <div class="actions">
          <form method="post" action="/sync" data-busy-label="Syncing…">
            <input type="hidden" name="csrf" value={csrf} />
            <button class="btn btn-secondary button-md" type="submit"><Icon name="arrowsClockwise" />Sync now</button>
          </form>
          <a class="btn btn-secondary button-md" href="/setup?edit=1">Change links</a>
          {dev && <a class="btn btn-tertiary button-md" href="/dev/calendar">View fake calendar</a>}
          <form method="post" action="/auth/logout">
            <input type="hidden" name="csrf" value={csrf} />
            <button class="btn btn-tertiary button-md" type="submit">Sign out</button>
          </form>
        </div>

        <div class="danger-zone">
          <h2 class="heading-6">Delete your data</h2>
          <p class="caption-2 text-secondary mt-50">
            {user.mode === 'main'
              ? 'Removes every event Semsync added to your calendar, revokes its access, and deletes everything it stores about you. Your own events stay.'
              : 'Removes the "NUS semester" calendar and everything Semsync stores about you. Your own calendar isn\'t touched.'}
          </p>
          <form method="post" action="/account/delete" data-busy-label="Deleting…">
            <input type="hidden" name="csrf" value={csrf} />
            <label class="check body-6"><input type="checkbox" name="confirm" value="yes" required />I understand this can't be undone</label>
            <div class="actions" style="margin-top: var(--space-200);">
              <button class="btn btn-error button-md" type="submit">Delete my data</button>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
};

export const Message: FC<{ title: string; body: Child; signedIn?: boolean; action?: { href: string; label: string } }> = ({
  title, body, signedIn, action,
}) => (
  <Layout title={`${title} · Semsync`} signedIn={signedIn} noindex>
    <div class="wrap narrow page">
      <h1 class="heading-4">{title}</h1>
      <p class="lead body-3">{body}</p>
      {action && <div class="actions"><a class="btn btn-primary button-md" href={action.href}>{action.label}</a></div>}
    </div>
  </Layout>
);

export const NotFound: FC<{ signedIn?: boolean }> = ({ signedIn }) => (
  <Message title="Page not found" body="That page doesn't exist. It may have moved." signedIn={signedIn} action={{ href: '/', label: 'Go to Semsync' }} />
);

export const Privacy: FC<{ signedIn?: boolean; origin?: string }> = ({ signedIn, origin }) => (
  <Layout title="Privacy · Semsync" current="privacy" signedIn={signedIn} origin={origin}>
    <div class="wrap narrow page prose">
      <h1 class="heading-4">Privacy</h1>
      <p class="lead body-3">Semsync is a student project. This page explains, in plain words, what it stores and why.</p>
      <h2 class="heading-6">What Semsync stores</h2>
      <ul class="body-3">
        <li>Your Google account ID, name and email address, from "Continue with Google".</li>
        <li>If you put events in your own calendar: a Google access token that lets Semsync manage events in calendars you own, encrypted.</li>
        <li>Your Canvas calendar feed link, encrypted.</li>
        <li>Your NUSMods share link, if you add one.</li>
        <li>A list of the events it has added for you (title, type and start time), so each sync only sends changes.</li>
      </ul>
      <h2 class="heading-6">What Semsync does with calendar access</h2>
      <p class="body-3">
        Google's permission is called "See, create, change, and delete events on Google calendars you own". Semsync uses it only to add your
        deadlines, classes and exams to your main calendar, and to update or remove those same events. Each one is tagged and says
        "Added by Semsync". It never reads, changes or deletes your other events.
      </p>
      <p class="body-3">
        If you pick the separate shared calendar instead, Semsync gets no calendar permission at all: it creates "NUS semester" in its own
        Google account and shares it with you, so you can view it but not edit it.
      </p>
      <h2 class="heading-6">What Semsync can't see</h2>
      <p class="body-3">Your Gmail, Drive or Canvas password. It reads only the calendar feed Canvas gives you, and public course data from NUSMods.</p>
      <h2 class="heading-6">Where data lives</h2>
      <p class="body-3">
        Semsync runs on Vercel and stores data in a Supabase database, both in Singapore. Google user data is used only to provide this
        feature. Nothing is sold, used for ads, or shared with anyone else.
      </p>
      <h2 class="heading-6">Deleting your data</h2>
      <p class="body-3">
        Use "Delete my data" on your Semsync page. It removes every event Semsync added, revokes its Google access, and deletes every record
        about you straight away. You can also remove Semsync's access any time at myaccount.google.com/permissions.
      </p>
      <h2 class="heading-6">Contact</h2>
      <p class="body-3">Questions or requests: {'{{contact email}}'}.</p>
    </div>
  </Layout>
);

export const Terms: FC<{ signedIn?: boolean; origin?: string }> = ({ signedIn, origin }) => (
  <Layout title="Terms · Semsync" current="terms" signedIn={signedIn} origin={origin}>
    <div class="wrap narrow page prose">
      <h1 class="heading-4">Terms</h1>
      <p class="lead body-3">The short version: Semsync is a free student project that helps, but Canvas is still the final word.</p>
      <h2 class="heading-6">Always check Canvas</h2>
      <p class="body-3">
        Semsync copies deadlines from Canvas and timetables from NUSMods, but it can be late, wrong or offline. Canvas, NUSMods and
        your instructors are the source of truth. Check them before anything that matters.
      </p>
      <h2 class="heading-6">Use your own accounts</h2>
      <p class="body-3">Connect only your own Google account, Canvas link and timetable. Don't use Semsync to reach anyone else's data.</p>
      <h2 class="heading-6">No warranty</h2>
      <p class="body-3">
        Semsync is provided as is, with no warranty. Its maker isn't responsible for missed deadlines or other losses from using it.
      </p>
      <h2 class="heading-6">Changes</h2>
      <p class="body-3">
        Semsync may change or stop at any time. You can delete your data whenever you like from your Semsync page, and the{' '}
        <a href="/privacy">privacy page</a> explains what is stored.
      </p>
      <h2 class="heading-6">Contact</h2>
      <p class="body-3">Questions: {'{{contact email}}'}.</p>
    </div>
  </Layout>
);

/** 1200 × 630 card, screenshotted into public/og.png for link previews (see README). */
export const OgCard: FC = () => (
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <link href={FONTS} rel="stylesheet" />
      <style>{raw(`${CSS}\nhtml, body { width: 1200px; height: 630px; overflow: hidden; }`)}</style>
    </head>
    <body class="mode-dark" style="background: var(--surface-primary); color: var(--text-primary);">
      <div style="padding: var(--space-800); display: flex; flex-direction: column; height: 630px;">
        <div class="brand title-1"><span class="brand-mark" style="width: 40px; height: 40px; border-radius: var(--radius-8);"><Icon name="calendar" size={24} /></span>Semsync</div>
        <h1 class="heading-2 hero-title" style="margin: var(--space-500) 0 0; max-width: 960px;">
          Every Canvas deadline in your calendar,<br /> without typing a thing
        </h1>
        <p class="body-7 text-secondary mt-300">Canvas deadlines, NUSMods classes and exams, kept up to date in Google Calendar.</p>
        <div style="display: flex; gap: var(--space-200); margin-top: auto;">
          <Chip large kind="class" title="CS2040 Lecture" time="Thu 09:00" />
          <Chip large kind="deadline" title="[CS2040] Problem Set 5" time="Fri 23:59" />
          <Chip large kind="exam" title="CS2040 final exam" time="Tue 24 Nov 09:00" />
        </div>
      </div>
    </body>
  </html>
);

const BUTTON_TYPES = ['primary', 'secondary', 'tertiary', 'error', 'warning'] as const;
const STATES = ['Default', 'Hover', 'Pressed', 'Focus', 'Disabled'] as const;
const stateClass = (s: (typeof STATES)[number]) => ({ Default: '', Hover: 'is-hover', Pressed: 'is-pressed', Focus: 'is-focus', Disabled: '' })[s];

const SIZES = [
  { name: 'Large', cls: 'btn-lg button-lg' },
  { name: 'Medium', cls: 'button-md' },
  { name: 'Small', cls: 'btn-sm button-sm' },
] as const;

const ComponentSheet: FC<{ mode: string }> = ({ mode }) => (
  <div class="spec">
    {SIZES.map((size) => (
      <div>
        <p class="title-4">Buttons, {size.name.toLowerCase()}: type × state</p>
        <div class="state-grid mt-75">
          {STATES.map((s) => <span class="caption-5 text-secondary">{s}</span>)}
          {BUTTON_TYPES.map((t) =>
            STATES.map((s) => (
              <button class={`btn btn-${t} ${size.cls} ${stateClass(s)}`} type="button" disabled={s === 'Disabled'}>{t[0].toUpperCase() + t.slice(1)}</button>
            )),
          )}
        </div>
      </div>
    ))}
    <div>
      <p class="title-4">Inputs: default, hover, pressed, focus, filled, error, disabled</p>
      <input class="input body-3" placeholder="Default" aria-label="Default" />
      <input class="input body-3 is-hover" placeholder="Hover" aria-label="Hover" />
      <input class="input body-3 is-pressed" placeholder="Pressed" aria-label="Pressed" />
      <input class="input body-3 is-focus" placeholder="Focus" aria-label="Focus" />
      <input class="input body-3" value="https://canvas.nus.edu.sg/feeds/calendars/user_x.ics" aria-label="Filled" />
      <input class="input body-3" value="https://canvas.nus.edu.sg/calendar" aria-invalid="true" aria-label="Error" />
      <FieldError id={`sheet-error-${mode}`} message="That isn't a Canvas calendar feed link. It should end in .ics." />
      <input class="input body-3" placeholder="Disabled" aria-label="Disabled" disabled />
    </div>
    <div>
      <p class="title-4">Choice cards: state, selected or not</p>
      <fieldset class="choices" style="margin-top: var(--space-75);">
        {STATES.map((s) => (
          <label class={`choice ${stateClass(s)}`}>
            <input type="radio" name={`sheet-choice-${mode}-${s}`} checked={s === 'Default'} disabled={s === 'Disabled'} />
            <span><span class="title-3">{s}{s === 'Default' ? ', selected' : ''}</span><span class="hint caption-2">Separate shared calendar.</span></span>
          </label>
        ))}
      </fieldset>
    </div>
    <div>
      <p class="title-4">Notices</p>
      <div class="notice notice-success body-6"><Icon name="checkCircle" />Synced.</div>
      <div class="notice notice-warning body-6" style="margin-top: var(--space-75);"><Icon name="warningCircle" />2 more changes will go through on the next sync.</div>
      <div class="notice notice-error body-6" style="margin-top: var(--space-75);"><Icon name="warningCircle" />Canvas rejected your feed link.</div>
      <div class="notice notice-info body-6" style="margin-top: var(--space-75);"><Icon name="calendar" />Your calendar is ready.</div>
    </div>
    <div>
      <p class="title-4">Chips</p>
      <div class="spec-row mt-75">
        <Chip kind="class" title="CS2040 Lecture" time="09:00" />
        <Chip kind="deadline" title="[CS2040] PS5" time="23:59" />
        <Chip kind="exam" title="CS2040 final exam" time="09:00" />
      </div>
    </div>
    <div>
      <p class="title-4">List: loading, empty, error, filled</p>
      <ListSkeleton />
      <UpcomingList upcoming={[]} />
      <UpcomingList upcoming={[]} failed />
      <UpcomingList upcoming={[
        { title: '[CS2040] Problem Set 5', kind: 'deadline', start_ms: Date.parse('2026-11-06T15:59:00Z'), all_day: 0 },
        { title: 'CS2040 final exam', kind: 'exam', start_ms: Date.parse('2026-11-24T01:00:00Z'), all_day: 0 },
      ]} />
    </div>
  </div>
);

/** Every token and component state, generated from tokens.ts: the code version of a Figma "Foundations" frame. */
export const Foundations: FC<{ section?: string }> = ({ section }) => (
  <Layout title="Foundations · Semsync" noindex>
    <div class="wrap page">
      <h1 class="heading-4">Foundations</h1>
      <p class="lead body-3">Every token and component state in Semsync, generated from src/views/tokens.ts.</p>
      {section === 'components' ? <Components /> : <><Tokens /><Components /></>}
    </div>
  </Layout>
);

const Components: FC = () => (
  <>
    <h2 class="heading-6 mt-600" id="components">Components, in both modes</h2>
    <div class="panels">
      <div class="mode-panel mode-light"><p class="title-3">Light</p><div class="mt-200"><ComponentSheet mode="light" /></div></div>
      <div class="mode-panel mode-dark"><p class="title-3">Dark</p><div class="mt-200"><ComponentSheet mode="dark" /></div></div>
    </div>
  </>
);

const Tokens: FC = () => (
  <>
      <h2 class="heading-6 mt-600">Core Colors</h2>
      {Object.entries(CORE).map(([p, shades]) => (
        <div class="mt-200">
          <p class="title-4">{p}</p>
          <div class="swatches">
            {Object.entries(shades).sort(([a], [b]) => parseFloat(a) - parseFloat(b) || a.localeCompare(b)).map(([s, hex]) => (
              <div class="swatch">
                <div class="swatch-chip" style={`background: var(--${p}-${s});`} />
                <span class="caption-4">{s}</span>
                <span class="caption-5 mono text-secondary">{hex}</span>
              </div>
            ))}
          </div>
        </div>
      ))}

      <h2 class="heading-6 mt-600">Color System</h2>
      <p class="caption-2 text-secondary mt-50">
        The figma-designer skill's standard set. Dark uses the skill's aliases and Light mirrors them, except where a note
        says why not.
      </p>
      {['border', 'surface', 'action', 'text', 'icon', 'overlay'].map((group) => (
        <>
          <p class="title-4 mt-300">{group[0].toUpperCase() + group.slice(1)}</p>
          <div class="token-row caption-4 text-secondary"><span>Token</span><span>Light</span><span>Dark</span><span>Note</span></div>
          {Object.entries(SYSTEM).filter(([name]) => name.startsWith(`${group}-`)).map(([name, t]) => {
            const spec = SYSTEM_SPEC[name];
            const note = [
              spec.added && `Added: ${spec.added}`,
              spec.dark && `Dark: skill says ${spec.ref.join('/')}. ${spec.darkWhy}`,
              spec.light && `Light: ${spec.lightWhy}`,
            ].filter(Boolean);
            return (
              <>
                <div class="divider" />
                <div class="token-row">
                  <span class="caption-4 mono" style="overflow-wrap: anywhere;">{name}</span>
                  {(['light', 'dark'] as const).map((mode) => (
                    <div class={`token-cell mode-${mode}`} style="background: var(--surface-primary); color: var(--text-primary);">
                      <div class="swatch-chip" style={`background: var(--${name});`} />
                      <span class="caption-5 mono">{t[mode][0]}/{t[mode][1]}</span>
                    </div>
                  ))}
                  <span class="caption-5 text-secondary">{note.join(' ')}</span>
                </div>
              </>
            );
          })}
        </>
      ))}

      <h2 class="heading-6 mt-600">Spacing</h2>
      {Object.entries(SPACING).map(([k, v]) => (
        <div class="token-row" style="grid-template-columns: 120px minmax(0, 1fr);">
          <span class="caption-4 mono">space/{k} · {v}</span>
          <div class="spacing-bar" style={`width: var(--space-${k});`} />
        </div>
      ))}

      <h2 class="heading-6 mt-600">Radius</h2>
      <div class="spec-row mt-200">
        {Object.entries(RADIUS).map(([k]) => (
          <div class="swatch">
            <div class="radius-sample" style={`border-radius: var(--radius-${k});`} />
            <span class="caption-5 mono">radius/{k}</span>
          </div>
        ))}
      </div>

      <h2 class="heading-6 mt-600">Text styles</h2>
      {Object.entries(TEXT_STYLES).map(([name, s]) => (
        <div class="spec-row mt-200">
          <span class={name}>Your NUS semester</span>
          <span class="caption-5 mono text-secondary">{name} · {s.size}/{s.line} · {s.weight}</span>
        </div>
      ))}
  </>
);

export const DevLogin: FC = () => (
  <Layout title="Dev sign in · Semsync" noindex>
    <div class="wrap narrow page">
      <h1 class="heading-4">Dev sign in</h1>
      <p class="lead body-3">Local development only. Pretends you signed in with Google as this email.</p>
      <form method="post" action="/auth/dev">
        <div class="field">
          <label class="title-3" for="email">Email</label>
          <input class="input body-3" id="email" name="email" type="email" required value="student@example.com" />
        </div>
        <div class="actions"><button class="btn btn-primary button-md" type="submit">Sign in</button></div>
      </form>
    </div>
  </Layout>
);

export const DevCalendar: FC<{ label: string; events: { summary: string; start: string; status: string; reminders: number[] }[] }> = ({
  label, events,
}) => (
  <Layout title="Fake calendar · Semsync" signedIn noindex>
    <div class="wrap narrow page">
      <h1 class="heading-4">Fake Google Calendar</h1>
      <p class="lead body-3">{label} · {events.filter((e) => e.status !== 'cancelled').length} events</p>
      <div class="list">
        {events.map((e, i) => (
          <>
            {i > 0 && <div class="divider" />}
            <div class="row body-6" style={e.status === 'cancelled' ? 'opacity: 0.5; text-decoration: line-through;' : ''}>
              <span>
                {e.summary}
                {e.reminders.length > 0 && <span class="caption-5 text-secondary"> · reminders {e.reminders.map((m) => `${m / 60}h`).join(', ')} before</span>}
              </span>
              <time class="mono caption-2">{e.start}</time>
            </div>
          </>
        ))}
      </div>
    </div>
  </Layout>
);
