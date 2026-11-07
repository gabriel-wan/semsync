import type { Child, FC, PropsWithChildren } from 'hono/jsx';
import { raw } from 'hono/html';
import { TESTIMONIAL, semesterWeek } from '../config.js';
import { jsonList, type Course, type UpcomingRow, type UserRow } from '../lib/db.js';
import { GOOGLE_EVENT_COLORS, moduleColors } from '../lib/events.js';
import { isAddingMessage } from '../lib/messages.js';
import { parseNusmodsLink } from '../lib/nusmods.js';
import { verifiedBrand, type ConnectedApp } from '../lib/oauth.js';
import { BrandMark, CanvasMark, ChatgptMark, ClaudeMark, FAVICON, GithubMark, GoogleMark, Icon, NusmodsMark, type IconName } from './icons.js';
import { CSS, THEME_INIT } from './styles.js';
import { CORE, RADIUS, SPACING, SYSTEM, SYSTEM_SPEC, TEXT_STYLES } from './tokens.js';


/** Semsync's source code, linked from the nav and the footer. */
const REPO = 'https://github.com/gabriel-wan/semsync';

const FONTS = 'https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Geist+Mono:wght@500&display=swap';

type LayoutProps = PropsWithChildren<{
  title: string; description?: string; current?: string; signedIn?: boolean; noindex?: boolean; origin?: string;
  /** The longer title for link previews and search results, when the browser tab shows a short one. */
  socialTitle?: string;
  /** A public page's own path, so search engines and link previews use one address for it. */
  path?: string;
  /** Signed in but not set up yet, so there's no calendar page to go to: the nav leads to setup instead. */
  setupPending?: boolean;
  /** Who's signed in, for the account menu (sign out, delete). Pages without a CSRF token at hand leave it out. */
  account?: Account;
  head?: Child;
}>;

type Account = { email: string; name: string | null; csrf: string };
/** Who's looking at a plain page (Help, Privacy, Terms), so its nav matches the rest of the signed-in site. */
export type Viewer = { signedIn?: boolean; setupPending?: boolean; account?: Account; origin?: string };

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
      <a class="menu-item body-5" href="/settings"><Icon name="gear" size={18} />Settings</a>
      <form method="post" action="/auth/logout">
        <input type="hidden" name="csrf" value={account.csrf} />
        <button class="menu-item body-5" type="submit"><Icon name="signOut" size={18} />Sign out</button>
      </form>
      <a class="menu-item body-5 danger-link" href="/account/delete" data-confirm="delete-dialog"><Icon name="trash" size={18} />Delete my data</a>
    </div>
  </>
);

export const Layout: FC<LayoutProps> = ({
  title, description, current, signedIn, noindex, origin, socialTitle, path, setupPending, account, head, children,
}) => {
  const desc = description ?? 'Canvas deadlines, NUSMods classes and exams in your calendar, kept up to date. Works with Google Calendar, Outlook and Apple Calendar.';
  const section = (id: string) => (current === 'landing' ? `#${id}` : `/#${id}`);
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <script>{raw(THEME_INIT)}</script>
        {/* The browser tab always just says Semsync; the page's own title goes to link previews. */}
        <title>Semsync</title>
        <meta name="description" content={desc} />
        <meta property="og:title" content={socialTitle ?? title} />
        <meta property="og:description" content={desc} />
        <meta property="og:type" content="website" />
        {origin && <meta property="og:url" content={`${origin}${path && path !== '/' ? path : ''}`} />}
        {origin && path && !noindex && <link rel="canonical" href={`${origin}${path}`} />}
        {origin && <meta property="og:image" content={`${origin}/og.png`} />}
        {origin && <meta property="og:image:width" content="1200" />}
        {origin && <meta property="og:image:height" content="630" />}
        <meta name="twitter:card" content={origin ? 'summary_large_image' : 'summary'} />
        {noindex && <meta name="robots" content="noindex" />}
        <link rel="icon" href="/favicon.ico" sizes="32x32" />
        <link rel="icon" href={FAVICON} type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
        <link href={FONTS} rel="stylesheet" />
        <style>{raw(CSS)}</style>
        <link rel="stylesheet" href="/site.css" />
        {head}
      </head>
      <body>
        <a class="skip body-5" href="#main">Skip to content</a>
        <nav class="nav" aria-label="Main">
          <div class="nav-bar">
            <a class="brand title-3" href="/" aria-current={current === 'landing' ? 'page' : undefined}>
              <BrandMark />Semsync
            </a>
            <div class="nav-links">
              {signedIn && setupPending ? (
                <a class="nav-link title-4" href="/setup" aria-current={current === 'setup' ? 'page' : undefined}>Finish setup</a>
              ) : signedIn ? (
                <>
                  <a class="nav-link title-4" href="/home" aria-current={current === 'home' ? 'page' : undefined}>Your calendar</a>
                  <a class="nav-link section-link title-4" href="/settings" aria-current={current === 'settings' ? 'page' : undefined}>Settings</a>
                </>
              ) : (
                <>
                  <a class="nav-link section-link title-4" href={section('how')}>How it works</a>
                  <a class="nav-link section-link title-4" href="/help" aria-current={current === 'help' ? 'page' : undefined}>Help</a>
                </>
              )}
              <button class="theme-toggle" type="button" data-theme-toggle aria-label="Switch between light and dark mode">
                <Icon name="moon" cls="icon-moon" />
                <Icon name="sun" cls="icon-sun" />
              </button>
              {account && <AccountMenu account={account} />}
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
              <a href="/help" aria-current={current === 'help' ? 'page' : undefined}>Help</a>
              <a href="/privacy" aria-current={current === 'privacy' ? 'page' : undefined}>Privacy</a>
              <a href="/terms" aria-current={current === 'terms' ? 'page' : undefined}>Terms</a>
              <a class="footer-github" href={REPO} target="_blank" rel="noopener"><GithubMark size={16} />GitHub</a>
            </span>
          </div>
        </footer>
        <script src="/app.js" defer></script>
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

/** What Semsync works with: Canvas and NUSMods, into Google Calendar (or `dest`, where there's room to name the others). */
const Flow: FC<{ dest?: string }> = ({ dest = 'Google Calendar' }) => (
  <p class="flow" aria-label={`Works with Canvas and NUSMods, into ${dest}`}>
    <span class="flow-item"><span class="flow-icon flow-logo"><CanvasMark size={22} /></span><span class="title-3">Canvas</span></span>
    <span class="flow-plus title-3" aria-hidden="true">+</span>
    <span class="flow-item"><span class="flow-icon flow-logo"><NusmodsMark size={22} /></span><span class="title-3">NUSMods</span></span>
    <span class="flow-arrow" aria-hidden="true"><Icon name="arrowRight" size={20} /></span>
    <span class="flow-item flow-dest"><span class="flow-icon"><Icon name="calendarCheck" size={18} /></span><span class="title-3">{dest}</span></span>
  </p>
);

/** Proof beside the claim: a real testimonial once there is one, otherwise what Semsync works with (both true). */
const Proof: FC = () =>
  TESTIMONIAL ? (
    <figure class="proof" style="margin-left: auto; margin-right: auto;">
      <blockquote class="body-3">"{TESTIMONIAL.quote}"</blockquote>
      <figcaption class="caption-2">{TESTIMONIAL.name}, {TESTIMONIAL.detail}</figcaption>
    </figure>
  ) : (
    <Flow />
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

/** The demo's first scene: the setup card over an empty week, with the two links pasted in one after the other. */
const DemoPaste: FC = () => (
  <div class="demo-paste" aria-hidden="true">
    <div class="demo-card">
      <p class="title-3">Paste your links</p>
      {[
        ['Canvas calendar feed', 'https://canvas.nus.edu.sg/feeds/calendars/user_8Fq2kZ.ics'],
        ['NUSMods share link', 'https://nusmods.com/timetable/sem-1/share?CS2040=LEC:1&MA1521=LEC:2'],
      ].map(([label, link]) => (
        <div class="demo-field" data-paste={link}>
          <span class="caption-4 text-secondary">{label}</span>
          <span class="demo-input"><span class="demo-text caption-5 mono" /><Icon name="checkCircle" size={16} /></span>
        </div>
      ))}
      <span class="demo-btn title-4">Continue<Icon name="arrowRight" size={16} /></span>
    </div>
  </div>
);

/**
 * The hero: a short demo on a loop. The two links go in, the week fills with classes and deadlines, then the reminder
 * arrives. The script plays it; without JavaScript, or with reduced motion, the finished week shows instead.
 */
const Showcase: FC = () => (
  <div class="showcase" data-demo role="img"
    aria-label="Two links pasted into Semsync, then a week in Google Calendar filling with NUSMods classes, Canvas deadlines and a Semsync reminder">
    <div class="cal">
      <DemoPaste />
      <Week />
    </div>
    <Reminder style={`--i: ${EVENTS.length + 2};`} />
  </div>
);

/** The finished week inside the hero calendar, shared with the link preview card. */
const Week: FC = () => (
  <>
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
  </>
);

/** The reminder that floats over the edge of the week. */
const Reminder: FC<{ style: string }> = ({ style }) => (
  <div class="toast" style={style}>
    <span class="toast-icon"><Icon name="bell" size={20} /></span>
    <div>
      <p class="title-4">[CS2040] Problem Set 5 is due tonight</p>
      <p class="caption-5">Semsync reminder · 23:59, in 3 hours</p>
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

const Chip: FC<{ kind: 'class' | 'deadline' | 'exam'; title: string; time: string }> = ({ kind, title, time }) => (
  <div class={`chip chip-${kind} caption-4`}>
    {title}
    <span class="mono caption-5">{time}</span>
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
  ['What does it do in my calendar?', 'It makes one calendar, "NUS semester", with your deadlines, classes and exams, and keeps it up to date. You can show or hide it with one tick. Your other calendars and events are never touched.'],
  ['What can Semsync access in my Google account?', 'Only the calendar it makes. Google calls the permission "Make secondary Google calendars, and see, create, change and delete events on them", and it doesn\'t let Semsync see any other calendar.'],
  ['Can I leave a course out?', 'Yes. In Settings, untick the course and save, and its upcoming events come out. You can turn off the "Week 7" labels there too.'],
  ['How quickly do changes show up?', 'Semsync checks Canvas about once an hour. If a deadline moves, your calendar follows within the hour.'],
  ['Do I get reminders?', 'Yes: 1 day and 3 hours before each deadline, and 1 week and 1 day before each exam.'],
  ['Does it work with Outlook or Apple Calendar?', 'Yes. Choose "Outlook or Apple Calendar" when you set up, or get a subscribe link in Settings, and add it to any calendar app. It stays up to date, though those apps only check it every few hours, and some ignore its reminders.'],
  ['Does it work with Notion Calendar?', 'Yes. Notion Calendar shows the calendars in your Google account, so "NUS semester" is there once you connect that account to it.'],
  ['What happens next semester?', 'Canvas deadlines keep coming by themselves, and each new term\'s weeks and holidays are worked out for you. NUSMods links are made one semester at a time, so two weeks before the next one starts, Semsync puts a reminder in your calendar to paste its link.'],
  ['How do I stop using it?', 'In Settings, choose Delete my data. That deletes the "NUS semester" calendar, takes back Semsync\'s access and erases everything it stored about you.'],
];

/** The few questions people ask before signing up; the rest are on Help. */
const LANDING_FAQ = FAQ.filter(([q]) => /official|access|Outlook|next semester|stop/.test(q));

/** The questions, each opening in place, between 1px rules. */
const FaqList: FC<{ faq?: [string, string][] }> = ({ faq = FAQ }) => (
  <div>
    <div class="divider" />
    {faq.map(([q, a]) => (
      <>
        <details class="faq">
          <summary class="title-2">{q}<span class="faq-icon" aria-hidden="true"><Icon name="plus" size={16} /></span></summary>
          <p class="body-3">{a}</p>
        </details>
        <div class="divider" />
      </>
    ))}
  </div>
);

export const Landing: FC<{ origin?: string; pendingSetup?: boolean }> = ({ origin, pendingSetup }) => (
  <Layout title="Semsync" socialTitle="Semsync: your NUS semester in your calendar" origin={origin} path="/" current="landing"
    signedIn={pendingSetup} setupPending={pendingSetup} head={faqSchema(LANDING_FAQ)}>
    <div class="wrap">
      <header class="hero">
        <div class="hero-copy">
          <h1 class="heading-1 hero-title">Every Canvas deadline in your calendar, without typing a thing</h1>
          <p class="hero-sub body-7">
            Paste your Canvas calendar link and your NUSMods timetable once. Semsync puts your deadlines, classes and exams into
            Google Calendar, with reminders, and keeps them up to date every hour.
          </p>
          <div class="cta">
            {pendingSetup ? <ContinueSetupButton /> : <SignInButton />}
            <p class="caption-2 text-secondary">Free. Only touches the events it adds. Delete anytime.</p>
          </div>
          <Proof />
        </div>
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

      <section class="reveal zig" id="how" aria-labelledby="how-title">
        <div>
          <div class="section-head">
            <h2 id="how-title" class="heading-2 section-title">Set up in about a minute</h2>
            <p class="body-7">Three steps, then it runs on its own.</p>
          </div>
          <ol class="steps">
            <li class="step"><span class="step-no title-3">1</span><div><h3 class="title-2">Sign in with Google</h3><p class="body-6 text-secondary mt-25">Just your name and email to start.</p></div></li>
            <li class="step"><span class="step-no title-3">2</span><div><h3 class="title-2">Paste two links</h3><p class="body-6 text-secondary mt-25">Your Canvas calendar feed and, if you like, your NUSMods share link. <a href="/help#links">See where to find them</a>.</p></div></li>
            <li class="step"><span class="step-no title-3">3</span><div><h3 class="title-2">Allow calendar access</h3><p class="body-6 text-secondary mt-25">Google asks once, so Semsync can make its own "NUS semester" calendar. It can't see your other calendars. On Outlook or Apple Calendar? Get a subscribe link instead.</p></div></li>
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
          <p class="body-7">More answers on the <a href="/help#faq">Help page</a>, and everything about your data on the <a href="/privacy">privacy page</a>.</p>
        </div>
        <FaqList faq={LANDING_FAQ} />
      </section>

      <section class="reveal">
        <div class="final">
          <div>
            <h2 class="heading-2 section-title">Get your semester into your calendar</h2>
            <p class="body-7 text-secondary mt-200">Free, and it only ever touches the events it adds.</p>
          </div>
          <div class="cta">
            {pendingSetup ? <ContinueSetupButton /> : <SignInButton />}
            <p class="caption-2 text-secondary">You can delete your data anytime.</p>
          </div>
        </div>
      </section>
    </div>
  </Layout>
);

export type SetupValues = { canvas: string; nusmods: string };
export type SetupErrors = Partial<Record<'canvas' | 'nusmods' | 'form', string>>;

const FieldError: FC<{ id: string; message?: string }> = ({ id, message }) => (
  <p class="field-error caption-2" id={id} hidden={!message} role="alert">
    <Icon name="warningCircle" size={16} />
    <span>{message ?? ''}</span>
  </p>
);

export const Setup: FC<{
  user: UserRow; csrf: string; values: SetupValues; errors: SetupErrors; editing: boolean; dev: boolean; asksAccess?: boolean;
}> = ({ user, csrf, values, errors, editing, dev, asksAccess }) => {
  const keepCanvas = editing && !!user.canvas_feed_enc;
  const setUp = isSetUp(user);
  return (
    <Layout title="Set up your calendar · Semsync" signedIn setupPending={!setUp} current="setup" noindex
      account={{ email: user.email, name: user.name, csrf }}>
      <div class="wrap narrow page setup">
        <BackLink signedIn={setUp} />
        <h1 class="heading-3">{editing ? 'Update your links' : 'Set up Semsync'}</h1>
        <p class="lead body-3">
          {editing
            ? 'Change a link and save. Semsync syncs straight away.'
            : 'Paste two links and you\'re done. Semsync checks them every hour after that.'}
        </p>
        {errors.form && (
          <div class="notice notice-error body-6" role="alert"><Icon name="warningCircle" />{errors.form}</div>
        )}
        <form class="setup-form" method="post" action="/setup" novalidate data-setup data-keep-canvas={keepCanvas ? '1' : '0'} data-dev={dev ? '1' : '0'}
          data-busy-label={editing ? 'Saving and syncing…' : 'Setting up your calendar…'}>
          <input type="hidden" name="csrf" value={csrf} />
          <section class="panel setup-step">
            <div class="step-head">
              <span class="step-no title-4" aria-hidden="true">1</span>
              <div>
                <label class="title-2" for="canvas">Canvas calendar feed</label>
                <p class="hint caption-2" id="canvas-hint">Your deadlines. The link works like a password, so Semsync keeps it encrypted.</p>
              </div>
            </div>
            <input class="input body-3" id="canvas" name="canvas" type="url" inputmode="url" autocomplete="off" spellcheck={false}
              placeholder="https://canvas.nus.edu.sg/feeds/calendars/user_….ics" value={values.canvas}
              aria-describedby="canvas-hint canvas-error" aria-invalid={errors.canvas ? 'true' : undefined} />
            <FieldError id="canvas-error" message={errors.canvas} />
            {keepCanvas && !errors.canvas && <p class="hint caption-2">Leave blank to keep your current link.</p>}
            {dev && <p class="hint caption-2">Local dev: type <code>sample</code> to use a sample Canvas feed.</p>}
            <details class="help">
              <summary class="help-toggle title-4"><Icon name="caretDown" size={16} />Where do I find this?</summary>
              <Guide kind="canvas" compact />
            </details>
          </section>
          <section class="panel setup-step">
            <div class="step-head">
              <span class="step-no title-4" aria-hidden="true">2</span>
              <div>
                <label class="title-2" for="nusmods">NUSMods share link <span class="badge caption-4">Optional</span></label>
                <p class="hint caption-2" id="nusmods-hint">Your classes on the right weeks, plus final exam dates.</p>
              </div>
            </div>
            <input class="input body-3" id="nusmods" name="nusmods" type="url" inputmode="url" autocomplete="off" spellcheck={false}
              placeholder="https://nusmods.com/timetable/sem-2/share?…" value={values.nusmods}
              aria-describedby="nusmods-hint nusmods-error" aria-invalid={errors.nusmods ? 'true' : undefined} />
            <FieldError id="nusmods-error" message={errors.nusmods} />
            <details class="help">
              <summary class="help-toggle title-4"><Icon name="caretDown" size={16} />Where do I find this?</summary>
              <Guide kind="nusmods" compact />
            </details>
          </section>
          {asksAccess && (
            <p class="setup-next caption-2 text-secondary">
              <Icon name="lock" size={16} />
              <span>Next, Google asks if Semsync can make its own "NUS semester" calendar. It can't see your other calendars.</span>
            </p>
          )}
          <div class="setup-actions">
            <button class="btn btn-primary btn-lg button-lg" type="submit">{editing ? 'Save and sync' : 'Continue'}<Icon name="arrowRight" size={18} /></button>
            {editing && <a class="btn btn-secondary btn-lg button-lg" href="/home">Cancel</a>}
          </div>
          {asksAccess && (
            <p class="setup-alt caption-2 text-secondary">
              Use Outlook or Apple Calendar?{' '}
              <button class="link-button caption-1" type="submit" name="dest" value="feed">Get a subscribe link instead</button>
            </p>
          )}
        </form>
        <form class="signed-in caption-2" method="post" action="/auth/logout">
          <input type="hidden" name="csrf" value={csrf} />
          <span>Signed in as {user.email}.</span>
          <button class="link-button caption-1" type="submit">Not you? Sign out</button>
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

const KIND_LABEL = { deadline: 'Due', exam: 'Exam', event: 'Event', class: 'Class', week: 'Week' } as const;
const KIND_CLASS = { deadline: 'chip-deadline', exam: 'chip-exam', event: 'chip-class', class: 'chip-class', week: 'chip-class' } as const;

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

/** The subscribe link, ready to copy, with a button that opens it in the computer's calendar app (webcal://). */
const FeedLink: FC<{ url: string }> = ({ url }) => (
  <div class="feed-link">
    <input class="input mono caption-5" id="feed-url" value={url} readonly aria-label="Your subscribe link" data-select />
    <div class="feed-actions">
      <button class="btn btn-primary button-md" type="button" data-copy="feed-url"><Icon name="copy" size={16} /><span>Copy link</span></button>
      <a class="btn btn-secondary button-md" href={url.replace(/^https?:/, 'webcal:')}>Open in calendar app</a>
    </div>
  </div>
);

/** Where to paste the link in each app, folded away until someone asks. */
const AppSteps: FC = () => (
  <details class="help app-steps">
    <summary class="help-toggle title-4"><Icon name="caretDown" size={16} />How to add it</summary>
    <ul class="app-list body-6">
      <li><span class="title-4">Outlook</span>Add calendar, then Subscribe from web, and paste the link.</li>
      <li><span class="title-4">iPhone or iPad</span>Settings, Calendar, Accounts, Add Account, Other, then Add Subscribed Calendar.</li>
      <li><span class="title-4">Mac</span>In Calendar, File, then New Calendar Subscription.</li>
    </ul>
    <p class="caption-2 text-secondary mt-100">
      Calendar apps check the link every few hours, and some ignore its reminders. Anyone with the link can see your
      calendar, so keep it to yourself; you can replace it in Settings.
    </p>
  </details>
);

/** A small picture of Google Calendar's "My calendars" list, showing where Semsync's calendar is. */
const MyCalendars: FC<{ owner: string }> = ({ owner }) => (
  <div class="mini-cals" aria-hidden="true">
    <p class="caption-4 text-secondary">My calendars</p>
    <span class="mini-cal body-5"><span class="mini-box" style={`background: ${GOOGLE_EVENT_COLORS['7']};`}><Icon name="check" size={12} /></span>{owner}</span>
    <span class="mini-cal mini-on body-5">
      <span class="mini-box" style="background: var(--surface-brand);"><Icon name="check" size={12} /></span>NUS semester
      <span class="badge badge-brand caption-4">Semsync</span>
    </span>
    <span class="mini-cal body-5"><span class="mini-box" style={`background: ${GOOGLE_EVENT_COLORS['2']};`}><Icon name="check" size={12} /></span>Birthdays</span>
  </div>
);

/** Where the events go, and the one thing to do there. */
const Destination: FC<{ user: UserRow; csrf: string; addUrl: string | null; needsConnect: boolean; feedLink?: string | null; dev: boolean }> = ({
  user, csrf, addUrl, needsConnect, feedLink, dev,
}) => {
  if (user.mode === 'feed') {
    return (
      <section class="panel panel-glow dest" aria-labelledby="dest">
        <span class="dest-icon"><Icon name="calendarPlus" /></span>
        <h2 id="dest" class="title-1">In your calendar app</h2>
        <p class="caption-2 text-secondary">Subscribe to this private link in Outlook, Apple Calendar or any calendar app, and it keeps itself up to date.</p>
        {feedLink && <FeedLink url={feedLink} />}
        <AppSteps />
      </section>
    );
  }
  if (user.mode === 'main' && needsConnect) {
    return (
      <section class="panel panel-glow dest" aria-labelledby="dest">
        <span class="dest-icon warn"><Icon name="warningCircle" /></span>
        <h2 id="dest" class="title-1">Connect Google Calendar</h2>
        <p class="caption-2 text-secondary">Semsync needs your OK to make its "NUS semester" calendar. It can't see your other calendars.</p>
        <div class="dest-actions">
          <a class="btn btn-primary button-md" href="/connect">Connect Google Calendar</a>
          <form method="post" action="/feed/use" data-busy-label="Making your link…">
            <input type="hidden" name="csrf" value={csrf} />
            <button class="btn btn-secondary button-md" type="submit">Use Outlook or Apple Calendar</button>
          </form>
        </div>
      </section>
    );
  }
  if (user.mode === 'main') {
    return (
      <section class="panel panel-glow dest" aria-labelledby="dest">
        <span class="dest-icon"><Icon name="calendarCheck" /></span>
        <h2 id="dest" class="title-1">In your Google Calendar</h2>
        <p class="caption-2 text-secondary">Look for "NUS semester" under My calendars. Every deadline and exam already has reminders.</p>
        <MyCalendars owner={user.name || user.email.split('@')[0]} />
        <div class="dest-actions">
          <a class="btn btn-primary button-md" href={dev ? '/dev/calendar' : 'https://calendar.google.com/calendar/r'} target="_blank" rel="noopener">
            Open Google Calendar<Icon name="arrowRight" size={16} />
          </a>
        </div>
      </section>
    );
  }
  // Set up before the shared-calendar option went away: still syncing there, with a one-step way into their own calendar.
  return (
    <section class="panel panel-glow dest" aria-labelledby="dest">
      <span class="dest-icon"><Icon name="calendarPlus" /></span>
      <h2 id="dest" class="title-1">Move to your own calendar</h2>
      <p class="caption-2 text-secondary">Your events are in a shared calendar, which can't have reminders or module colours. Moving takes one step.</p>
      <div class="dest-actions">
        <a class="btn btn-primary button-md" href="/connect">Move my events</a>
        {addUrl && <a class="btn btn-secondary button-md" href={addUrl} target="_blank" rel="noopener">Open shared calendar</a>}
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
        <a class="btn btn-secondary button-md" href="/setup?edit=1"><Icon name="pencil" size={18} />Change links</a>
        {dev && <a class="btn btn-tertiary button-md" href="/dev/calendar">Fake calendar</a>}
      </div>
    </section>
  );
};

/**
 * What goes in the calendar: a tile for every course the last sync found, all the same size, plus week labels.
 * Unticking one and saving takes its upcoming events out. With your own calendar, each tile shows the module's colour.
 */
const CoursesPanel: FC<{ user: UserRow; csrf: string }> = ({ user, csrf }) => {
  const courses = jsonList<Course>(user.courses);
  const hidden = new Set(jsonList<string>(user.hidden_courses));
  const colors = moduleColors(courses.map((c) => c.key));
  return (
    <section class="panel" aria-labelledby="courses-title">
      <h2 id="courses-title" class="title-2">Courses</h2>
      <p class="caption-2 text-secondary mt-50">
        Untick a course to take it out of your calendar.
        {user.mode === 'main' && courses.length > 0 && ' The dot is its colour there.'}
      </p>
      <form class="courses-form" method="post" action="/courses" data-busy-label="Saving…">
        <input type="hidden" name="csrf" value={csrf} />
        {courses.length > 0 ? (
          <div class="course-grid">
            {courses.map((c) => {
              const code = c.key.startsWith('canvas:') ? null : c.key;
              const title = c.key === 'canvas:other' ? 'Other' : code ?? c.label;
              const name = c.key === 'canvas:other'
                ? 'Holidays and events not tied to a course'
                : code ? c.label.slice(c.label.startsWith(code) ? code.length : 0).replace(/^[\s/,:]+/, '').trim() : '';
              const color = user.mode === 'main' && colors.get(c.key);
              return (
                <label class="course-tile">
                  <input type="checkbox" name="show" value={c.key} checked={!hidden.has(c.key)} />
                  <span class="tile-body">
                    <span class="tile-head">
                      {color && <span class="course-dot" style={`background: ${GOOGLE_EVENT_COLORS[color]};`} aria-hidden="true" />}
                      <span class="title-3">{title}</span>
                      <span class="tile-check" aria-hidden="true"><Icon name="check" size={14} /></span>
                    </span>
                    {name && <span class="caption-2 text-secondary tile-name">{name}</span>}
                  </span>
                </label>
              );
            })}
          </div>
        ) : (
          <p class="caption-2 text-secondary mt-100">Your courses show up here after the next sync.</p>
        )}
        <div class="divider mt-200" />
        <label class="switch-row">
          <span class="switch-text">
            <span class="title-4">Week labels</span>
            <span class="caption-2 text-secondary">An all day "Week 7" or "Recess week" on each Monday</span>
          </span>
          <input class="switch" type="checkbox" role="switch" name="weeks" value="1" checked={user.week_labels !== 0} />
        </label>
        <div class="courses-actions"><button class="btn btn-primary button-md" type="submit">Save changes</button></div>
      </form>
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
          <li>Deletes the "NUS semester" calendar and its {total} events from your Google account. Your own calendars aren't touched.</li>
          <li>Revokes Semsync's access to your Google account.</li>
        </>
      ) : user.mode === 'feed' ? (
        <li>Turns off your subscribe link. Remove "NUS semester" from your calendar app yourself.</li>
      ) : (
        <li>Deletes the "NUS semester" calendar and its {total} events. Your own calendar isn't touched.</li>
      )}
      {user.mode !== 'feed' && user.feed_token_hash && <li>Turns off your subscribe link.</li>}
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

/** A short summary of what's set up, with the way to change it. */
const SetupSummary: FC<{ user: UserRow }> = ({ user }) => {
  const courses = jsonList<Course>(user.courses);
  const hidden = new Set(jsonList<string>(user.hidden_courses));
  const shown = courses.filter((c) => !hidden.has(c.key)).length;
  const rows: [IconName, string, string][] = [
    ['graduationCap', 'Canvas', user.canvas_feed_enc ? 'Connected' : 'Not added'],
    ['calendarDots', 'NUSMods', user.nusmods_link ? 'Connected' : 'Not added'],
    ['check', 'Courses', courses.length ? `${shown} of ${courses.length} included` : 'After the next sync'],
  ];
  return (
    <section class="panel dash-summary" aria-labelledby="setup-title">
      <h2 id="setup-title" class="title-2">Your setup</h2>
      <ul class="summary">
        {rows.map(([icon, label, value]) => (
          <li><Icon name={icon} size={18} /><span class="body-5">{label}</span><span class="caption-2 text-secondary">{value}</span></li>
        ))}
      </ul>
      <div class="sources-actions"><a class="btn btn-secondary button-md" href="/settings"><Icon name="gear" size={18} />Settings</a></div>
    </section>
  );
};

const countsLine = (counts: Record<string, number>) =>
  (['deadline', 'class', 'exam'] as const).map((k) => `${counts[k] ?? 0} ${COUNT_LABEL[k]}`).join(' · ');

export const Home: FC<{
  user: UserRow; csrf: string; addUrl: string | null; needsConnect: boolean; counts: Record<string, number>;
  upcoming: UpcomingRow[]; flash?: string; dev: boolean; feedLink?: string | null;
  /** Near a new term: which term the NUSMods link is for, and which one to paste now. */
  timetable?: { saved: string; wanted: string } | null;
}> = ({ user, csrf, addUrl, needsConnect, counts, upcoming, flash, dev, feedLink, timetable }) => {
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
        {timetable && (
          <div class="notice notice-warning body-6" role="status">
            <Icon name="calendarDots" />
            <span>
              Your NUSMods link is for {timetable.saved}. Paste your {timetable.wanted} link to add its classes and exams.{' '}
              <a href="/setup?edit=1">Update link</a>
            </span>
          </div>
        )}
        {user.last_sync_message && (isAddingMessage(user.last_sync_message) && user.last_sync_ok !== 0 ? (
          <div class="notice notice-info body-6" role="status">
            <Icon name="arrowsClockwise" />{user.last_sync_message}
          </div>
        ) : (
          <div class={`notice ${user.last_sync_ok === 0 ? 'notice-error' : 'notice-warning'} body-6`} role="status">
            <Icon name="warningCircle" />{user.last_sync_message}
          </div>
        ))}

        <div class="dash">
          <section class="panel dash-agenda" aria-labelledby="coming-up">
            <div class="panel-head">
              <h2 id="coming-up" class="title-1">Coming up</h2>
              <span class="caption-2 text-secondary">{countsLine(counts)} this semester</span>
            </div>
            <UpcomingList upcoming={upcoming} failed={failing} />
          </section>
          <div class="dash-side">
            <div class="dash-dest"><Destination user={user} csrf={csrf} addUrl={addUrl} needsConnect={needsConnect} feedLink={feedLink} dev={dev} /></div>
            <SetupSummary user={user} />
          </div>
        </div>

        <dialog class="confirm" id="delete-dialog" aria-labelledby="delete-title">
          <DeleteConfirm user={user} csrf={csrf} total={total(counts)} dialog />
        </dialog>
      </div>
    </Layout>
  );
};

/** Everything you can change, in one place: courses, links and your account. */
/** A button that posts a form with the CSRF token: for the small actions in Settings. */
const PostButton: FC<{ action: string; csrf: string; label: string; kind?: 'primary' | 'secondary' | 'tertiary'; busy?: string }> = ({
  action, csrf, label, kind = 'secondary', busy,
}) => (
  <form method="post" action={action} data-busy-label={busy}>
    <input type="hidden" name="csrf" value={csrf} />
    <button class={`btn btn-${kind} button-md`} type="submit">{label}</button>
  </form>
);

/** The subscribe link in Settings: get one, or copy, replace and turn off the one you have. */
const CalendarApps: FC<{ user: UserRow; csrf: string; feedLink?: string | null }> = ({ user, csrf, feedLink }) => (
  <section class="panel" id="apps" aria-labelledby="apps-title">
    <h2 id="apps-title" class="title-2">{user.mode === 'feed' ? 'Your calendar app' : 'Outlook and Apple Calendar'}</h2>
    {feedLink ? (
      <>
        <p class="caption-2 text-secondary mt-75">
          {user.mode === 'feed'
            ? 'Your events reach your calendar app through this private link.'
            : 'The same events, as a private link for Outlook, Apple Calendar or any other app.'}
        </p>
        <FeedLink url={feedLink} />
        <AppSteps />
        <div class="sources-actions">
          <PostButton action="/feed/reset" csrf={csrf} label="Replace link" busy="Replacing…" />
          {user.mode === 'feed'
            ? <a class="btn btn-tertiary button-md" href="/connect">Use Google Calendar instead</a>
            : <PostButton action="/feed/off" csrf={csrf} label="Turn off" kind="tertiary" />}
        </div>
      </>
    ) : (
      <>
        <p class="caption-2 text-secondary mt-75">Use one of those too? Get a private link any calendar app can subscribe to.</p>
        <div class="sources-actions"><PostButton action="/feed/on" csrf={csrf} label="Get a subscribe link" busy="Making your link…" /></div>
      </>
    )}
  </section>
);

const shortDay = (ms: number) => new Date(ms).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', timeZone: SGT });

/**
 * An AI assistant's tile. Claude's or ChatGPT's own logo only when its return address proves it's them (verifiedBrand);
 * an app on someone's computer gets a computer, whatever it calls itself.
 */
const AppMark: FC<{ host: string; local: boolean; large?: boolean }> = ({ host, local, large }) => {
  const brand = verifiedBrand({ host, local });
  const size = large ? 30 : 20;
  return (
    <span class={`app-mark${large ? ' app-mark-lg' : ''} ${brand ? `app-mark-logo app-mark-${brand}` : 'app-mark-plain'}`} aria-hidden="true">
      {brand === 'claude' ? <ClaudeMark size={size} /> : brand === 'chatgpt' ? <ChatgptMark size={size} /> : <Icon name={local ? 'desktop' : 'plugsConnected'} size={size} />}
    </span>
  );
};

/** An address to copy: the field, with Copy beside it. */
const CopyField: FC<{ id: string; value: string; label: string }> = ({ id, value, label }) => (
  <div class="copy-field">
    <input class="input mono caption-5" id={id} value={value} readonly aria-label={label} data-select />
    <button class="btn btn-secondary button-md" type="button" data-copy={id}><Icon name="copy" size={16} /><span>Copy</span></button>
  </div>
);

/** What an AI assistant will and won't see, on the approval page. */
const AccessCards: FC = () => {
  return (
    <div class="access">
      <div class="access-card">
        <h2 class="title-3">It will see</h2>
        <ul class="access-list body-6">
          <li><Icon name="checkCircle" size={18} cls="access-yes" />Your deadlines, classes and exams: titles, days and times</li>
          <li><Icon name="checkCircle" size={18} cls="access-yes" />Your module codes and names</li>
        </ul>
      </div>
      <div class="access-card">
        <h2 class="title-3">It won't see or do</h2>
        <ul class="access-list body-6">
          <li><Icon name="xCircle" size={18} cls="access-no" />Your Canvas or NUSMods links</li>
          <li><Icon name="xCircle" size={18} cls="access-no" />Your email or your subscribe link</li>
          <li><Icon name="xCircle" size={18} cls="access-no" />Change anything in Semsync or your calendar</li>
        </ul>
      </div>
    </div>
  );
};

/**
 * A made up exchange, to show what asking looks like: Friday of Week 12, as in the hero picture. It's drawn as the same
 * kind of window as the Canvas and NUSMods pictures above it, so the Help page reads as one set.
 */
const ChatDemo: FC = () => (
  <figure class="chat-demo" role="img" aria-label="An AI assistant, asked what's due this week, answers with two deadlines from Semsync">
    <div class="gs-bar">
      <span class="chat-title caption-4">Your AI assistant</span>
    </div>
    <div class="chat-body">
      <p class="chat-ask body-6">What's due this week?</p>
      <div class="chat-answer">
        <span class="chat-tool caption-4"><BrandMark size={16} />Checked Semsync</span>
        <p class="body-6">Two things are due this week:</p>
        <ul class="chat-items">
          <li class="chip chip-deadline caption-4">CS2040 Problem Set 5 · Fri, 23:59</li>
          <li class="chip chip-deadline caption-4">ES2660 Essay draft · Sun</li>
        </ul>
      </div>
    </div>
    <div class="chat-input caption-2">
      Ask about your semester<span class="chat-send"><Icon name="arrowRight" size={14} /></span>
    </div>
  </figure>
);

/** AI assistants allowed to read the semester through the MCP server, and the address to add one with. */
const AiAssistants: FC<{ csrf: string; apps: ConnectedApp[]; mcpUrl: string }> = ({ csrf, apps, mcpUrl }) => (
  <section class="panel" id="ai" aria-labelledby="ai-title">
    <h2 id="ai-title" class="title-2">AI assistants</h2>
    <p class="caption-2 text-secondary mt-75">
      Let Claude, ChatGPT or another AI assistant answer questions about your semester. Add this address as a connector, then allow
      it. <a href="/help#ai">How to add it</a>
    </p>
    <CopyField id="mcp-url" value={mcpUrl} label="Semsync's address for AI assistants" />
    {apps.length ? (
      <ul class="connected-list">
        {apps.map((app) => (
          <li class="connected-app">
            <AppMark host={app.host} local={app.local} />
            <div class="connected-app-text">
              <p class="title-4">{app.name}</p>
              <p class="caption-2 text-secondary">{app.local ? 'On your computer' : app.host}</p>
              <p class="caption-2 text-secondary connected-app-dates">
                <span>Allowed {shortDay(app.created_at)}</span> ·{' '}
                <span>{app.last_used_at ? `Last used ${shortDay(app.last_used_at)}` : 'Not used yet'}</span>
              </p>
            </div>
            <form method="post" action="/apps/remove">
              <input type="hidden" name="csrf" value={csrf} />
              <input type="hidden" name="id" value={app.id} />
              <button class="btn btn-tertiary button-md" type="submit" aria-label={`Remove ${app.name}`}>Remove</button>
            </form>
          </li>
        ))}
      </ul>
    ) : (
      <div class="connected-list">
        <div class="connected-app">
          <span class="app-mark" aria-hidden="true"><Icon name="plugsConnected" size={20} /></span>
          <div class="connected-app-text">
            <p class="title-4">Nothing connected yet</p>
            <p class="caption-2 text-secondary">Assistants you allow show up here.</p>
          </div>
        </div>
      </div>
    )}
  </section>
);

export const Settings: FC<{
  user: UserRow; csrf: string; counts: Record<string, number>; flash?: string; dev: boolean; feedLink?: string | null;
  apps?: ConnectedApp[]; mcpUrl?: string;
}> = ({
  user, csrf, counts, flash, dev, feedLink, apps = [], mcpUrl = 'https://semsync.live/mcp',
}) => (
  <Layout title="Settings · Semsync" signedIn current="settings" noindex account={{ email: user.email, name: user.name, csrf }}>
    <div class="wrap narrow page">
      <BackLink signedIn />
      <h1 class="heading-3">Settings</h1>
      {flash && <div class="notice notice-success body-6" role="status"><Icon name="checkCircle" />{flash}</div>}
      <div class="settings-sections">
        <CoursesPanel user={user} csrf={csrf} />
        <Sources user={user} dev={dev} />
        <CalendarApps user={user} csrf={csrf} feedLink={feedLink} />
        {user.mode === 'shared' && (
          <section class="panel" aria-labelledby="where-title">
            <h2 id="where-title" class="title-2">Move to your own calendar</h2>
            <p class="caption-2 text-secondary mt-75">Your events are in a shared calendar, which can't have reminders or module colours.</p>
            <div class="sources-actions">
              <a class="btn btn-primary button-md" href="/connect">Move my events</a>
            </div>
          </section>
        )}
        <AiAssistants csrf={csrf} apps={apps} mcpUrl={mcpUrl} />
        <section class="panel" aria-labelledby="account-title">
          <h2 id="account-title" class="title-2">Account</h2>
          <p class="caption-2 text-secondary mt-75 account-email">Signed in as {user.email}.</p>
          <div class="sources-actions">
            <form method="post" action="/auth/logout">
              <input type="hidden" name="csrf" value={csrf} />
              <button class="btn btn-secondary button-md" type="submit"><Icon name="signOut" size={18} />Sign out</button>
            </form>
            <a class="btn btn-tertiary button-md danger-link" href="/account/delete" data-confirm="delete-dialog"><Icon name="trash" size={18} />Delete my data</a>
          </div>
        </section>
      </div>
      <dialog class="confirm" id="delete-dialog" aria-labelledby="delete-title">
        <DeleteConfirm user={user} csrf={csrf} total={total(counts)} dialog />
      </dialog>
    </div>
  </Layout>
);

/** How to find your links, and the questions, for anyone who needs more than the landing page. */
export const Help: FC<Viewer> = ({ signedIn, setupPending, account, origin }) => (
  <Layout title="Help · Semsync" current="help" path="/help" signedIn={signedIn} setupPending={setupPending} account={account} origin={origin}>
    <div class="wrap page">
      <BackLink signedIn={signedIn} />
      <h1 class="heading-2">Help</h1>
      <p class="lead body-7">Where to find your two links, and answers to common questions.</p>
      <section class="help-section" aria-labelledby="links">
        <div class="section-head">
          <h2 id="links" class="heading-4">Where to find your links</h2>
          <p class="body-6 text-secondary mt-75">Each one takes a few clicks. Here's exactly where they are.</p>
        </div>
        <LinkGuides />
      </section>
      <section class="help-section" aria-labelledby="ai">
        <div class="section-head">
          <h2 id="ai" class="heading-4">Ask Claude, ChatGPT or another AI assistant</h2>
          <p class="body-6 text-secondary mt-75">Connect Semsync once, then ask about your semester in your own words.</p>
        </div>
        <div class="ai-help">
          <ol class="ai-steps">
            <li class="ai-step">
              <span class="step-no title-4">1</span>
              <div class="step-body">
                <p class="title-3">Add Semsync as a connector</p>
                <p class="caption-2 text-secondary">In Claude: Settings, Connectors, Add custom connector.</p>
                <CopyField id="help-mcp-url" value={`${origin ?? 'https://semsync.live'}/mcp`} label="Semsync's address for AI assistants" />
              </div>
            </li>
            <li class="ai-step">
              <span class="step-no title-4">2</span>
              <div class="step-body">
                <p class="title-3">Allow it</p>
                <p class="caption-2 text-secondary">Choose Allow on Semsync's page. It can only read your deadlines, classes and exams.</p>
              </div>
            </li>
            <li class="ai-step">
              <span class="step-no title-4">3</span>
              <div class="step-body">
                <p class="title-3">Ask away</p>
                <p class="caption-2 text-secondary">Remove it any time in Settings.</p>
              </div>
            </li>
          </ol>
          <ChatDemo />
        </div>
      </section>
      <section class="help-section faq-grid" aria-labelledby="faq">
        <div class="section-head">
          <h2 id="faq" class="heading-4">Questions</h2>
          <p class="body-6 text-secondary mt-75">Everything about your data is on the <a href="/privacy">privacy page</a>.</p>
        </div>
        <FaqList />
      </section>
    </div>
  </Layout>
);

/** The confirmation as its own page, for when JavaScript is off and the dialog can't open. */
export const DeleteData: FC<{ user: UserRow; csrf: string; counts: Record<string, number> }> = ({ user, csrf, counts }) => (
  <Layout title="Delete your data · Semsync" signedIn noindex account={{ email: user.email, name: user.name, csrf }}>
    <div class="wrap narrow page">
      <div class="panel confirm-page"><DeleteConfirm user={user} csrf={csrf} total={total(counts)} /></div>
    </div>
  </Layout>
);

/**
 * Where an AI assistant sends someone to approve it: the app's name (its own claim) next to where they'll be sent back
 * (checked), exactly what it will and won't see, then Allow or Cancel. The request's fields ride along in the form and are
 * checked again when it's sent.
 */
export const Approve: FC<{
  user: UserRow; csrf: string; appName: string; host: string; local: boolean; setUp: boolean; fields: Record<string, string>;
}> = ({ user, csrf, appName, host, local, setUp, fields }) => (
  <Layout title="Allow an AI assistant · Semsync" signedIn noindex account={{ email: user.email, name: user.name, csrf }}>
    <div class="wrap narrow page approve">
      <div class="approve-head">
        <div class="approve-marks" aria-hidden="true">
          <AppMark host={host} local={local} large />
          <span class="approve-link" />
          <BrandMark size={56} />
        </div>
        <h1 class="heading-4">Let {appName} see your semester?</h1>
        <p class="lead body-3">
          {local ? 'This request comes from an app running on your own computer.' : <>After this, you'll go back to <strong>{host}</strong>.</>}
        </p>
      </div>
      {local && (
        <div class="notice notice-warning body-6" role="note">
          <Icon name="warningCircle" />Only allow this if you just added Semsync to an app on this computer yourself.
        </div>
      )}
      <AccessCards />
      <p class="caption-2 text-secondary mt-200">What the app reads goes to the company that makes it. You can remove it any time in Settings.</p>
      {!setUp && (
        <div class="notice notice-info body-6" role="note">
          <Icon name="warningCircle" />Set up Semsync first, so you can see and remove the app in Settings. Then connect it again from the app.
        </div>
      )}
      <form method="post" action="/oauth/authorize" class="approve-actions">
        <input type="hidden" name="csrf" value={csrf} />
        {Object.entries(fields).map(([name, value]) => <input type="hidden" name={name} value={value} />)}
        {setUp
          ? <button class="btn btn-primary button-md" type="submit" name="decision" value="allow">Allow</button>
          : <a class="btn btn-primary button-md" href="/setup">Set up Semsync</a>}
        <button class="btn btn-secondary button-md" type="submit" name="decision" value="deny">Cancel</button>
      </form>
      <p class="caption-2 text-secondary approve-who">Signed in as {user.email}.</p>
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

export const Privacy: FC<Viewer> = ({ signedIn, setupPending, account, origin }) => (
  <Layout title="Privacy · Semsync" current="privacy" path="/privacy" signedIn={signedIn} setupPending={setupPending} account={account} origin={origin}>
    <div class="wrap narrow page prose">
      <BackLink signedIn={signedIn} />
      <h1 class="heading-4">Privacy</h1>
      <p class="lead body-3">Semsync is a student project. This page explains, in plain words, what it stores and why.</p>
      <h2 class="heading-6">What Semsync stores</h2>
      <ul class="body-3">
        <li>Your Google account ID, name and email address, from "Continue with Google".</li>
        <li>A Google access token that lets Semsync manage only the calendar it made in your account, encrypted.</li>
        <li>
          If you use a subscribe link (for Outlook or Apple Calendar): the link's secret, encrypted, and a copy of your
          calendar for it. Anyone with the link can see that calendar, so replace it in Settings if it gets out.
        </li>
        <li>Your Canvas calendar feed link, encrypted.</li>
        <li>Your NUSMods share link, if you add one.</li>
        <li>A list of the events it has added for you (title, type and start time), so each sync only sends changes.</li>
        <li>
          If you connect an AI assistant: which one, when you allowed it and last used it, and fingerprints of the passes it holds (never the
          passes themselves).
        </li>
      </ul>
      <h2 class="heading-6">AI assistants</h2>
      <p class="body-3">
        You can let an AI assistant such as Claude or ChatGPT read your semester. Once you allow it, it can see your deadlines, classes and exams
        (titles, days and times) and your module names. It can't see your Canvas or NUSMods links, your email or your subscribe link, and
        it can't change anything. What it reads is sent to the company that makes it and handled under that company's privacy policy,
        not Semsync's. Remove an assistant any time in Settings; deleting your data removes every one too.
      </p>
      <h2 class="heading-6">What Semsync does with calendar access</h2>
      <p class="body-3">
        Google's permission is called "Make secondary Google calendars, and see, create, change and delete events on them". Semsync uses it
        to make one calendar in your account, "NUS semester", and to add your deadlines, classes and exams to it and keep them up to date.
        That permission doesn't let it see, change or delete any other calendar or event.
      </p>
      <p class="body-3">
        A few early users have a shared calendar instead, which Semsync keeps in its own Google account and shares with them. It works
        without any access to their account, until they move to their own calendar.
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
        Use "Delete my data" in Settings. It removes every event Semsync added, revokes its Google access, and deletes every record
        about you straight away. You can also remove Semsync's access any time at myaccount.google.com/permissions.
      </p>
      <h2 class="heading-6">Questions</h2>
      <p class="body-3">
        Ask anything about your data by opening an issue on{' '}
        <a href="https://github.com/gabriel-wan/semsync/issues" target="_blank" rel="noopener">Semsync's GitHub page</a>. Never put your
        Canvas link in it. For anything private, such as a security problem, use the private report form in the{' '}
        <a href="https://github.com/gabriel-wan/semsync/blob/main/SECURITY.md" target="_blank" rel="noopener">security policy</a>.
      </p>
    </div>
  </Layout>
);

export const Terms: FC<Viewer> = ({ signedIn, setupPending, account, origin }) => (
  <Layout title="Terms · Semsync" current="terms" path="/terms" signedIn={signedIn} setupPending={setupPending} account={account} origin={origin}>
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
        Semsync may change or stop at any time. You can delete your data whenever you like in Settings, and the{' '}
        <a href="/privacy">privacy page</a> explains what is stored.
      </p>
    </div>
  </Layout>
);

/**
 * 1200 × 630 card, screenshotted into public/og.png for link previews (see CONTRIBUTING.md). The hero's week rises from
 * the bottom edge in its glow, with the reminder over it, so a shared link shows what Semsync does at a glance.
 */
export const OgCard: FC = () => (
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <link href={FONTS} rel="stylesheet" />
      <style>{raw(CSS)}</style>
      <link rel="stylesheet" href="/site.css" />
      <style>{raw('html, body { width: 1200px; height: 630px; overflow: hidden; } .flow { margin-top: 0; }')}</style>
    </head>
    <body class="mode-dark" style="background: var(--surface-primary); color: var(--text-primary);">
      <div style="position: relative; isolation: isolate; height: 630px; padding: var(--space-600) var(--space-700) 0; display: flex; flex-direction: column;">
        <div style="position: absolute; inset: 0; z-index: -1; background: radial-gradient(30% 50% at 6% 78%, color-mix(in srgb, var(--surface-glow-brand) 95%, transparent), transparent), radial-gradient(28% 50% at 94% 74%, color-mix(in srgb, var(--surface-glow-accent) 85%, transparent), transparent), radial-gradient(40% 14% at 32% 44%, color-mix(in srgb, var(--surface-glow-brand) 45%, transparent), transparent), radial-gradient(30% 14% at 74% 45%, color-mix(in srgb, var(--surface-glow-accent) 40%, transparent), transparent);" />
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div class="brand title-1"><BrandMark size={40} />Semsync</div>
          <Flow dest="Google, Outlook or Apple Calendar" />
        </div>
        <h1 class="heading-2 hero-title" style="margin: var(--space-400) 0 0;">
          Every Canvas deadline in your calendar,<br /> without typing a thing
        </h1>
        {/* The week fills the rest of the card, a little larger than on the site so the events read at feed size, and
            fades out at the bottom edge instead of being cut through a row. */}
        <div class="cal" style="flex: 1; min-height: 0; max-width: none; margin: var(--space-500) 0 0; mask-image: linear-gradient(to bottom, black calc(100% - 110px), transparent);">
          <div style="zoom: 1.15;"><Week /></div>
        </div>
        <Reminder style="width: auto; right: var(--space-500); bottom: var(--space-400);" />
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
            <span><span class="title-3">{s}{s === 'Default' ? ', selected' : ''}</span><span class="hint caption-2">A short hint under the option.</span></span>
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
