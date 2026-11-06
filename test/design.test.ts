import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { UserRow } from '../src/lib/db';
import { DeleteData, Foundations, Help, Home, Landing, OgCard, Privacy, Settings, Setup, Terms } from '../src/views/pages';
import { semesterWeek } from '../src/config';
import { CSS, THEME_KEY } from '../src/views/styles';

// The rules and the browser script are real files the pages load; the tokens are written inline by styles.ts.
const SITE_CSS = readFileSync('public/site.css', 'utf8');
const APP_JS = readFileSync('public/app.js', 'utf8');
const ALL_CSS = `${CSS}\n${SITE_CSS}`;
import { CORE, SYSTEM, SYSTEM_SPEC, contrast, mirror, resolve, saturation, type Mode } from '../src/views/tokens';

const MODES: Mode[] = ['light', 'dark'];

// The figma-designer skill's standard Color System, by group (names normalised to kebab case).
const SKILL_TOKENS = {
  border: ['primary', 'primary-disabled', 'primary-light', 'secondary', 'tertiary', 'action-primary', 'action-disabled',
    'action-secondary', 'error', 'error-disabled', 'success', 'warning', 'warning-disabled'],
  surface: ['primary', 'primary-hover', 'primary-selected', 'primary-subtle', 'secondary', 'secondary-hover',
    'secondary-selected', 'secondary-subtle', 'tertiary', 'tertiary-hover', 'accent', 'accent-subtle', 'info', 'info-subtle',
    'error', 'error-subtle', 'error-darker', 'inverted', 'inverted-hover', 'inverted-disabled', 'warning', 'warning-subtle',
    'warning-hover', 'success', 'success-subtle'],
  action: ['primary', 'primary-hover', 'primary-click', 'primary-disabled', 'secondary', 'secondary-hover', 'secondary-click',
    'error', 'error-hover', 'error-disabled', 'error-subtle', 'warning', 'warning-hover', 'warning-disabled', 'warning-subtle'],
  text: ['primary', 'primary-disabled', 'primary-subtle', 'secondary', 'secondary-disabled', 'tertiary', 'inverted', 'error',
    'error-disabled', 'error-inverted', 'error-inverted-disabled', 'success', 'success-inverted', 'success-inverted-disabled',
    'info', 'info-inverted', 'info-inverted-disabled', 'warning', 'warning-disabled', 'warning-inverted',
    'warning-inverted-disabled'],
  icon: ['default', 'secondary', 'subtle', 'inverted', 'disabled', 'error', 'error-disabled', 'error-inverted-disabled', 'info',
    'info-disabled', 'warning', 'warning-inverted', 'warning-disabled', 'warning-inverted-disabled', 'success',
    'success-inverted-disabled'],
  overlay: ['xs', 'sm', 'md', 'lg', 'xlg'],
};

// [foreground, background, minimum]: 4.5 for body text, 3 for large text and UI parts. These are the pairs the pages use.
const SURFACES = ['surface-primary', 'surface-primary-subtle', 'surface-primary-hover', 'surface-secondary'];
const SUBTLE = ['surface-info-subtle', 'surface-accent-subtle', 'surface-error-subtle', 'surface-warning-subtle', 'surface-success-subtle'];
const PAIRS: [string, string, number][] = [
  ...SURFACES.flatMap((bg): [string, string, number][] => [['text-primary', bg, 4.5], ['text-secondary', bg, 4.5]]),
  ...SUBTLE.map((bg): [string, string, number] => ['text-primary', bg, 4.5]),
  ['text-tertiary', 'surface-primary-subtle', 4.5],
  ['text-error', 'surface-primary', 4.5],
  ['text-error', 'surface-primary-subtle', 4.5],
  ['text-info', 'surface-primary', 4.5],
  ['text-info', 'surface-primary-subtle', 4.5],
  ['text-info', 'surface-info-subtle', 4.5],
  ['text-accent', 'surface-accent-subtle', 4.5],
  ['text-error', 'surface-error-subtle', 4.5],
  ['text-inverted', 'action-primary', 4.5],
  ['text-inverted', 'action-primary-hover', 4.5],
  ['text-inverted', 'action-primary-click', 4.5],
  ['text-primary', 'action-secondary', 4.5],
  ['text-primary', 'action-secondary-hover', 4.5],
  ['text-primary', 'action-secondary-click', 4.5],
  ['text-primary', 'action-error', 4.5],
  ['text-primary', 'action-error-hover', 4.5],
  ['text-warning-inverted', 'action-warning', 4.5],
  ['text-warning-inverted', 'action-warning-hover', 4.5],
  ['border-action-secondary', 'surface-primary-subtle', 3],
  ['border-action-primary', 'surface-primary', 3],
  ['border-action-primary', 'surface-primary-subtle', 3],
  ['border-error', 'surface-primary-subtle', 3],
  ['icon-success', 'surface-primary', 3],
  ['icon-error', 'surface-primary', 3],
  ['icon-success', 'surface-success-subtle', 3],
  ['icon-warning', 'surface-warning-subtle', 3],
  ['icon-error', 'surface-error-subtle', 3],
  ['icon-info', 'surface-info-subtle', 3],
  ['icon-subtle', 'surface-primary-subtle', 3],
  ['text-hero-to', 'surface-primary', 3],
  ['text-on-accent', 'surface-accent', 4.5],
  ['icon-secondary', 'surface-primary-subtle', 3],
  ['text-on-brand', 'surface-brand', 3],
  ['text-accent', 'surface-primary-subtle', 4.5],
];

// Disabled labels don't need 4.5:1, but they must still be visible against their disabled fills.
const DISABLED: [string, string][] = [
  ['text-secondary-disabled', 'surface-secondary-subtle'],
  ['text-secondary-disabled', 'action-primary-disabled'],
  ['text-secondary-disabled', 'action-error-disabled'],
  ['text-secondary-disabled', 'action-warning-disabled'],
];

describe('disabled labels stay visible', () => {
  for (const mode of MODES) {
    for (const [fg, bg] of DISABLED) {
      it(`${mode}: ${fg} on ${bg} ≥ 1.5`, () => {
        expect(contrast(resolve(fg, mode), resolve(bg, mode))).toBeGreaterThanOrEqual(1.5);
      });
    }
  }
});

describe('Color System contrast', () => {
  for (const mode of MODES) {
    for (const [fg, bg, min] of PAIRS) {
      it(`${mode}: ${fg} on ${bg} ≥ ${min}`, () => {
        expect(contrast(resolve(fg, mode), resolve(bg, mode))).toBeGreaterThanOrEqual(min);
      });
    }
  }
});

describe('Color System follows the figma-designer skill', () => {
  it('has every token in the skill\'s standard set', () => {
    for (const [group, names] of Object.entries(SKILL_TOKENS)) {
      for (const n of names) expect(SYSTEM_SPEC[`${group}-${n}`], `${group}-${n}`).toBeDefined();
    }
  });

  it('documents every token the skill does not list', () => {
    const listed = new Set(Object.entries(SKILL_TOKENS).flatMap(([g, ns]) => ns.map((n) => `${g}-${n}`)));
    for (const [name, spec] of Object.entries(SYSTEM_SPEC)) {
      if (!listed.has(name)) expect(spec.added, `${name} needs an "added" reason`).toBeTruthy();
    }
  });

  it('uses the skill\'s Dark aliases unless a reason is given', () => {
    for (const [name, spec] of Object.entries(SYSTEM_SPEC)) {
      if (spec.dark) expect(spec.darkWhy, `${name} overrides the skill's Dark alias without a reason`).toBeTruthy();
    }
  });

  it('mirrors Dark into Light unless a reason is given', () => {
    for (const [name, spec] of Object.entries(SYSTEM_SPEC)) {
      if (spec.light) expect(spec.lightWhy, `${name} overrides the mirrored Light value without a reason`).toBeTruthy();
      else expect(SYSTEM[name].light).toEqual(mirror(SYSTEM[name].dark));
    }
  });

  it('only aliases shades that exist', () => {
    for (const [name, t] of Object.entries(SYSTEM)) {
      for (const [p, s] of [t.light, t.dark]) expect(CORE[p]?.[s], `${name} → ${p}/${s}`).toBeDefined();
    }
  });

  it('has at least 10 shades in every solid palette', () => {
    for (const [p, shades] of Object.entries(CORE)) if (p !== 'grayscale-alpha') expect(Object.keys(shades).length).toBeGreaterThanOrEqual(10);
  });

  it('keeps the one accent colour below 80% saturation, and any coloured primary button too', () => {
    // A near white or near black has no real hue, but HSL saturation is unstable there, so neutrals are skipped.
    const neutral = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
      return Math.max(r, g, b) - Math.min(r, g, b) < 8;
    };
    for (const mode of MODES) {
      expect(saturation(resolve('surface-accent', mode))).toBeLessThan(0.8);
      const button = resolve('action-primary', mode);
      if (!neutral(button)) expect(saturation(button)).toBeLessThan(0.8);
    }
  });

  it('only references tokens that exist', async () => {
    const defined = new Set([...ALL_CSS.matchAll(/--([a-z0-9-]+)\s*:/g)].map((m) => m[1]));
    const html = await Promise.all([Foundations({}), Landing({}), OgCard({})].map(async (n) => String(await (n as { toString(): string }).toString())));
    const used = new Set([...`${ALL_CSS}\n${html.join('\n')}`.matchAll(/var\(--([a-z0-9-]+)\)/g)].map((m) => m[1]));
    expect([...used].filter((u) => !defined.has(u))).toEqual([]);
  });

  it('uses only the allowed dark backgrounds for page and card surfaces', () => {
    const allowed = ['#000000', '#181818', '#1f1f1f', '#272727', '#313131', '#131209'];
    for (const t of ['surface-primary', 'surface-primary-subtle', 'surface-secondary']) expect(allowed).toContain(resolve(t, 'dark'));
  });
});

describe('light and dark toggle', () => {
  const page = async (node: unknown) => String(await (node as { toString(): string | Promise<string> }).toString());

  it('lets a saved choice override the system setting in both directions', () => {
    for (const mode of ['light', 'dark']) expect(CSS).toContain(`:root[data-theme="${mode}"] {`);
  });

  it('applies the saved choice in <head>, before the styles draw anything', async () => {
    const html = await page(Landing({}));
    const head = /<head>([\s\S]*?)<\/head>/.exec(html)![1];
    expect(head.indexOf('semsync-theme')).toBeGreaterThan(-1);
    expect(head.indexOf('semsync-theme')).toBeLessThan(head.indexOf('<style>'));
  });

  it('puts the toggle in the nav on every page', async () => {
    for (const node of [Landing({}), Privacy({}), Terms({})]) expect(await page(node)).toMatch(/<nav[\s\S]*data-theme-toggle[\s\S]*<\/nav>/);
  });
});

describe('navigation', () => {
  const page = async (node: unknown) => String(await (node as { toString(): string | Promise<string> }).toString());

  it('gives Privacy and Terms a visible way back', async () => {
    for (const node of [Privacy({}), Terms({})]) expect(await page(node)).toContain('Back to Semsync');
    expect(await page(Privacy({ signedIn: true }))).toContain('Back to your calendar');
  });

  const newUser: UserRow = {
    id: 'dev:a@example.com', email: 'a@example.com', name: 'A', canvas_feed_enc: null, nusmods_link: null, mode: 'main',
    calendar_id: null, google_refresh_enc: null, needs_reconnect: 0, created_at: 0, last_sync_at: null, last_sync_ok: null,
    last_sync_message: null, week_labels: 1, courses: '[]', hidden_courses: '[]', nusmods_ay: null, input_hash: null, full_sync_at: null, sync_claimed_at: null, feed_token_hash: null, feed_token_enc: null,
  };
  const setup = (user: UserRow) => Setup({ user, csrf: 't', values: { canvas: '', nusmods: '' }, errors: {}, editing: false, dev: false });

  it('lets a new user leave setup: back to the landing page, or sign out', async () => {
    const html = await page(setup(newUser));
    expect(html).toContain('href="/">');
    expect(html).toContain('Back to Semsync');
    expect(html).toMatch(/<form[^>]*action="\/auth\/logout"[\s\S]*Sign out/);
    expect(html).toContain('Signed in as a@example.com');
    // /home would only send them back to setup, so the nav doesn't offer it.
    expect(/<nav[\s\S]*?<\/nav>/.exec(html)![0]).not.toContain('href="/home"');
  });

  it('asks only for two links, and says Google asks for calendar access next', async () => {
    const html = await page(Setup({ user: newUser, csrf: 't', values: { canvas: '', nusmods: '' }, errors: {}, editing: false, dev: false, asksAccess: true }));
    expect(html).not.toContain('type="radio"');
    expect(html.toLowerCase()).not.toContain('shared calendar');
    expect(html).toContain('Next, Google asks');
    expect(await page(setup(newUser))).not.toContain('Next, Google asks');
  });

  it('sends someone who has set up back to their calendar from setup', async () => {
    const html = await page(setup({ ...newUser, canvas_feed_enc: 'x', calendar_id: 'primary' }));
    expect(html).toContain('Back to your calendar');
  });

  it('shows the landing page to a signed in user who has not set up, leading back to setup', async () => {
    const html = await page(Landing({ pendingSetup: true }));
    expect(html).not.toContain('/auth/google');
    expect(/<header class="hero">[\s\S]*?<\/header>/.exec(html)![0]).toContain('href="/setup"');
    expect(/<nav[\s\S]*?<\/nav>/.exec(html)![0]).toContain('Finish setup');
  });

  it('has no unfilled placeholders on Privacy or Terms', async () => {
    for (const node of [Privacy({}), Terms({})]) expect(await page(node)).not.toContain('{{');
  });
});

describe('link guides', () => {
  const page = async (node: unknown) => String(await (node as { toString(): string | Promise<string> }).toString());

  it('walks through Canvas and NUSMods on the Help page, three steps each, with a target for every step', async () => {
    const html = await page(Help({}));
    expect(html).toContain('id="links"');
    const guides = html.split('data-guide="true"').slice(1);
    expect(guides).toHaveLength(2);
    for (const g of guides) {
      for (const i of [0, 1, 2]) {
        expect(g).toContain(`data-go="${i}"`);
        expect(g).toContain(`data-target="${i}"`);
      }
    }
  });

  it('shows the same signed-out nav on every public page, without a Sign in button that comes and goes', async () => {
    const nav = async (node: unknown) => /<nav[\s\S]*?<\/nav>/.exec(await page(node))![0].replace(/ aria-current="page"/g, '').replace(/href="#/g, 'href="/#');
    const landing = await nav(Landing({}));
    expect(landing).not.toContain('/auth/google');
    for (const node of [Help({}), Privacy({}), Terms({})]) expect(await nav(node)).toBe(landing);
    // "How it works" lands on the whole section (steps and the setup picture), not just its heading.
    expect(await page(Landing({}))).toMatch(/<section[^>]*id="how"/);
  });

  it('keeps your account menu on Help, Privacy and Terms, and shows Finish setup until you have', async () => {
    const account = { email: 'a@example.com', name: null, csrf: 't' };
    for (const View of [Help, Privacy, Terms]) {
      const html = await page(View({ signedIn: true, account }));
      expect(html).toContain('id="account-menu"');
      expect(html).toContain('href="/settings"');
      expect(await page(View({ signedIn: true, setupPending: true, account }))).toContain('Finish setup');
      expect(await page(View({}))).not.toContain('id="account-menu"');
    }
  });

  it('puts the matching guide under each "Where do I find this?" on setup', async () => {
    const html = await page(Setup({ user: { id: 'x', email: 'a@example.com', name: null, canvas_feed_enc: null, nusmods_link: null, mode: 'main',
      calendar_id: null, google_refresh_enc: null, needs_reconnect: 0, created_at: 0, last_sync_at: null, last_sync_ok: null, last_sync_message: null, week_labels: 1, courses: '[]', hidden_courses: '[]', nusmods_ay: null, input_hash: null, full_sync_at: null, sync_claimed_at: null, feed_token_hash: null, feed_token_enc: null },
      csrf: 't', values: { canvas: '', nusmods: '' }, errors: {}, editing: false, dev: false }));
    expect(html).toContain('canvas.nus.edu.sg/calendar');
    expect(html).toContain('nusmods.com/timetable/sem-1');
    expect(html.match(/data-guide="true"/g)).toHaveLength(2);
  });
});

describe('navigation, continued', () => {
  const page = async (node: unknown) => String(await (node as { toString(): string | Promise<string> }).toString());

  it('says just Semsync in the browser tab on every page', async () => {
    const pages = [Landing({}), Privacy({}), Terms({}), Privacy({ signedIn: true })];
    for (const node of pages) expect(/<title>([^<]*)<\/title>/.exec(await page(node))![1]).toBe('Semsync');
  });

  it('shows just the name in the browser tab, and the full line in link previews', async () => {
    const html = await page(Landing({}));
    expect(/<title>([^<]*)<\/title>/.exec(html)![1]).toBe('Semsync');
    expect(html).toContain('<meta property="og:title" content="Semsync: your NUS semester in your calendar"/>');
  });
});

describe('your Semsync page', () => {
  const page = async (node: unknown) => String(await (node as { toString(): string | Promise<string> }).toString());
  const user: UserRow = {
    id: 'dev:a@example.com', email: 'a@example.com', name: 'A', canvas_feed_enc: 'x', mode: 'shared', calendar_id: 'c',
    nusmods_link: 'https://nusmods.com/timetable/sem-1/share?CS2103T=LEC:G26&ST2334=LEC:1', google_refresh_enc: null,
    needs_reconnect: 0, created_at: 0, last_sync_at: Date.now(), last_sync_ok: 1, last_sync_message: null, week_labels: 1, courses: '[]', hidden_courses: '[]', nusmods_ay: null, input_hash: null, full_sync_at: null, sync_claimed_at: null, feed_token_hash: null, feed_token_enc: null,
  };
  const props = { user, csrf: 't', addUrl: 'https://calendar.google.com/x', needsConnect: false, counts: { deadline: 2, class: 5, exam: 1 }, dev: false,
    upcoming: [{ title: '[CS2103T] Quiz', kind: 'deadline' as const, start_ms: Date.now(), all_day: 0 }] };

  it('asks before deleting, in a dialog, with the real numbers', async () => {
    const html = await page(Home(props));
    expect(html).toMatch(/<dialog[^>]*id="delete-dialog"[\s\S]*action="\/account\/delete"[\s\S]*Delete everything[\s\S]*<\/dialog>/);
    expect(html).toContain('data-confirm="delete-dialog"');
    expect(html).toContain('its 8 events');
    const dialog = /<dialog[\s\S]*?<\/dialog>/.exec(html)![0];
    expect(dialog).not.toContain('type="checkbox"'); // the dialog is the confirmation, not a tick box
  });

  it('offers anyone still on the old shared calendar a one-step move to their own', async () => {
    const html = await page(Home(props));
    expect(html).toContain('Move to your own calendar');
    expect(html).toMatch(/href="\/connect"[^>]*>Move my events/);
    expect(await page(Settings({ user, csrf: 't', counts: props.counts, dev: false }))).toContain('href="/connect"');
  });

  it("never offers a shared calendar to someone on their own", async () => {
    const own = { ...user, mode: 'main' as const, calendar_id: 'nus-semester', google_refresh_enc: 'x' };
    for (const node of [Home({ ...props, user: own, addUrl: null }), Settings({ user: own, csrf: 't', counts: props.counts, dev: false })]) {
      const html = (await page(node)).toLowerCase();
      expect(html).not.toContain('shared calendar');
      expect(html).not.toContain('href="/connect"');
    }
    expect((await page(Home({ ...props, user: { ...own, google_refresh_enc: null }, addUrl: null, needsConnect: true })))).toContain('href="/connect"');
  });

  it('has the same confirmation as a page for when JavaScript is off', async () => {
    const html = await page(DeleteData({ user, csrf: 't', counts: props.counts }));
    expect(html).toContain('Delete everything');
    expect(html).toContain('href="/home"');
  });

  it('puts today first in the agenda, and the courses from the NUSMods link on Settings', async () => {
    expect(await page(Home(props))).toMatch(/agenda-date today[\s\S]*Today/);
    expect(await page(Settings({ user, csrf: 't', counts: props.counts, dev: false }))).toContain('<span class="mod caption-4">CS2103T</span>');
  });

  it('keeps your page to the glance, with settings one click away', async () => {
    const html = await page(Home(props));
    expect(html).not.toContain('action="/courses"');
    expect(html).toContain('href="/settings"');
    expect(html).toContain('2 deadlines · 5 classes · 1 exams this semester');
  });
});

describe('semester week', () => {
  it('names the NUS week, counting recess week', () => {
    expect(semesterWeek(new Date('2026-11-04T04:00:00Z')).label).toBe('Week 12');
    expect(semesterWeek(new Date('2026-09-22T04:00:00Z')).label).toBe('Recess week');
    expect(semesterWeek(new Date('2026-09-29T04:00:00Z')).label).toBe('Week 7');
    expect(semesterWeek(new Date('2026-11-17T04:00:00Z')).label).toBe('Reading week');
    expect(semesterWeek(new Date('2026-11-25T04:00:00Z')).label).toBe('Exams');
    expect(semesterWeek(new Date('2026-12-20T04:00:00Z'))).toEqual({ label: 'Semester break', detail: 'AY2026/27 Semester 2 starts 11 Jan' });
  });
});

describe('account menu', () => {
  const page = async (node: unknown) => String(await (node as { toString(): string | Promise<string> }).toString());
  it('puts sign out and delete in a menu in the nav, not on the page', async () => {
    const user: UserRow = {
      id: 'dev:a@example.com', email: 'a@example.com', name: 'Ann', canvas_feed_enc: 'x', mode: 'main', calendar_id: 'primary',
      nusmods_link: null, google_refresh_enc: 'x', needs_reconnect: 0, created_at: 0, last_sync_at: Date.now(), last_sync_ok: 1, last_sync_message: null, week_labels: 1, courses: '[]', hidden_courses: '[]', nusmods_ay: null, input_hash: null, full_sync_at: null, sync_claimed_at: null, feed_token_hash: null, feed_token_enc: null,
    };
    const html = await page(Home({ user, csrf: 't', addUrl: null, needsConnect: false, counts: {}, upcoming: [], dev: false }));
    const nav = /<nav[\s\S]*?<\/nav>/.exec(html)![0];
    expect(nav).toContain('popovertarget="account-menu"');
    expect(nav).toMatch(/action="\/auth\/logout"[\s\S]*Sign out/);
    expect(nav).toContain('Delete my data');
    expect(html.replace(nav, '')).not.toContain('action="/auth/logout"');
  });
});

describe('page script', () => {
  it('parses, so one mistake can not switch off every interactive part at once', async () => {
    const { THEME_INIT } = await import('../src/views/styles');
    expect(() => new Function(APP_JS)).not.toThrow();
    expect(() => new Function(THEME_INIT)).not.toThrow();
  });

  it('saves the light or dark choice under the key the page reads before it draws', () => {
    expect(APP_JS).toContain(`localStorage.setItem('${THEME_KEY}'`);
  });

  it('is loaded on every page, after the inline tokens, with the stylesheet', async () => {
    const html = String(await (Landing({}) as unknown as { toString(): Promise<string> }).toString());
    expect(html).toMatch(/<script src="\/app\.js" defer(="")?><\/script>/);
    expect(html.indexOf('<link rel="stylesheet" href="/site.css"')).toBeGreaterThan(html.indexOf('<style>'));
  });
});

describe('brand mark', () => {
  const page = async (node: unknown) => String(await (node as { toString(): string | Promise<string> }).toString());

  it('is one drawing everywhere: the nav, the browser tab and the link preview card', async () => {
    const { BRAND_SVG, FAVICON } = await import('../src/views/icons');
    expect(FAVICON).toBe(`data:image/svg+xml,${encodeURIComponent(BRAND_SVG)}`);
    const html = await page(Landing({}));
    expect(html).toContain(`href="${FAVICON}"`);
    expect(/<nav[\s\S]*?<\/nav>/.exec(html)![0]).toContain(BRAND_SVG);
    expect(await page(OgCard({}))).toContain(BRAND_SVG);
    // Browsers and phones that skip SVG icons get the same mark as files.
    expect(html).toContain('href="/favicon.ico"');
    expect(html).toContain('rel="apple-touch-icon" href="/apple-touch-icon.png"');
  });
});

describe('hero demo', () => {
  const page = async (node: unknown) => String(await (node as { toString(): string | Promise<string> }).toString());

  it('has both links to paste, and the finished week underneath for anyone without the animation', async () => {
    const html = await page(Landing({}));
    const hero = /<header class="hero">[\s\S]*?<\/header>/.exec(html)![0];
    expect(hero).toContain('data-demo');
    expect(hero.match(/data-paste="https:\/\/(canvas\.nus\.edu\.sg|nusmods\.com)\//g)).toHaveLength(2);
    expect(hero.match(/class="ev chip-/g)!.length).toBeGreaterThan(5);
    expect(hero).toContain('due tonight');
  });
});

describe('Outlook and Apple Calendar', () => {
  const page = async (node: unknown) => String(await (node as { toString(): string | Promise<string> }).toString());
  const user: UserRow = {
    id: 'dev:a@example.com', email: 'a@example.com', name: 'A', canvas_feed_enc: 'x', mode: 'main', calendar_id: 'c',
    nusmods_link: null, google_refresh_enc: 'x', needs_reconnect: 0, created_at: 0, last_sync_at: Date.now(), last_sync_ok: 1,
    last_sync_message: null, week_labels: 1, courses: '[]', hidden_courses: '[]', nusmods_ay: null, input_hash: null,
    full_sync_at: null, sync_claimed_at: null, feed_token_hash: null, feed_token_enc: null,
  };
  const link = 'https://semsync.live/feed/abcdefghijklmnopqrstuvwxyz012345.ics';
  const home = { csrf: 't', addUrl: null, needsConnect: false, counts: {}, upcoming: [], dev: false };

  it('offers a subscribe link at setup, as a second way to finish', async () => {
    const html = await page(Setup({ user: { ...user, google_refresh_enc: null, calendar_id: null }, csrf: 't', values: { canvas: '', nusmods: '' }, errors: {}, editing: false, dev: false, asksAccess: true }));
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*name="dest"[^>]*value="feed"[^>]*>Get a subscribe link instead/);
  });

  it('shows someone on the link alone where to paste it, with copy and open buttons', async () => {
    const html = await page(Home({ ...home, user: { ...user, mode: 'feed', calendar_id: 'feed', google_refresh_enc: null }, feedLink: link }));
    expect(html).toContain('In your calendar app');
    expect(html).toContain(`value="${link}"`);
    expect(html).toContain('href="webcal://semsync.live/feed/');
    expect(html).toContain('data-copy="feed-url"');
    expect(html).toContain('Add Subscribed Calendar');
    expect(html).not.toContain('Open Google Calendar');
  });

  it('lets a Google user add the link in Settings, then replace or turn it off', async () => {
    const off = await page(Settings({ user, csrf: 't', counts: {}, dev: false }));
    expect(off).toMatch(/action="\/feed\/on"[\s\S]*Get a subscribe link/);
    const on = await page(Settings({ user: { ...user, feed_token_hash: 'h' }, csrf: 't', counts: {}, dev: false, feedLink: link }));
    expect(on).toContain('action="/feed/reset"');
    expect(on).toContain('action="/feed/off"');
    // Someone on the link alone can't turn it off, but can move to Google Calendar.
    const feedOnly = await page(Settings({ user: { ...user, mode: 'feed', feed_token_hash: 'h' }, csrf: 't', counts: {}, dev: false, feedLink: link }));
    expect(feedOnly).not.toContain('action="/feed/off"');
    expect(feedOnly).toContain('href="/connect"');
  });

  it('lets someone who skipped Google use the link from the connect card', async () => {
    const html = await page(Home({ ...home, user: { ...user, google_refresh_enc: null }, needsConnect: true }));
    expect(html).toMatch(/action="\/feed\/use"[\s\S]*Use Outlook or Apple Calendar/);
  });

  it('asks for the next NUSMods link when a new term is near', async () => {
    const html = await page(Home({ ...home, user, timetable: { saved: 'AY2026/27 Semester 1', wanted: 'AY2026/27 Semester 2' } }));
    expect(html).toContain('Your NUSMods link is for AY2026/27 Semester 1. Paste your AY2026/27 Semester 2 link');
    expect(html).toContain('href="/setup?edit=1"');
  });
});
