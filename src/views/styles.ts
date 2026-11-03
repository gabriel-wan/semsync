import { SPACING, tokensCss } from './tokens.js';

// Component styles. Every colour is a Color System token, every padding, gap and margin a spacing token, every radius
// a radius token, and every text element uses a named text style class from tokens.ts. Rules from the
// landing-page-design and figma-designer skills: Geist only, flat backgrounds, borders all round or none (dividers are
// 1px elements), 44px touch targets, a 1200 to 1280px desktop container, and cubic-bezier(0.22, 1, 0.36, 1) motion.
const COMPONENTS = `
:root { --ease: cubic-bezier(0.22, 1, 0.36, 1); }
*, *::before, *::after { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body { margin: 0; background: var(--surface-primary); color: var(--text-primary); font-family: 'Geist', system-ui, sans-serif;
  font-size: 16px; line-height: 24px; }
a { color: inherit; }
h1, h2, h3, p { margin: 0; }
h1, h2, h3 { text-wrap: balance; }
p { text-wrap: pretty; }
code, .mono { font-family: 'Geist Mono', ui-monospace, monospace; }
.text-secondary { color: var(--text-secondary); }
.text-info { color: var(--text-info); }
${Object.keys(SPACING).filter((k) => Number(k) >= 25).map((k) => `.mt-${k} { margin-top: var(--space-${k}); }`).join(' ')}
.skip { position: absolute; left: -9999px; }
.skip:focus { left: var(--space-200); top: var(--space-200); background: var(--surface-primary-subtle); padding: 0 var(--space-100);
  border-radius: var(--radius-8); z-index: 10; display: inline-flex; align-items: center; min-height: 44px; }
:focus-visible { outline: 2px solid var(--border-action-primary); outline-offset: 2px; }

/* 1200px of content plus the 16px gutters: the skill's 1200 to 1280px container. */
.wrap { width: 100%; max-width: 1232px; margin: 0 auto; padding: 0 var(--space-200); }
.narrow { max-width: 640px; }
.divider { height: 1px; background: var(--border-primary); }

.nav { position: sticky; top: var(--space-100); z-index: 5; display: flex; justify-content: center; padding: var(--space-100) var(--space-200) 0; }
.nav-bar { display: flex; align-items: center; gap: var(--space-300); padding: var(--space-50) var(--space-50) var(--space-50) var(--space-200);
  border-radius: var(--radius-full); border: 1px solid var(--border-primary);
  background: color-mix(in srgb, var(--surface-primary-subtle) 80%, transparent); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); }
.nav-bar.solo { padding-right: var(--space-200); }
.brand { display: flex; align-items: center; gap: var(--space-75); min-height: 44px; text-decoration: none; }
.brand-mark { width: 24px; height: 24px; border-radius: var(--radius-6); display: grid; place-items: center;
  background: var(--action-primary); color: var(--text-inverted); }
.nav-link { display: inline-flex; align-items: center; min-height: 44px; padding: 0 var(--space-200); border-radius: var(--radius-full);
  text-decoration: none; transition: background-color 300ms var(--ease); }
.nav-link:hover { background: var(--surface-primary-hover); }
.nav-link[aria-current="page"] { background: var(--surface-secondary); }

/* Buttons: Type (Primary | Secondary | Tertiary | Error | Warning) × State (Default | Hover | Pressed | Focus | Disabled),
   in three sizes. The .is-* classes force a state, for the Foundations page. The skill gives Error and Warning no
   Click token, so their pressed state is the hover fill plus the press scale. */
.btn { display: inline-flex; align-items: center; justify-content: center; gap: var(--space-75); min-height: 44px;
  padding: var(--space-75) var(--space-100); border-radius: var(--radius-8); border: 1px solid transparent;
  font-family: inherit; text-decoration: none; cursor: pointer;
  transition: background-color 300ms var(--ease), border-color 300ms var(--ease), transform 500ms var(--ease); }
.btn-lg { min-height: 52px; padding: var(--space-100) var(--space-200); }
/* Small buttons are for dense desktop rows (like the Foundations grid), never as a page's main touch target. */
.btn-sm { min-height: 32px; padding: var(--space-50) var(--space-75); gap: var(--space-50); border-radius: var(--radius-6); }
.btn:active, .btn.is-pressed { transform: scale(0.98); }
.btn.is-focus { outline: 2px solid var(--border-action-primary); outline-offset: 2px; }
.btn-primary { background: var(--action-primary); color: var(--text-inverted); }
.btn-primary:hover, .btn-primary.is-hover { background: var(--action-primary-hover); }
.btn-primary:active, .btn-primary.is-pressed { background: var(--action-primary-click); }
.btn-secondary { background: var(--action-secondary); color: var(--text-primary); }
.btn-secondary:hover, .btn-secondary.is-hover { background: var(--action-secondary-hover); }
.btn-secondary:active, .btn-secondary.is-pressed { background: var(--action-secondary-click); }
.btn-tertiary { background: transparent; color: var(--text-info); }
.btn-tertiary:hover, .btn-tertiary.is-hover { background: var(--surface-primary-hover); }
.btn-tertiary:active, .btn-tertiary.is-pressed { background: var(--surface-primary-selected); }
.btn-error { background: var(--action-error); color: var(--text-primary); }
.btn-error:hover, .btn-error.is-hover, .btn-error:active, .btn-error.is-pressed { background: var(--action-error-hover); }
.btn-warning { background: var(--action-warning); color: var(--text-warning-inverted); }
.btn-warning:hover, .btn-warning.is-hover, .btn-warning:active, .btn-warning.is-pressed { background: var(--action-warning-hover); }
/* text-primary-disabled is the same grey as the disabled fill in dark mode, so disabled labels use text-secondary-disabled. */
.btn:disabled, .btn[aria-disabled="true"] { background: var(--surface-secondary-subtle); color: var(--text-secondary-disabled);
  border-color: transparent; cursor: not-allowed; transform: none; }
.btn-primary:disabled { background: var(--action-primary-disabled); }
.btn-error:disabled { background: var(--action-error-disabled); }
.btn-warning:disabled { background: var(--action-warning-disabled); }
.btn[aria-busy="true"] { cursor: progress; }
.btn svg { flex: none; }
/* Google's sign-in branding asks for its outlined button (white, grey outline, dark label); these tokens match it. */
.btn-google { background: var(--surface-primary-subtle); color: var(--text-primary); border-color: var(--border-action-secondary); }
.btn-google:hover { background: var(--surface-primary-hover); }
.btn-google:active { background: var(--surface-primary-selected); }

/* Inputs: Default | Hover | Pressed | Focus | Filled | Error | Disabled */
.input { display: block; width: 100%; min-height: 44px; margin-top: var(--space-75); padding: var(--space-75) var(--space-100);
  border-radius: var(--radius-8); border: 1px solid var(--border-action-secondary); background: var(--surface-primary-subtle);
  color: var(--text-primary); font-family: inherit; transition: background-color 300ms var(--ease), border-color 300ms var(--ease); }
.input::placeholder { color: var(--text-tertiary); }
.input:hover, .input.is-hover { background: var(--surface-primary-hover); }
.input:active, .input.is-pressed { border-color: var(--border-action-primary); }
.input:focus-visible, .input.is-focus { outline: 2px solid var(--border-action-primary); outline-offset: 2px; }
.input[aria-invalid="true"] { border-color: var(--border-error); }
.input:disabled { background: var(--surface-secondary-subtle); color: var(--text-secondary-disabled); border-color: var(--border-primary-disabled);
  cursor: not-allowed; }

.hero { padding: var(--space-800) 0 var(--space-700); text-align: center; }
.hero-title { max-width: 680px; margin: 0 auto; color: transparent; -webkit-background-clip: text; background-clip: text;
  background-image: linear-gradient(90deg, var(--text-hero-from), var(--text-hero-to)); }
.hero-sub { max-width: 680px; margin: var(--space-300) auto 0; color: var(--text-secondary); }
.cta { margin-top: var(--space-400); display: flex; flex-direction: column; align-items: center; gap: var(--space-100); }
.proof { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: var(--space-75) var(--space-300);
  margin-top: var(--space-400); color: var(--text-secondary); }
.proof blockquote { margin: 0; max-width: 520px; }
@media (max-width: 640px) {
  .hero { padding-top: var(--space-600); }
  .hero-title { font-size: 36px; line-height: 40px; } /* heading-3 on phones */
  .hero-title br { display: none; }
}

.week { margin: var(--space-600) auto 0; max-width: 760px; display: grid; grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: var(--space-75); padding: var(--space-100); border-radius: var(--radius-16); background: var(--surface-primary-subtle);
  border: 1px solid var(--border-primary); text-align: left; }
.day { display: flex; flex-direction: column; gap: var(--space-50); min-height: 160px; }
.day-name { color: var(--text-secondary); padding: 0 var(--space-50) var(--space-50); }
/* Inside the 16px card with 12px padding, the nested radius is 16 - 12 = 4. */
.chip { border-radius: var(--radius-4); padding: var(--space-50) var(--space-75); overflow-wrap: anywhere; }
.chip .mono { display: block; }
.chip-class { background: var(--surface-accent-subtle); color: var(--text-accent); }
.chip-deadline { background: var(--surface-info-subtle); color: var(--text-info); }
.chip-exam { background: var(--surface-error-subtle); color: var(--text-error); }
@media (max-width: 640px) { .week { grid-template-columns: repeat(3, minmax(0, 1fr)); } .day:nth-child(n+4) { display: none; } }

section { padding: var(--space-700) 0; }
.split { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 3fr); gap: var(--space-600); align-items: start; }
.steps { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--space-75); }
.step { display: flex; gap: var(--space-200); padding: var(--space-300); border-radius: var(--radius-16); background: var(--surface-primary-subtle);
  border: 1px solid var(--border-primary); }
.step-no { flex: none; width: 32px; height: 32px; border-radius: var(--radius-full); display: grid; place-items: center;
  background: var(--surface-info-subtle); color: var(--text-info); }
.card { background: var(--surface-primary-subtle); border: 1px solid var(--border-primary); border-radius: var(--radius-16); padding: var(--space-300); }
.card p { color: var(--text-secondary); margin-top: var(--space-75); }
/* Bento: 2 + 1 + 1 on the first row, 2 + 2 on the second, so no row has three equal cards. */
.bento { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--space-200); margin-top: var(--space-400); }
.bento > .card:nth-child(1), .bento > .card:nth-child(4), .bento > .card:nth-child(5) { grid-column: span 2; }
.before-after { display: flex; flex-direction: column; gap: var(--space-75); margin-top: var(--space-200); }
.before-after .was { color: var(--text-secondary); text-decoration: line-through; }
@media (max-width: 768px) {
  .split { grid-template-columns: minmax(0, 1fr); gap: var(--space-300); }
  .bento { grid-template-columns: minmax(0, 1fr); }
  .bento > .card:nth-child(n) { grid-column: auto; }
}

.tagline { max-width: 760px; }
.tagline .w { opacity: 0.3; transition: opacity 600ms var(--ease); }
.tagline .w.lit { opacity: 1; }
@media (max-width: 640px) { .tagline { font-size: 30px; line-height: 36px; } } /* heading-4 on phones */

.reveal { opacity: 0; transform: translateY(32px); transition: opacity 700ms var(--ease), transform 700ms var(--ease); }
.reveal.in { opacity: 1; transform: none; }
@media (prefers-reduced-motion: reduce) {
  .tagline .w { opacity: 1; transition: none; }
  .reveal { opacity: 1; transform: none; transition: none; }
  .btn { transition: none; }
}

details.faq { background: var(--surface-primary-subtle); border: 1px solid var(--border-primary); border-radius: var(--radius-12); }
details.faq + details.faq { margin-top: var(--space-75); }
details.faq summary { cursor: pointer; padding: var(--space-200); min-height: 44px; }
details.faq p { color: var(--text-secondary); padding: 0 var(--space-200) var(--space-200); }

footer { margin-top: var(--space-600); }
.footer-row { display: flex; flex-wrap: wrap; gap: var(--space-200); justify-content: space-between; align-items: center;
  padding: var(--space-400) 0 var(--space-600); color: var(--text-secondary); }
.footer-links { display: flex; gap: var(--space-200); }
.footer-row a { display: inline-flex; align-items: center; min-height: 44px; }

.page { padding-top: var(--space-600); padding-bottom: var(--space-700); }
.lead { color: var(--text-secondary); margin-top: var(--space-75); }
.field { display: block; margin-top: var(--space-300); }
.hint { color: var(--text-secondary); margin-top: var(--space-25); }
.field-error { display: flex; gap: var(--space-50); align-items: center; color: var(--text-error); margin-top: var(--space-50); }
.field-error[hidden] { display: none; }
.help { margin-top: var(--space-50); }
.help summary { cursor: pointer; color: var(--text-info); display: inline-flex; align-items: center; min-height: 44px; }
.help ol { margin: 0; padding-left: var(--space-300); color: var(--text-secondary); }

/* Choice cards: Default | Hover | Pressed | Focus | Disabled, each selected or not */
.choices { border: 0; padding: 0; margin: var(--space-400) 0 0; min-width: 0; }
.choices legend { padding: 0; margin-bottom: var(--space-75); }
.choice { display: flex; gap: var(--space-100); align-items: flex-start; padding: var(--space-200); border-radius: var(--radius-12);
  background: var(--surface-primary-subtle); border: 1px solid var(--border-primary); cursor: pointer;
  transition: background-color 300ms var(--ease), border-color 300ms var(--ease); }
.choice + .choice { margin-top: var(--space-75); }
.choice:hover, .choice.is-hover { background: var(--surface-primary-hover); border-color: var(--border-primary-light); }
.choice:active, .choice.is-pressed { background: var(--surface-primary-selected); }
.choice:has(input:checked) { border-color: var(--border-action-primary); }
.choice:has(input:focus-visible), .choice.is-focus { outline: 2px solid var(--border-action-primary); outline-offset: 2px; }
.choice:has(input:disabled) { background: var(--surface-secondary-subtle); border-color: var(--border-primary-disabled);
  color: var(--text-secondary-disabled); cursor: not-allowed; }
.choice:has(input:disabled) .hint { color: var(--text-secondary-disabled); }
.choice input { width: 20px; height: 20px; margin: var(--space-25) 0 0; flex: none; accent-color: var(--action-primary); }
.choice input:focus-visible { outline: none; }
.choice .hint { display: block; }
.actions { display: flex; flex-wrap: wrap; gap: var(--space-100); margin-top: var(--space-400); align-items: center; }
.actions > form { display: flex; margin: 0; }

.notice { display: flex; gap: var(--space-75); align-items: flex-start; border-radius: var(--radius-12); padding: var(--space-100) var(--space-200);
  margin-top: var(--space-300); color: var(--text-primary); }
.notice svg { flex: none; margin-top: var(--space-25); }
.notice-info { background: var(--surface-info-subtle); }
.notice-info svg { color: var(--icon-info); }
.notice-success { background: var(--surface-success-subtle); }
.notice-success svg { color: var(--icon-success); }
.notice-warning { background: var(--surface-warning-subtle); }
.notice-warning svg { color: var(--icon-warning); }
.notice-error { background: var(--surface-error-subtle); }
.notice-error svg { color: var(--icon-error); }
.status { display: inline-flex; flex-wrap: wrap; align-items: center; gap: var(--space-75); color: var(--text-secondary); margin-top: var(--space-75); }
.dot { width: 8px; height: 8px; border-radius: var(--radius-full); background: var(--icon-success); }
.dot.bad { background: var(--icon-error); }
.stat-bar { display: flex; gap: var(--space-200); margin-top: var(--space-300); padding: var(--space-200); border-radius: var(--radius-12);
  background: var(--surface-secondary); }
.stat { flex: 1; min-width: 0; }
.stat span { display: block; color: var(--text-secondary); }
.vdivider { width: 1px; align-self: stretch; background: var(--border-primary); }
.list { margin-top: var(--space-100); border: 1px solid var(--border-primary); border-radius: var(--radius-12); background: var(--surface-primary-subtle); }
.list > .divider { margin: 0 var(--space-200); }
.row { display: flex; justify-content: space-between; align-items: baseline; gap: var(--space-200); padding: var(--space-100) var(--space-200); }
.row time { color: var(--text-secondary); white-space: nowrap; }
.tag { display: inline-block; border-radius: var(--radius-full); padding: var(--space-25) var(--space-75); margin-right: var(--space-75); }
/* List states: Loading (skeleton shaped like the rows), Empty (getting started), Error */
.empty { display: flex; flex-direction: column; align-items: center; text-align: center; gap: var(--space-75); padding: var(--space-400) var(--space-200); }
.empty svg { color: var(--icon-subtle); }
.empty.failed svg { color: var(--icon-error); }
.empty .body-6 { color: var(--text-secondary); }
.skeleton { background: var(--surface-secondary-subtle); border-radius: var(--radius-4); animation: pulse 1200ms var(--ease) infinite alternate; }
@keyframes pulse { from { opacity: 0.5; } to { opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .skeleton { animation: none; } }
.skeleton-row { display: flex; justify-content: space-between; gap: var(--space-200); padding: var(--space-200); }
.loading-panel { margin-top: var(--space-300); }
.loading-panel[hidden] { display: none; }
.danger-zone { margin-top: var(--space-600); padding: var(--space-300); border-radius: var(--radius-16); border: 1px solid var(--border-primary); }
.check { display: flex; gap: var(--space-75); align-items: center; margin-top: var(--space-100); min-height: 44px; }
.check input { width: 20px; height: 20px; margin: 0; accent-color: var(--action-primary); }
.prose h2 { margin-top: var(--space-400); }
.prose p, .prose li { color: var(--text-secondary); }
.prose p { margin-top: var(--space-75); }
.prose ul { margin: var(--space-75) 0 0; padding-left: var(--space-300); }

/* Foundations page */
.mode-panel { background: var(--surface-primary); color: var(--text-primary); border-radius: var(--radius-16); padding: var(--space-300);
  border: 1px solid var(--border-primary); min-width: 0; }
.panels { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-200); margin-top: var(--space-200); }
@media (max-width: 768px) { .panels { grid-template-columns: minmax(0, 1fr); } }
.swatches { display: flex; flex-wrap: wrap; gap: var(--space-75); margin-top: var(--space-75); }
.swatch { display: flex; flex-direction: column; gap: var(--space-25); width: 72px; }
.swatch-chip { height: 40px; border-radius: var(--radius-8); border: 1px solid var(--border-primary); }
.token-row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.4fr); gap: var(--space-100);
  align-items: center; padding: var(--space-75) 0; }
.token-cell { display: flex; gap: var(--space-75); align-items: center; padding: var(--space-75); border-radius: var(--radius-8); min-width: 0; }
.token-cell .swatch-chip { width: 32px; height: 32px; flex: none; }
.spacing-bar { height: 12px; border-radius: var(--radius-2); background: var(--action-primary); }
.radius-sample { width: 48px; height: 48px; background: var(--surface-secondary); border: 1px solid var(--border-action-secondary); }
.state-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: var(--space-75); align-items: center; }
.state-grid .btn { width: 100%; padding-left: var(--space-50); padding-right: var(--space-50); }
.spec { display: flex; flex-direction: column; gap: var(--space-300); }
.spec-row { display: flex; flex-wrap: wrap; align-items: baseline; gap: var(--space-100); }
`;

export const CSS = `${tokensCss()}\n${COMPONENTS}`;

// Reveal on scroll and the word by word tagline (IntersectionObserver, no scroll listeners),
// plus in-browser checks and a loading state for the setup form.
export const SCRIPT = `
(() => {
  const io = 'IntersectionObserver' in window;
  document.querySelectorAll('.reveal').forEach((el) => {
    if (!io) return el.classList.add('in');
    const obs = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('in'); obs.unobserve(e.target); }
    }), { rootMargin: '0px 0px -10% 0px' });
    obs.observe(el);
  });
  const words = io && new IntersectionObserver((entries) => entries.forEach((e) => {
    e.target.classList.toggle('lit', e.isIntersecting || e.boundingClientRect.top < 0);
  }), { rootMargin: '0px 0px -40% 0px' });
  document.querySelectorAll('.tagline .w').forEach((el) => (words ? words.observe(el) : el.classList.add('lit')));

  const busy = (form, label) => {
    const button = form.querySelector('button[type=submit]');
    if (!button) return;
    button.setAttribute('aria-busy', 'true');
    button.textContent = label;
  };
  document.querySelectorAll('form[data-busy-label]:not([data-setup])').forEach((f) => f.addEventListener('submit', () => busy(f, f.dataset.busyLabel)));

  const setup = document.querySelector('form[data-setup]');
  if (!setup) return;
  const canvas = setup.elements.namedItem('canvas');
  const nusmods = setup.elements.namedItem('nusmods');
  const show = (input, message) => {
    const box = document.getElementById(input.id + '-error');
    box.querySelector('span').textContent = message || '';
    box.hidden = !message;
    if (message) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
  };
  [canvas, nusmods].forEach((input) => input.addEventListener('input', () => show(input, '')));
  setup.addEventListener('submit', (event) => {
    const c = canvas.value.trim();
    const n = nusmods.value.trim();
    const errors = [];
    const sample = setup.dataset.dev === '1' && c === 'sample';
    if (c && !sample && !/^(https|webcals?):\\/\\/[^\\/\\s]+\\/feeds\\/calendars\\/\\S+\\.ics$/i.test(c)) {
      errors.push([canvas, "That isn't a Canvas calendar feed link. It should end in .ics."]);
    }
    if (!c && !n && setup.dataset.keepCanvas !== '1') errors.push([canvas, 'Paste your Canvas calendar feed link to get started.']);
    if (n && !/^https:\\/\\/(www\\.)?nusmods\\.com\\/timetable\\/sem-[12]\\/share\\?/i.test(n)) {
      errors.push([nusmods, 'Use the Share/Sync link from your Semester 1 or Semester 2 timetable on NUSMods.']);
    }
    show(canvas, '');
    show(nusmods, '');
    errors.forEach(([input, message]) => show(input, message));
    if (errors.length) {
      event.preventDefault();
      errors[0][0].focus();
      return;
    }
    busy(setup, setup.dataset.busyLabel);
    const panel = document.querySelector('[data-loading]');
    if (panel) panel.hidden = false;
  });
})();
`;
