import type { Child, FC, PropsWithChildren } from 'hono/jsx';
import { raw } from 'hono/html';
import { TESTIMONIAL, semesterWeek } from '../config.js';
import type { UpcomingRow, UserRow } from '../lib/db.js';
import type { CalendarMode } from '../lib/events.js';
import { parseNusmodsLink } from '../lib/nusmods.js';
import { CanvasMark, GoogleMark, Icon, NusmodsMark } from './icons.js';
import { CSS, SCRIPT, THEME_INIT } from './styles.js';
import { CORE, RADIUS, SPACING, SYSTEM, SYSTEM_SPEC, TEXT_STYLES } from './tokens.js';

const FAVICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%230297de'/%3E%3Cpath d='M9 12h14M9 17h9M9 22h6' stroke='white' stroke-width='2.5' stroke-linecap='round'/%3E%3C/svg%3E";

const FONTS = 'https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Geist+Mono:wght@500&display=swap';

type LayoutProps = PropsWithChildren<{
  title: string; description?: string; current?: string; signedIn?: boolean; noindex?: boolean; origin?: string;
  /** The longer title for link previews and search results, when the browser tab shows a short one. */
  socialTitle?: string;
  /** Hide the nav's "Sign in" where the page's own call to action does the same thing (one action above the fold). */
  navCta?: boolean;
  /** Signed in but not set up yet, so there's no calendar page to go to: the nav leads to setup instead. */
  setupPending?: boolean;
  /** Who's signed in, for the account menu (sign out, delete). Pages without a CSRF token at hand leave it out. */
  account?: Account;
  head?: Child;
}>;

type Account = { email: string; name: string | null; csrf: string };

/** Your initial in the nav, opening a small menu: who you're signed in as, Sign out, and Delete my data. It's an
 *  HTML popover, so it opens and closes without JavaScript; the script only places it under the button. */
const AccountMenu: FC<{ account: Account }> = ({ account }) => (
  <>
    <button class="avatar" type="button" popovertarget="account-menu" aria-label={`Account menu for ${account.email}`}>
      <span class="title-4">{(account.name || account.email).trim().charAt(0).toUpperCase()}</span>
    </button>
    <div class="account-menu" id="account-menu" popover="auto">
      <p class="caption-2 text-secondary">Signed in as</p>
      <p class="body-5 account-email">{account.email}</p>
      <div class="divider menu-divider" />
      <form method="post" action="/auth/logout">
        <input type="hidden" name="csrf" value={account.csrf} />
        <button class="menu-item body-5" type="submit"><Icon name="signOut" size={18} />Sign out</button>
      </form>
      <a class="menu-item body-5 danger-link" href="/account/delete" data-confirm="delete-dialog"><Icon name="trash" size={18} />Delete my data</a>
    </div>
  </>
);

export const Layout: FC<LayoutProps> = ({
  title, description, current, signedIn, noindex, origin, socialTitle, navCta = true, setupPending, account, head, children,
}) => {
  const desc = description ?? 'Canvas deadlines, NUSMods classes and exams in your Google Calendar, kept up to date.';
  const section = (id: string) => (current === 'landing' ? `#${id}` : `/#${id}`);
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <script>{raw(THEME_INIT)}</script>
        <title>{title}</title>
        <meta name="description" content={desc} />
        <meta property="og:title" content={socialTitle ?? title} />
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
          <div class="nav-bar">
            <a class="brand title-3" href="/" aria-current={current === 'landing' ? 'page' : undefined}>
              <span class="brand-mark"><Icon name="calendar" size={16} /></span>Semsync
            </a>
            <div class="nav-links">
              {signedIn && setupPending ? (
                <a class="nav-link title-4" href="/setup" aria-current={current === 'setup' ? 'page' : undefined}>Finish setup</a>
              ) : signedIn ? (
                <a class="nav-link title-4" href="/home" aria-current={current === 'home' ? 'page' : undefined}>Your calendar</a>
              ) : (
                <>
                  <a class="nav-link section-link title-4" href={section('how')}>How it works</a>
                  <a class="nav-link section-link title-4" href={section('faq')}>Questions</a>
                </>
              )}
              <button class="theme-toggle" type="button" data-theme-toggle aria-label="Switch between light and dark mode">
                <Icon name="moon" cls="icon-moon" />
                <Icon name="sun" cls="icon-sun" />
              </button>
              {account && <AccountMenu account={account} />}
              {!signedIn && navCta && <a class="btn btn-secondary button-sm" href="/auth/google">Sign in</a>}
            </div>
          </div>
        </nav>
        <main id="main">{children}</main>
        <footer class="wrap">
          <div class="divider" />
          <div class="footer-row caption-2">
            <span>Made by an NUS student. Not affiliated with NUS, NUSMods or Instructure.</span>
            <span class="footer-links">
              <a href="/" aria-current={current === 'landing' ? 'page' : undefined}>Home</a>
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

/** The way back from a plain page: to your Semsync page if you have one, otherwise home. */
const BackLink: FC<{ signedIn?: boolean }> = ({ signedIn }) => (
  <a class="back title-4" href={signedIn ? '/home' : '/'}>
    <Icon name="arrowLeft" size={16} />{signedIn ? 'Back to your calendar' : 'Back to Semsync'}
  </a>
);

/** Whether the user has anything set up yet, so /home has something to show. */
const isSetUp = (user: UserRow) => !!(user.calendar_id || user.canvas_feed_enc || user.nusmods_link);

const SignInButton: FC = () => (
  <a class="btn btn-primary btn-lg btn-signin button-lg" href="/auth/google">
    <span class="g-badge"><GoogleMark /></span>Continue with Google
  </a>
);

/** In place of "Continue with Google" for someone already signed in who hasn't finished setup. */
const ContinueSetupButton: FC = () => (
  <a class="btn btn-primary btn-lg button-lg" href="/setup">Continue setup<Icon name="arrowRight" /></a>
);

// --- Where to find your links: a short walkthrough that clicks through Canvas and NUSMods by itself ---

type GuideKind = 'canvas' | 'nusmods';
const GUIDE: Record<GuideKind, { steps: [string, string][]; open: [string, string]; label: string }> = {
  canvas: {
    steps: [
      ['Open Calendar in Canvas', "It's in the menu on the left."],
      ['Select Calendar Feed', 'At the bottom of the column on the right.'],
      ['Copy the link', 'It ends in .ics. Paste it into Semsync.'],
    ],
    open: ['https://canvas.nus.edu.sg/calendar', 'Open Canvas Calendar'],
    label: 'Canvas Calendar, with Calendar Feed at the bottom of the right column, and the feed link it shows',
  },
  nusmods: {
    steps: [
      ['Open your timetable on NUSMods', 'The semester with your classes in it.'],
      ['Select Share/Sync', "It's just above your timetable."],
      ['Copy the full link', 'It starts with nusmods.com/timetable. Paste it into Semsync.'],
    ],
    open: ['https://nusmods.com/timetable', 'Open NUSMods'],
    label: 'A NUSMods timetable, with the Share/Sync button above it, and the share link it shows',
  },
};

const ScreenBar: FC<{ url: string }> = ({ url }) => (
  <div class="gs-bar">
    <span class="gs-dots" aria-hidden="true"><i /><i /><i /></span>
    <span class="gs-url caption-5 mono">{url}</span>
  </div>
);

const Copied: FC = () => <span class="gs-copied caption-4"><Icon name="check" size={12} />Copied</span>;

// Which days of the month have something on, for the little Canvas month view: [cell, colour].
const MONTH_MARKS: [number, string][] = [[3, 'a'], [8, 'b'], [10, 'a'], [16, 'b'], [17, 'a'], [22, 'b'], [24, 'a'], [29, 'b']];

const CanvasScreen: FC = () => (
  <>
    <ScreenBar url="canvas.nus.edu.sg/calendar" />
    <div class="gs-body gs-canvas">
      <div class="gs-rail">
        <span class="gs-rail-item"><i /></span>
        <span class="gs-rail-item"><i /></span>
        <span class="gs-rail-item"><i /></span>
        <span class="gs-rail-item is-target" data-target="0"><Icon name="calendar" size={16} /></span>
      </div>
      <div class="gs-main">
        <p class="caption-4">November 2026</p>
        <div class="gs-month">
          {Array.from({ length: 35 }, (_, i) => {
            const mark = MONTH_MARKS.find(([n]) => n === i);
            return <span class="gs-cell">{mark && <i class={`gs-mark-${mark[1]}`} />}</span>;
          })}
        </div>
      </div>
      <div class="gs-side">
        <div class="gs-mini">{Array.from({ length: 21 }, () => <i />)}</div>
        <p class="caption-5 text-secondary">Calendars</p>
        <span class="gs-line"><i class="gs-mark-a" /></span>
        <span class="gs-line"><i class="gs-mark-b" /></span>
        <span class="gs-link caption-4 is-target" data-target="1">Calendar Feed</span>
      </div>
    </div>
    <div class="gs-dialog">
      <p class="caption-3">Calendar Feed</p>
      <div class="gs-field is-target" data-target="2"><span class="caption-5 mono">https://canvas.nus.edu.sg/feeds/calendars/user_8Fq2kZ.ics</span></div>
      <Copied />
    </div>
  </>
);

// A week of NUSMods blocks: [day row, start column, length, colour].
const TIMETABLE: [number, number, number, string][] = [
  [0, 1, 2, 'a'], [0, 5, 2, 'b'], [1, 0, 2, 'c'], [1, 4, 1, 'a'], [2, 1, 2, 'b'], [3, 0, 1, 'c'], [3, 3, 2, 'a'], [4, 2, 2, 'c'],
];

const NusmodsScreen: FC = () => (
  <>
    <ScreenBar url="nusmods.com/timetable/sem-1" />
    <div class="gs-body gs-nusmods">
      <div class="gs-tabs">
        <span class="caption-4 text-secondary">Today</span>
        <span class="caption-4 gs-tab-on is-target" data-target="0">Timetable</span>
        <span class="caption-4 text-secondary">Courses</span>
      </div>
      <div class="gs-tools">
        <span class="gs-tool caption-4">Download</span>
        <span class="gs-tool caption-4 is-target" data-target="1">Share/Sync</span>
      </div>
      <div class="gs-week">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((d, row) => (
          <div class="gs-day">
            <span class="caption-5 text-secondary">{d}</span>
            <div class="gs-slots">
              {TIMETABLE.filter(([r]) => r === row).map(([, col, len, c]) => (
                <i class={`gs-mark-${c}`} style={`grid-column: ${col + 1} / span ${len};`} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
    <div class="gs-dialog">
      <p class="caption-3">Share/Sync</p>
      <div class="gs-share">
        <div class="gs-field"><span class="caption-5 mono">https://nusmods.com/timetable/sem-1/share?CS2040=LEC:1;TUT:05</span></div>
        <span class="gs-copy caption-4 is-target" data-target="2"><Icon name="copy" size={12} />Copy</span>
      </div>
      <Copied />
    </div>
  </>
);

/** The steps on one side, a little screen acting them out on the other. Without JavaScript it's the numbered steps. */
const Guide: FC<{ kind: GuideKind; compact?: boolean }> = ({ kind, compact }) => {
  const g = GUIDE[kind];
  return (
    <div class={`guide${compact ? ' compact' : ''}`} data-guide data-at="0">
      <div>
        <ol class="guide-steps">
          {g.steps.map(([title, detail], i) => (
            <li>
              <button class="guide-step" type="button" data-go={i} aria-current={i === 0 ? 'step' : undefined}>
                <span class="step-no title-4">{i + 1}</span>
                <span><span class="title-3 guide-title">{title}</span><span class="caption-2 text-secondary guide-detail">{detail}</span></span>
                <span class="guide-progress" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ol>
        <a class="guide-open title-4" href={g.open[0]} target="_blank" rel="noopener">{g.open[1]}<Icon name="arrowRight" size={16} /></a>
      </div>
      <div class={`guide-screen gs-${kind}-screen`} role="img" aria-label={g.label}>
        {kind === 'canvas' ? <CanvasScreen /> : <NusmodsScreen />}
        <span class="gs-cursor" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 20 20"><path d="M3 2l13 7.5-5.6 1.4L7.6 17z" /></svg>
        </span>
      </div>
    </div>
  );
};

/** Canvas and NUSMods side by side as tabs, with each walkthrough in its own panel. */
const LinkGuides: FC = () => (
  <div class="guides" data-tabs>
    <div class="tabs" role="tablist" aria-label="Which link">
      <button class="tab title-4" type="button" role="tab" id="tab-canvas" aria-controls="panel-canvas" aria-selected="true">
        <Icon name="graduationCap" size={16} />Canvas feed
      </button>
      <button class="tab title-4" type="button" role="tab" id="tab-nusmods" aria-controls="panel-nusmods" aria-selected="false" tabindex={-1}>
        <Icon name="calendarDots" size={16} />NUSMods link
      </button>
    </div>
    <div class="tab-panel" role="tabpanel" id="panel-canvas" aria-labelledby="tab-canvas"><Guide kind="canvas" /></div>
    <div class="tab-panel" role="tabpanel" id="panel-nusmods" aria-labelledby="tab-nusmods"><Guide kind="nusmods" /></div>
  </div>
);

/** Proof beside the claim: a real testimonial once there is one, otherwise what Semsync works with (both true). */
const Proof: FC = () =>
  TESTIMONIAL ? (
    <figure class="proof" style="margin-left: auto; margin-right: auto;">
      <blockquote class="body-3">"{TESTIMONIAL.quote}"</blockquote>
      <figcaption class="caption-2">{TESTIMONIAL.name}, {TESTIMONIAL.detail}</figcaption>
    </figure>
  ) : (
    <p class="flow" aria-label="Works with Canvas and NUSMods, into Google Calendar">
      <span class="flow-item"><span class="flow-icon flow-logo"><CanvasMark size={22} /></span><span class="title-3">Canvas</span></span>
      <span class="flow-plus title-3" aria-hidden="true">+</span>
      <span class="flow-item"><span class="flow-icon flow-logo"><NusmodsMark size={22} /></span><span class="title-3">NUSMods</span></span>
      <span class="flow-arrow" aria-hidden="true"><Icon name="arrowRight" size={20} /></span>
      <span class="flow-item flow-dest"><span class="flow-icon"><Icon name="calendarCheck" size={18} /></span><span class="title-3">Google Calendar</span></span>
    </p>
  );

// The hero picture: Week 12 of Semester 1 (2 to 6 Nov 2026) as Semsync puts it in Google Calendar.
const DAYS = [['Mon', '2'], ['Tue', '3'], ['Wed', '4'], ['Thu', '5'], ['Fri', '6']] as const;
const TODAY = 4;
const FIRST_HOUR = 9;
const HOURS = Array.from({ length: 9 }, (_, i) => FIRST_HOUR + i);
const CLASSES = [
  { day: 1, from: 10, to: 11, title: 'CS2040 Tutorial 05' },
  { day: 2, from: 9, to: 11, title: 'ES2660 Sectional G01' },
  { day: 2, from: 14, to: 16, title: 'MA1521 Lecture' },
  { day: 3, from: 10, to: 12, title: 'CS2040 Lecture' },
  { day: 4, from: 9, to: 10, title: 'MA1521 Tutorial T12' },
  { day: 4, from: 16, to: 18, title: 'CS2040 Lab 4A' },
  { day: 5, from: 9, to: 11, title: 'ES2660 Sectional G01' },
];
const DUE = [{ day: 1, title: '[UTC2402] Reflection 2' }, { day: 5, title: '[CS2040] Problem Set 5' }];
const hourRow = (h: number) => 3 + h - FIRST_HOUR;
const pad = (h: number) => `${String(h).padStart(2, '0')}:00`;
// Every event in the order it drops in on load: day by day, top to bottom.
const EVENTS = [
  ...DUE.map((d) => ({ day: d.day, row: 2, span: 1, kind: 'deadline', title: d.title, time: '23:59' })),
  ...CLASSES.map((c) => ({ day: c.day, row: hourRow(c.from), span: c.to - c.from, kind: 'class', title: c.title, time: pad(c.from) })),
].sort((a, b) => a.day - b.day || a.row - b.row);

const Showcase: FC = () => (
  <div class="showcase" role="img" aria-label="A week in Google Calendar with classes from NUSMods, Canvas deadlines, and a Semsync reminder">
    <div class="cal">
      <div class="cal-head">
        <div>
          <p class="title-3">November 2026</p>
          <p class="caption-5 text-secondary">Week 12 · Semester 1</p>
        </div>
        <div class="cal-legend">
          <span class="chip chip-class caption-4">Class</span>
          <span class="chip chip-deadline caption-4">Deadline</span>
          <span class="chip chip-exam caption-4">Exam</span>
        </div>
      </div>
      <div class="divider" />
      <div class="cal-grid">
        <div class="cal-day" style="grid-column: 1; grid-row: 1;" />
        {DAYS.map(([name, date], i) => (
          <div class={`cal-day c${i + 1}`} style="grid-row: 1;">
            <span class="caption-4">{name}</span>
            <span class={`cal-date title-3${i + 1 === TODAY ? ' today' : ''}`}>{date}</span>
          </div>
        ))}
        <div class="cal-time caption-5" style="grid-column: 1; grid-row: 2;">Due</div>
        {DAYS.map((_, i) => <div class={`cell c${i + 1}`} style="grid-row: 2; min-height: var(--space-600);" />)}
        {HOURS.map((h) => (
          <>
            <div class="cal-time caption-5 mono" style={`grid-column: 1; grid-row: ${hourRow(h)};`}>{pad(h)}</div>
            {DAYS.map((_, i) => <div class={`cell c${i + 1}`} style={`grid-row: ${hourRow(h)};`} />)}
          </>
        ))}
        {EVENTS.map((e, i) => (
          <div class={`ev chip-${e.kind} c${e.day}`} style={`grid-row: ${e.row} / span ${e.span}; --i: ${i};`}>
            <span class="caption-3">{e.title}</span>
            <span class="caption-5 mono">{e.time}</span>
          </div>
        ))}
      </div>
    </div>
    <div class="toast" style={`--i: ${EVENTS.length + 2};`}>
      <span class="toast-icon"><Icon name="bell" size={20} /></span>
      <div>
        <p class="title-4">[CS2040] Problem Set 5 is due tonight</p>
        <p class="caption-5">Semsync reminder · 23:59, in 3 hours</p>
      </div>
    </div>
  </div>
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

export const Landing: FC<{ origin?: string; pendingSetup?: boolean }> = ({ origin, pendingSetup }) => (
  <Layout title="Semsync" socialTitle="Semsync: your NUS semester in Google Calendar" origin={origin} current="landing" navCta={false}
    signedIn={pendingSetup} setupPending={pendingSetup} head={faqSchema(FAQ)}>
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
          {pendingSetup ? <ContinueSetupButton /> : <SignInButton />}
          <p class="caption-2 text-secondary">Free. Only touches the events it adds. Delete anytime.</p>
        </div>
        <Proof />
        <Showcase />
      </header>

      <section class="reveal" aria-labelledby="what">
        <div class="section-head">
          <h2 id="what" class="heading-2 section-title">Your whole semester, sorted</h2>
          <p class="body-7">Deadlines from Canvas, classes and exams from NUSMods, all in the calendar you already check.</p>
        </div>
        <div class="features">
          <article class="feature">
            <div class="feature-stage" aria-hidden="true">
              <div class="stage-stack">
                <span class="caption-2 was">Problem Set 5 [CS2040 Data Structures and Algorithms [2610]]</span>
                <span class="stage-arrow"><Icon name="arrowRight" size={16} /></span>
                <span class="chip chip-deadline title-4">[CS2040] Problem Set 5<span class="mono caption-5">Fri 23:59</span></span>
              </div>
            </div>
            <h3 class="title-2">Module code up front</h3>
            <p class="body-6">Short titles you can scan, instead of the full Canvas course name in brackets.</p>
          </article>
          <article class="feature">
            <div class="feature-stage" aria-hidden="true">
              <div class="stage-weeks">
                <span class="caption-4">Week 6</span><span class="chip chip-class caption-4">CS2040 Lecture</span>
                <span class="caption-4 skipped">Recess</span><span class="chip caption-4 skipped-chip">CS2040 Lecture</span>
                <span class="caption-4">Week 7</span><span class="chip chip-class caption-4">CS2040 Lecture</span>
                <span class="caption-4">Exams</span><span class="chip chip-exam caption-4">MA1521 final exam</span>
              </div>
            </div>
            <h3 class="title-2">Classes and exams on the right weeks</h3>
            <p class="body-6">Only the slots you picked on NUSMods, with recess week and holidays skipped, and your final exams too.</p>
          </article>
          <article class="feature">
            <div class="feature-stage" aria-hidden="true">
              <div class="stage-notes">
                <div class="note">
                  <span class="toast-icon"><Icon name="bell" size={16} /></span>
                  <div><p class="title-4">[CS2040] Problem Set 5</p><p class="caption-5">Due tomorrow, 23:59</p></div>
                </div>
                <div class="note">
                  <span class="toast-icon"><Icon name="bell" size={16} /></span>
                  <div><p class="title-4">[CS2040] Problem Set 5</p><p class="caption-5">Due tonight, in 3 hours</p></div>
                </div>
              </div>
            </div>
            <h3 class="title-2">Reminders built in</h3>
            <p class="body-6">Google Calendar nudges you a day and 3 hours before each deadline, and a week before each exam.</p>
          </article>
          <article class="feature">
            <div class="feature-stage" aria-hidden="true">
              <div class="stage-stack">
                <span class="pill caption-1"><span class="dot" aria-hidden="true" />Synced 12 min ago</span>
                <div class="stage-row">
                  <span class="chip chip-class title-4">[CS2040] Quiz 3<span class="mono caption-5"><span class="was">Wed</span> Thu 10:00</span></span>
                  <span class="chip chip-deadline title-4">[MA1521] Tutorial 6<span class="mono caption-5">New · Mon 23:59</span></span>
                </div>
              </div>
            </div>
            <h3 class="title-2">Updates itself</h3>
            <p class="body-6">A deadline moves or a new quiz goes up on Canvas, and your calendar follows within the hour.</p>
          </article>
        </div>
      </section>

      <section class="reveal zig" aria-labelledby="how">
        <div>
          <div class="section-head">
            <h2 id="how" class="heading-2 section-title">Set up in about a minute</h2>
            <p class="body-7">Three steps, then it runs on its own.</p>
          </div>
          <ol class="steps">
            <li class="step"><span class="step-no title-3">1</span><div><h3 class="title-2">Sign in with Google</h3><p class="body-6 text-secondary mt-25">Just your name and email to start.</p></div></li>
            <li class="step"><span class="step-no title-3">2</span><div><h3 class="title-2">Paste two links</h3><p class="body-6 text-secondary mt-25">Your Canvas calendar feed and, if you like, your NUSMods share link. <a href="#links">See where to find them</a>.</p></div></li>
            <li class="step"><span class="step-no title-3">3</span><div><h3 class="title-2">Allow calendar access</h3><p class="body-6 text-secondary mt-25">Everything lands in your Google Calendar and keeps itself up to date. Prefer not to? Pick a separate shared calendar instead.</p></div></li>
          </ol>
        </div>
        <div class="mock" role="img" aria-label="The Semsync setup page with a Canvas link and a NUSMods link pasted in">
          <div class="mock-card">
            <p class="title-2">Paste your links</p>
            <p class="caption-2 text-secondary mt-25">You only do this once. Semsync checks them every hour after that.</p>
            <div class="mock-field">
              <p class="title-4">Canvas calendar feed</p>
              <div class="mock-input"><span class="caption-5 mono">https://canvas.nus.edu.sg/feeds/calendars/user_8Fq2kZ.ics</span><Icon name="checkCircle" size={18} /></div>
            </div>
            <div class="mock-field">
              <p class="title-4">NUSMods share link</p>
              <div class="mock-input"><span class="caption-5 mono">https://nusmods.com/timetable/sem-1/share?CS2040=LEC:1</span><Icon name="checkCircle" size={18} /></div>
            </div>
            <span class="mock-btn button-md">Continue</span>
          </div>
        </div>
      </section>

      <section class="reveal" aria-labelledby="links">
        <div class="section-head">
          <h2 id="links" class="heading-2 section-title">Where to find your links</h2>
          <p class="body-7">Each one takes a few clicks. Here's exactly where they are.</p>
        </div>
        <LinkGuides />
      </section>

      <section aria-label="Why Semsync">
        <div class="band">
          <p class="tagline heading-2">
            {words('Stop copying deadlines into your calendar.')}<br />{words('Spend that time actually doing them.')}
          </p>
        </div>
      </section>

      <section class="reveal faq-grid" aria-labelledby="faq">
        <div class="section-head">
          <h2 id="faq" class="heading-2 section-title">Questions</h2>
          <p class="body-7">Everything about your data is on the <a href="/privacy">privacy page</a>.</p>
        </div>
        <div>
          <div class="divider" />
          {FAQ.map(([q, a]) => (
            <>
              <details class="faq">
                <summary class="title-2">{q}<span class="faq-icon" aria-hidden="true"><Icon name="plus" size={16} /></span></summary>
                <p class="body-3">{a}</p>
              </details>
              <div class="divider" />
            </>
          ))}
        </div>
      </section>

      <section class="reveal">
        <div class="final">
          <h2 class="heading-2 section-title">Get your semester into your calendar</h2>
          <p class="body-7 text-secondary mt-200">Free, and it only ever touches the events it adds.</p>
          <div class="cta">
            {pendingSetup ? <ContinueSetupButton /> : <SignInButton />}
            <p class="caption-2 text-secondary">Delete your data anytime from your Semsync page.</p>
          </div>
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
  const setUp = isSetUp(user);
  return (
    <Layout title="Set up your calendar · Semsync" signedIn setupPending={!setUp} current="setup" noindex
      account={{ email: user.email, name: user.name, csrf }}>
      <div class="wrap narrow page">
        <BackLink signedIn={setUp} />
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
              <Guide kind="canvas" compact />
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
              <Guide kind="nusmods" compact />
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
        <form class="signed-in caption-2" method="post" action="/auth/logout">
          <input type="hidden" name="csrf" value={csrf} />
          <span>Signed in as {user.email}.</span>
          <button class="btn btn-tertiary button-md" type="submit">Not you? Sign out</button>
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

const SGT = 'Asia/Singapore';
const dayKey = (ms: number) => new Date(ms + 8 * 3600_000).toISOString().slice(0, 10);
const part = (ms: number, opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-SG', { timeZone: SGT, ...opts }).format(ms);

function timeAgo(ms: number) {
  const mins = Math.round((Date.now() - ms) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  return hours < 48 ? `${hours} h ago` : `${Math.round(hours / 24)} days ago`;
}

/** Deadlines and exams grouped by day, each day with a date block like Google Calendar's schedule view. */
const UpcomingList: FC<{ upcoming: UpcomingRow[]; failed?: boolean; now?: number }> = ({ upcoming, failed, now = Date.now() }) => {
  if (upcoming.length === 0) {
    return failed ? (
      <div class="empty failed">
        <Icon name="warningCircle" size={24} />
        <p class="title-3">Couldn't load your events</p>
        <p class="body-6">The last sync didn't finish. Try Sync now, or check your links.</p>
      </div>
    ) : (
      <div class="empty">
        <Icon name="checkCircle" size={24} />
        <p class="title-3">Nothing due soon</p>
        <p class="body-6">New Canvas deadlines and exams show up here within the hour.</p>
      </div>
    );
  }
  const today = dayKey(now);
  const days = new Map<string, UpcomingRow[]>();
  for (const e of upcoming) days.set(dayKey(e.start_ms), [...(days.get(dayKey(e.start_ms)) ?? []), e]);
  // How far away each day is, which matters more for a deadline than the month: "Today", "Tomorrow", "In 5 days".
  const away = (key: string) => Math.round((Date.parse(key) - Date.parse(today)) / 86_400_000);
  return (
    <div class="agenda">
      {[...days].map(([key, events], i) => {
        const first = events[0].start_ms;
        const n = away(key);
        const when = n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : n < 14 ? `In ${n} days` : part(first, { day: 'numeric', month: 'long' });
        return (
          <>
            {i > 0 && <div class="divider" />}
            <div class="agenda-day">
              <div class={`agenda-date${key === today ? ' today' : ''}`}>
                <span class="caption-4">{part(first, { weekday: 'short' })}</span>
                <span class="agenda-num title-1">{part(first, { day: 'numeric' })}</span>
              </div>
              <div class="agenda-events">
                <p class="caption-4 text-secondary">{when}</p>
                {events.map((e) => (
                  <div class={`agenda-ev ${KIND_CLASS[e.kind]}`}>
                    <span class="body-5">{e.title}</span>
                    <time class="caption-5 mono" datetime={new Date(e.start_ms).toISOString()}>
                      {KIND_LABEL[e.kind]} · {e.all_day === 1 ? 'all day' : part(e.start_ms, { hour: '2-digit', minute: '2-digit', hour12: false })}
                    </time>
                  </div>
                ))}
              </div>
            </div>
          </>
        );
      })}
    </div>
  );
};

/** Where the events go, and the one thing to do there. */
const Destination: FC<{ user: UserRow; addUrl: string | null; needsConnect: boolean; dev: boolean }> = ({ user, addUrl, needsConnect, dev }) => {
  if (user.mode === 'main' && needsConnect) {
    return (
      <section class="panel panel-glow dest" aria-labelledby="dest">
        <span class="dest-icon warn"><Icon name="warningCircle" /></span>
        <h2 id="dest" class="title-1">Connect Google Calendar</h2>
        <p class="caption-2 text-secondary">Semsync needs permission to add events to your calendar. It only ever touches the events it adds.</p>
        <div class="dest-actions">
          <a class="btn btn-primary button-md" href="/connect">Connect Google Calendar</a>
          <a class="btn btn-tertiary button-md" href="/setup?edit=1">Use a separate calendar</a>
        </div>
      </section>
    );
  }
  if (user.mode === 'main') {
    return (
      <section class="panel panel-glow dest" aria-labelledby="dest">
        <span class="dest-icon"><Icon name="calendarCheck" /></span>
        <h2 id="dest" class="title-1">In your Google Calendar</h2>
        <p class="caption-2 text-secondary">Reminders 1 day and 3 hours before each deadline, and 1 week and 1 day before each exam.</p>
        <div class="dest-actions">
          <a class="btn btn-primary button-md" href={dev ? '/dev/calendar' : 'https://calendar.google.com/calendar/r'} target="_blank" rel="noopener">
            Open Google Calendar<Icon name="arrowRight" size={16} />
          </a>
        </div>
      </section>
    );
  }
  return (
    <section class="panel panel-glow dest" aria-labelledby="dest">
      <span class="dest-icon"><Icon name="calendarDots" /></span>
      <h2 id="dest" class="title-1">Your "NUS semester" calendar</h2>
      <p class="caption-2 text-secondary">Shared with {user.email}. Add it to Google Calendar once and it keeps itself up to date.</p>
      <div class="dest-actions">
        {addUrl && <a class="btn btn-primary button-md" href={addUrl} target="_blank" rel="noopener">Add to Google Calendar</a>}
        <a class="btn btn-tertiary button-md" href="https://calendar.google.com/calendar/r/settings" target="_blank" rel="noopener">Set up reminders</a>
      </div>
    </section>
  );
};

const Sources: FC<{ user: UserRow; dev?: boolean }> = ({ user, dev }) => {
  let modules: string[] = [];
  try {
    if (user.nusmods_link) modules = parseNusmodsLink(user.nusmods_link).modules.map((m) => m.code);
  } catch {
    // An old link that no longer parses just shows as added, without its courses.
  }
  return (
    <section class="panel dash-sources" aria-labelledby="sources">
      <h2 id="sources" class="title-2">Your links</h2>
      <div class="sources">
        <div class="source">
          <span class="source-icon"><Icon name="graduationCap" size={18} /></span>
          <div>
            <p class="title-4">Canvas</p>
            <p class="caption-2 text-secondary">{user.canvas_feed_enc ? 'Calendar feed connected' : 'Not added'}</p>
          </div>
          {user.canvas_feed_enc && <Icon name="checkCircle" size={18} cls="ok" />}
        </div>
        <div class="source">
          <span class="source-icon"><Icon name="calendarDots" size={18} /></span>
          <div>
            <p class="title-4">NUSMods</p>
            {modules.length ? (
              <div class="mods">{modules.map((m) => <span class="mod caption-4">{m}</span>)}</div>
            ) : (
              <p class="caption-2 text-secondary">{user.nusmods_link ? 'Timetable added' : 'Not added'}</p>
            )}
          </div>
          {user.nusmods_link && <Icon name="checkCircle" size={18} cls="ok" />}
        </div>
      </div>
      <div class="sources-actions">
        <a class="btn btn-secondary button-md" href="/setup?edit=1">Change links</a>
        {dev && <a class="btn btn-tertiary button-md" href="/dev/calendar">Fake calendar</a>}
      </div>
    </section>
  );
};

/** What deleting does, in the confirmation dialog and on its fallback page for when JavaScript is off. */
const DeleteConfirm: FC<{ user: UserRow; csrf: string; total: number; dialog?: boolean }> = ({ user, csrf, total, dialog }) => (
  <form method="post" action="/account/delete" data-busy-label="Deleting…">
    <input type="hidden" name="csrf" value={csrf} />
    <input type="hidden" name="confirm" value="yes" />
    <span class="confirm-icon"><Icon name="warningCircle" size={24} /></span>
    <h2 id="delete-title" class="title-1 mt-200">Delete your Semsync data?</h2>
    <ul class="confirm-list body-6">
      {user.mode === 'main' ? (
        <>
          <li>Removes the {total} events Semsync added to your Google Calendar. Your own events stay.</li>
          <li>Revokes Semsync's access to your calendar.</li>
        </>
      ) : (
        <li>Deletes the "NUS semester" calendar and its {total} events. Your own calendar isn't touched.</li>
      )}
      <li>Deletes your saved Canvas and NUSMods links and signs you out.</li>
    </ul>
    <p class="caption-2 text-secondary mt-200">This can't be undone, but you can set Semsync up again any time.</p>
    <div class="confirm-actions">
      {dialog
        ? <button class="btn btn-secondary button-md" type="button" data-close>Cancel</button>
        : <a class="btn btn-secondary button-md" href="/home">Cancel</a>}
      <button class="btn btn-error button-md" type="submit">Delete everything</button>
    </div>
  </form>
);

const total = (counts: Record<string, number>) => Object.values(counts).reduce((a, b) => a + b, 0);
const COUNT_LABEL = { deadline: 'deadlines', class: 'classes', exam: 'exams' } as const;

export const Home: FC<{
  user: UserRow; csrf: string; addUrl: string | null; needsConnect: boolean; counts: Record<string, number>;
  upcoming: UpcomingRow[]; flash?: string; dev: boolean;
}> = ({ user, csrf, addUrl, needsConnect, counts, upcoming, flash, dev }) => {
  const failing = user.last_sync_ok === 0 || needsConnect;
  const week = semesterWeek();
  const status = needsConnect ? 'Not syncing' : user.last_sync_at ? `Synced ${timeAgo(user.last_sync_at)}` : 'Not synced yet';
  return (
    <Layout title="Your calendar · Semsync" signedIn current="home" noindex account={{ email: user.email, name: user.name, csrf }}>
      <div class="wrap dash-wrap page">
        <header class="dash-head">
          <div>
            <p class="caption-1 text-secondary">{week.detail}</p>
            <h1 class="heading-2 dash-title">{week.label}</h1>
          </div>
          <form class="sync-pill" method="post" action="/sync" data-busy-label="Syncing…">
            <input type="hidden" name="csrf" value={csrf} />
            <span class={`dot${failing ? ' bad' : ''}`} aria-hidden="true" />
            <span class="caption-2">{status}</span>
            <button class="btn btn-secondary button-md" type="submit"><Icon name="arrowsClockwise" size={16} />Sync now</button>
          </form>
        </header>

        {flash && <div class="notice notice-success body-6" role="status"><Icon name="checkCircle" />{flash}</div>}
        {user.last_sync_message && (
          <div class={`notice ${user.last_sync_ok === 0 ? 'notice-error' : 'notice-warning'} body-6`} role="status">
            <Icon name="warningCircle" />{user.last_sync_message}
          </div>
        )}

        <div class="dash">
          <section class="panel dash-agenda" aria-labelledby="coming-up">
            <div class="panel-head">
              <h2 id="coming-up" class="title-1">Coming up</h2>
              <span class="caption-2 text-secondary">Deadlines and exams</span>
            </div>
            <UpcomingList upcoming={upcoming} failed={failing} />
          </section>

          <div class="dash-side">
          <div class="dash-dest"><Destination user={user} addUrl={addUrl} needsConnect={needsConnect} dev={dev} /></div>

          <section class="panel dash-stats" aria-labelledby="semester">
            <h2 id="semester" class="title-2">This semester</h2>
            <div class="tiles">
              {(['deadline', 'class', 'exam'] as const).map((k) => (
                <div class="tile">
                  <span class={`tile-key key-${k}`} aria-hidden="true" />
                  <b class="heading-5 mono">{counts[k] ?? 0}</b>
                  <span class="caption-2 text-secondary">{COUNT_LABEL[k]}</span>
                </div>
              ))}
            </div>
          </section>

          <Sources user={user} dev={dev} />
          </div>
        </div>

        <dialog class="confirm" id="delete-dialog" aria-labelledby="delete-title">
          <DeleteConfirm user={user} csrf={csrf} total={total(counts)} dialog />
        </dialog>
      </div>
    </Layout>
  );
};

/** The confirmation as its own page, for when JavaScript is off and the dialog can't open. */
export const DeleteData: FC<{ user: UserRow; csrf: string; counts: Record<string, number> }> = ({ user, csrf, counts }) => (
  <Layout title="Delete your data · Semsync" signedIn noindex account={{ email: user.email, name: user.name, csrf }}>
    <div class="wrap narrow page">
      <div class="panel confirm-page"><DeleteConfirm user={user} csrf={csrf} total={total(counts)} /></div>
    </div>
  </Layout>
);

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
      <BackLink signedIn={signedIn} />
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
    </div>
  </Layout>
);

export const Terms: FC<{ signedIn?: boolean; origin?: string }> = ({ signedIn, origin }) => (
  <Layout title="Terms · Semsync" current="terms" signedIn={signedIn} origin={origin}>
    <div class="wrap narrow page prose">
      <BackLink signedIn={signedIn} />
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
    </div>
  </Layout>
);

/** 1200 × 630 card, screenshotted into public/og.png for link previews (see docs/design.md). */
export const OgCard: FC = () => (
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <link href={FONTS} rel="stylesheet" />
      <style>{raw(`${CSS}\nhtml, body { width: 1200px; height: 630px; overflow: hidden; }`)}</style>
    </head>
    <body class="mode-dark" style="background: var(--surface-primary); color: var(--text-primary);">
      <div style="padding: var(--space-800) var(--space-800) 0; display: flex; flex-direction: column; height: 630px;">
        <div class="brand title-1"><span class="brand-mark" style="width: 40px; height: 40px; border-radius: var(--radius-8);"><Icon name="calendar" size={24} /></span>Semsync</div>
        <h1 class="heading-2 hero-title" style="margin: var(--space-500) 0 0; max-width: 960px;">
          Every Canvas deadline in your calendar,<br /> without typing a thing
        </h1>
        <p class="body-7 text-secondary mt-300">Canvas deadlines, NUSMods classes and exams, kept up to date in Google Calendar.</p>
        <div style="display: flex; gap: var(--space-200); margin-top: auto; padding: var(--space-400); background: radial-gradient(40% 120% at 80% 100%, color-mix(in srgb, var(--surface-glow-accent) 70%, transparent), transparent 70%), radial-gradient(55% 130% at 20% 100%, color-mix(in srgb, var(--surface-glow-brand) 85%, transparent), transparent 70%);">
          <Chip large kind="class" title="CS2040 Lecture" time="Thu 10:00" />
          <Chip large kind="deadline" title="[CS2040] Problem Set 5" time="Fri 23:59" />
          <Chip large kind="exam" title="MA1521 final exam" time="Sat 28 Nov 17:00" />
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
