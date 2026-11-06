import { SPACING, tokensCss } from './tokens.js';

// Component styles. Every colour is a Color System token, every padding, gap and margin a spacing token, every radius
// a radius token, and every text element uses a named text style class from tokens.ts. Rules from the
// landing-page-design and figma-designer skills: Geist only, flat backgrounds, borders all round or none (dividers are
// 1px elements), 44px touch targets, a 1200 to 1280px desktop container, and cubic-bezier(0.22, 1, 0.36, 1) motion.
const COMPONENTS = `
:root { --ease: cubic-bezier(0.22, 1, 0.36, 1); }
*, *::before, *::after { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
/* Links to a spot on a page ("How it works", Help's "Where to find your links") stop below the floating nav, and glide
   there unless motion is turned down. */
html { scroll-padding-top: 104px; }
@media (prefers-reduced-motion: no-preference) { html { scroll-behavior: smooth; } }
body { margin: 0; background: var(--surface-primary); color: var(--text-primary); font-family: 'Geist', system-ui, sans-serif;
  font-size: 16px; line-height: 24px; overflow-x: clip; }
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

/* A compact bar floating off the top edge, sized to its content, translucent over a blur. */
.nav { position: sticky; top: var(--space-100); z-index: 5; display: flex; justify-content: center; padding: var(--space-100) var(--space-200) 0; }
.nav-bar { display: flex; align-items: center; gap: var(--space-200); padding: var(--space-50) var(--space-50) var(--space-50) var(--space-200);
  border-radius: var(--radius-full); border: 1px solid var(--border-primary); box-shadow: 0 8px 24px var(--overlay-xs);
  background: color-mix(in srgb, var(--surface-primary-subtle) 80%, transparent); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); }
.brand { display: flex; align-items: center; gap: var(--space-75); min-height: 44px; text-decoration: none; }
.brand-mark { flex: none; display: block; }
.brand-mark svg { display: block; width: 100%; height: 100%; }
.nav-links { display: flex; align-items: center; gap: var(--space-25); }
.nav-link { display: inline-flex; align-items: center; min-height: 44px; padding: 0 var(--space-200); border-radius: var(--radius-full);
  text-decoration: none; color: var(--text-secondary); transition: background-color 300ms var(--ease), color 300ms var(--ease); }
.nav-link:hover { background: var(--surface-primary-hover); color: var(--text-primary); }
.nav-link[aria-current="page"] { background: var(--surface-secondary); color: var(--text-primary); }
.nav-bar .btn { border-radius: var(--radius-full); }
@media (max-width: 640px) { .nav-bar { gap: var(--space-75); } .nav-link { padding: 0 var(--space-75); } }
@media (max-width: 480px) { .nav-link.section-link { display: none; } }

/* Light and dark toggle: the moon shows in light mode, the sun in dark mode, and they turn and fade into each other.
   It needs JavaScript, so it only appears once the head script has marked the page with .js. */
.theme-toggle { display: none; place-items: center; width: 44px; height: 44px; padding: 0; border: 0; border-radius: var(--radius-full);
  background: transparent; color: var(--icon-secondary); cursor: pointer; transition: background-color 300ms var(--ease); }
.js .theme-toggle { display: grid; }
.theme-toggle:hover { background: var(--surface-primary-hover); }
.theme-toggle svg { grid-area: 1 / 1; transition: opacity 500ms var(--ease), transform 500ms var(--ease); }
.theme-toggle .icon-sun { opacity: 0; transform: rotate(-90deg) scale(0.5); }
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) .theme-toggle .icon-sun { opacity: 1; transform: none; }
  :root:not([data-theme="light"]) .theme-toggle .icon-moon { opacity: 0; transform: rotate(90deg) scale(0.5); }
}
:root[data-theme="dark"] .theme-toggle .icon-sun { opacity: 1; transform: none; }
:root[data-theme="dark"] .theme-toggle .icon-moon { opacity: 0; transform: rotate(90deg) scale(0.5); }
@media (prefers-reduced-motion: reduce) { .theme-toggle svg { transition: none; } }

/* GitHub in the nav: an icon button the same size as the theme toggle. */
.icon-link { display: grid; place-items: center; width: 44px; height: 44px; border-radius: var(--radius-full); color: var(--icon-secondary);
  transition: background-color 300ms var(--ease), color 300ms var(--ease); }
.icon-link:hover { background: var(--surface-primary-hover); color: var(--text-primary); }
.footer-links .footer-github { display: inline-flex; align-items: center; gap: var(--space-50); }
/* Settings: one card per topic, stacked. */
.settings-sections { display: flex; flex-direction: column; gap: var(--space-200); margin-top: var(--space-300); }
.help-section { padding: var(--space-600) 0 0; }
/* Your setup, on your page: one line per thing, the value on the right. */
.summary { list-style: none; margin: var(--space-200) 0 0; padding: 0; display: flex; flex-direction: column; }
.summary li { display: flex; align-items: center; gap: var(--space-100); padding: var(--space-75) 0; color: var(--icon-secondary); }
.summary li + li { margin-top: 0; }
.summary li .body-5 { color: var(--text-primary); }
.summary li .caption-2 { margin-left: auto; text-align: right; }
.dash-summary { display: flex; flex-direction: column; }

/* Course tiles: an even grid, each the same size. Ticked: outlined in blue with a filled tick. Left out: plain and grey. */
.course-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(176px, 1fr)); gap: var(--space-100); margin-top: var(--space-200); }
.course-tile { position: relative; display: block; cursor: pointer; }
.course-tile input { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; opacity: 0; cursor: pointer; }
.tile-body { display: flex; flex-direction: column; gap: var(--space-25); height: 100%; min-height: 80px; padding: var(--space-100) var(--space-200);
  border-radius: var(--radius-12); border: 1px solid var(--border-primary); background: var(--surface-primary);
  transition: border-color 300ms var(--ease), background-color 300ms var(--ease); }
.tile-head { display: flex; align-items: center; gap: var(--space-75); }
.tile-check { margin-left: auto; flex: none; width: 22px; height: 22px; border-radius: var(--radius-full); display: grid; place-items: center;
  border: 1.5px solid var(--border-action-secondary); color: transparent; transition: background-color 300ms var(--ease), color 300ms var(--ease); }
.tile-name { overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.course-tile:hover .tile-body { border-color: var(--border-action-secondary); }
.course-tile input:checked + .tile-body { border-color: var(--border-action-primary); background: var(--surface-primary-subtle); }
.course-tile input:checked + .tile-body .tile-check { border-color: transparent; background: var(--surface-brand); color: var(--text-on-brand); }
.course-tile input:not(:checked) + .tile-body .title-3 { color: var(--text-secondary); }
.course-tile input:focus-visible + .tile-body { outline: 2px solid var(--border-action-primary); outline-offset: 2px; }
@media (max-width: 480px) { .course-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .tile-body { padding: var(--space-100); } }
@media (prefers-reduced-motion: reduce) { .tile-body, .tile-check { transition: none; } }

/* "Back to Semsync" at the top of plain pages; the arrow nudges left on hover. */
.back { display: inline-flex; align-items: center; gap: var(--space-50); min-height: 44px; margin-bottom: var(--space-100);
  color: var(--text-secondary); text-decoration: none; transition: color 300ms var(--ease); }
.back:hover { color: var(--text-primary); }
.back svg { transition: transform 500ms var(--ease); }
.back:hover svg { transform: translateX(calc(-1 * var(--space-50))); }

/* Buttons: Type (Primary | Secondary | Tertiary | Error | Warning) × State (Default | Hover | Pressed | Focus | Disabled),
   in three sizes. The .is-* classes force a state, for the Foundations page. The skill gives Error and Warning no
   Click token, so their pressed state is the hover fill plus the press scale. */
.btn { display: inline-flex; align-items: center; justify-content: center; gap: var(--space-75); min-height: 44px;
  padding: var(--space-75) var(--space-200); border-radius: var(--radius-full); border: 1px solid transparent; white-space: nowrap;
  font-family: inherit; text-decoration: none; cursor: pointer;
  transition: background-color 300ms var(--ease), border-color 300ms var(--ease), transform 500ms var(--ease); }
.btn-lg { min-height: 52px; padding: var(--space-100) var(--space-300); }
/* Small buttons are for dense desktop rows (like the Foundations grid), never as a page's main touch target. */
.btn-sm { min-height: 32px; padding: var(--space-50) var(--space-100); gap: var(--space-50); }
.btn:active, .btn.is-pressed { transform: scale(0.98); }
.btn.is-focus { outline: 2px solid var(--border-action-primary); outline-offset: 2px; }
/* Primary buttons are white on dark pages and near black on light ones. On hover and focus an orange glow fades in:
   it's a pseudo element whose opacity animates, so only opacity and transform ever animate. */
.btn-primary { position: relative; background: var(--action-primary); color: var(--text-inverted); }
.btn-primary::after { content: ''; position: absolute; inset: 0; border-radius: inherit; pointer-events: none; opacity: 0;
  box-shadow: 0 8px 28px color-mix(in srgb, var(--surface-glow-accent) 55%, transparent); transition: opacity 300ms var(--ease); }
.btn-primary:hover::after, .btn-primary:focus-visible::after, .btn-primary.is-hover::after { opacity: 1; }
.btn-primary:hover, .btn-primary.is-hover { background: var(--action-primary-hover); }
.btn-primary:active, .btn-primary.is-pressed { background: var(--action-primary-click); }
/* Secondary buttons are outlined, so they read as buttons without competing with the one primary action. */
.btn-secondary { background: var(--surface-primary-subtle); border-color: var(--border-action-secondary); color: var(--text-primary); }
.btn-secondary:hover, .btn-secondary.is-hover { background: var(--action-secondary); }
.btn-secondary:active, .btn-secondary.is-pressed { background: var(--action-secondary-hover); }
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
/* The sign in button: a pill, like Google's own. Google's branding keeps its G in full colour on white, so on the near
   black (light mode) pill the G sits on a white disc; on the white pill the disc simply blends in. */
.btn-signin { padding: var(--space-75) var(--space-300) var(--space-75) var(--space-75); border-radius: var(--radius-full); }
.btn-signin:hover { transform: translateY(-1px); }
.g-badge { width: 32px; height: 32px; border-radius: var(--radius-full); display: grid; place-items: center; background: var(--surface-white); }

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

/* Hero: left aligned copy beside the live calendar on wide screens, stacked on narrower ones. Left alignment keeps the
   paragraph and the button on one reading edge, which is easier to read than centred lines of uneven length. */
.hero { padding-top: var(--space-800); display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr); gap: var(--space-500);
  align-items: center; }
.hero-copy { min-width: 0; max-width: 560px; }
.hero-title { margin: 0; font-size: clamp(44px, 4.4vw, 60px); line-height: 1.04; color: transparent; -webkit-background-clip: text;
  background-clip: text; background-image: linear-gradient(90deg, var(--text-hero-from), var(--text-hero-to)); }
.hero-sub { max-width: 34em; margin: var(--space-300) 0 0; color: var(--text-secondary); }
.cta { margin-top: var(--space-400); display: flex; flex-direction: column; align-items: flex-start; gap: var(--space-100); }
.hero .showcase { margin-top: 0; padding: var(--space-400) var(--space-300) var(--space-600); }
/* Beside the copy the day columns are narrow, so names wrap onto two lines instead of being cut off, and the start time
   (already in the time column) makes way. */
@media (min-width: 1081px) {
  .hero .ev span { white-space: normal; overflow-wrap: anywhere; }
  .hero .ev .mono { display: none; }
}
@media (max-width: 1080px) {
  .hero { grid-template-columns: minmax(0, 1fr); gap: var(--space-200); }
  .hero-copy { max-width: 640px; }
  .hero .showcase { margin-top: var(--space-300); }
}
.proof { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-75); margin-top: var(--space-400); color: var(--text-secondary); }
.proof blockquote { margin: 0; max-width: 520px; }
/* What it connects, as one line instead of a row of logo pills: the two sources, then an arrow into the calendar.
   The icons sit in small app style tiles; the calendar's is solid blue, since that's where everything ends up. */
.flow { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-100) var(--space-200);
  margin-top: var(--space-400); }
.flow-item { display: inline-flex; align-items: center; gap: var(--space-75); white-space: nowrap; }
.flow-icon { width: 36px; height: 36px; border-radius: var(--radius-8); display: grid; place-items: center;
  background: var(--surface-primary-subtle); color: var(--icon-secondary); box-shadow: 0 1px 2px var(--overlay-xs), 0 6px 16px var(--overlay-xs); }
.flow-dest .flow-icon { background: var(--surface-brand); color: var(--text-on-brand); }
/* The real Canvas and NUSMods marks keep their own colours on a white tile, the way app icons do, in both modes. */
.flow-logo { background: var(--surface-white); }
.flow-plus { color: var(--text-tertiary); }
.flow-arrow { display: grid; color: var(--icon-info); }
/* Phones: the calendar drops to its own line, still after the arrow. */
@media (max-width: 480px) { .flow { column-gap: var(--space-100); } }
@media (max-width: 640px) {
  .hero { padding-top: var(--space-500); }
  .hero-title { font-size: 38px; line-height: 42px; }
}

/* The hero picture: one week of Google Calendar sitting in a soft blue and orange glow, with a reminder floating over
   the edge. The glow is a layer behind it, as wide as the content and spilling below; it never widens the page. */
.showcase { position: relative; isolation: isolate; margin-top: var(--space-600); padding: var(--space-600); }
/* The centres sit where the calendar card ends, so the light shows around it rather than hiding behind it. Each glow
   fades out fully inside the layer, so there are no hard edges, and the layer stops before the next section's heading. */
.showcase::before { content: ''; position: absolute; inset: 6% 0 -6%; z-index: -1; pointer-events: none;
  background:
    radial-gradient(15% 44% at 86% 55%, color-mix(in srgb, var(--surface-glow-accent) 85%, transparent), transparent),
    radial-gradient(15% 46% at 14% 52%, color-mix(in srgb, var(--surface-glow-brand) 95%, transparent), transparent),
    radial-gradient(34% 12% at 36% 88%, color-mix(in srgb, var(--surface-glow-brand) 60%, transparent), transparent),
    radial-gradient(22% 11% at 70% 89%, color-mix(in srgb, var(--surface-glow-accent) 55%, transparent), transparent); }
/* With a mouse, the hero follows the pointer a little (script below): the glow drifts after it, the calendar tilts a
   few degrees toward it with a faint spotlight, and the reminder floats a bit more than the calendar, for depth.
   --gx and --gy run from -1 to 1; they stay 0 on touch screens and with reduced motion, so nothing moves there. */
.showcase { --gx: 0; --gy: 0; --spot: 0; --sx: 50%; --sy: 50%; }
.showcase::before { translate: calc(var(--gx) * 32px) calc(var(--gy) * 20px); }
.cal { position: relative; transform: perspective(1600px) rotateX(calc(var(--gy) * -3deg)) rotateY(calc(var(--gx) * 4deg)); }
.cal::after { content: ''; position: absolute; inset: 0; z-index: 1; pointer-events: none; border-radius: inherit; opacity: var(--spot);
  background: radial-gradient(360px circle at var(--sx) var(--sy), color-mix(in srgb, var(--surface-glow-brand) 14%, transparent), transparent 70%);
  transition: opacity 500ms var(--ease); }
.toast { translate: calc(var(--gx) * 16px) calc(var(--gy) * 12px); }
.cal { max-width: 880px; margin: 0 auto; border-radius: var(--radius-16); background: var(--surface-primary-subtle);
  border: 1px solid var(--border-primary); overflow: hidden; text-align: left; box-shadow: 0 24px 48px var(--overlay-md); }
.cal-head { display: flex; justify-content: space-between; align-items: center; gap: var(--space-200); padding: var(--space-100) var(--space-200); }
.cal-legend { display: flex; flex-wrap: wrap; gap: var(--space-50); }
/* Grid lines are the 1px gaps showing the border colour behind the cells, so no cell has a one sided border. */
.cal-grid { display: grid; grid-template-columns: 56px repeat(5, minmax(0, 1fr)); grid-template-rows: auto auto repeat(9, 40px);
  gap: 1px; background: var(--border-primary); }
.cal-grid > .cell, .cal-grid > .cal-day, .cal-grid > .cal-time { background: var(--surface-primary-subtle); }
.cal-day { display: flex; flex-direction: column; align-items: center; gap: var(--space-25); padding: var(--space-75) var(--space-50); color: var(--text-secondary); }
.cal-date { width: 32px; height: 32px; border-radius: var(--radius-full); display: grid; place-items: center; color: var(--text-primary); }
.cal-date.today { background: var(--surface-accent); color: var(--text-on-accent); }
.cal-time { padding: var(--space-25) var(--space-75) 0 0; text-align: right; color: var(--text-secondary); }
.ev { margin: var(--space-25); border-radius: var(--radius-6); padding: var(--space-25) var(--space-75); overflow: hidden; min-width: 0;
  display: flex; flex-direction: column; }
.ev span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.c1 { grid-column: 2; } .c2 { grid-column: 3; } .c3 { grid-column: 4; } .c4 { grid-column: 5; } .c5 { grid-column: 6; }
.toast { position: absolute; right: var(--space-400); bottom: calc(-1 * var(--space-400)); width: 320px; display: flex; gap: var(--space-100);
  align-items: center; padding: var(--space-100) var(--space-200); border-radius: var(--radius-16); text-align: left;
  background: var(--surface-primary-subtle); border: 1px solid var(--border-primary); box-shadow: 0 16px 32px var(--overlay-md); }
.toast-icon { flex: none; width: 40px; height: 40px; border-radius: var(--radius-full); display: grid; place-items: center;
  background: var(--surface-accent-subtle); color: var(--text-accent); }
.toast .caption-5 { color: var(--text-secondary); }
/* On load the week fills itself in: each event drops into place in order, then the reminder arrives. It plays once. */
@keyframes drop-in { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
.showcase .ev, .showcase .toast { animation: drop-in 500ms var(--ease) both; animation-delay: calc(300ms + var(--i, 0) * 140ms); }
@media (prefers-reduced-motion: reduce) { .showcase .ev, .showcase .toast { animation: none; } }
/* The demo. The script steps data-scene through paste, fill, remind and reset; until it does, nothing here changes. */
.demo-paste { display: none; }
/* Flex, not grid, centres the card: a grid track would stretch to fit the pasted link and push the card off to the side. */
.showcase[data-scene] .demo-paste { display: flex; align-items: center; justify-content: center; position: absolute; inset: 0; z-index: 2; border-radius: inherit;
  background: color-mix(in srgb, var(--surface-primary) 55%, transparent); opacity: 0; transition: opacity 300ms var(--ease); }
.showcase[data-scene="paste"] .demo-paste { opacity: 1; }
.demo-card { width: min(360px, calc(100% - 32px)); min-width: 0; display: flex; flex-direction: column; gap: var(--space-100); padding: var(--space-300);
  border-radius: var(--radius-16); border: 1px solid var(--border-primary); background: var(--surface-primary-subtle);
  box-shadow: 0 16px 32px var(--overlay-md); transform: translateY(12px) scale(0.97); transition: transform 400ms var(--ease); }
.showcase[data-scene="paste"] .demo-card { transform: none; }
.demo-field { display: flex; flex-direction: column; gap: var(--space-50); min-width: 0; }
.demo-input { display: flex; align-items: center; gap: var(--space-75); min-height: 40px; padding: 0 var(--space-100); border-radius: var(--radius-8);
  border: 1px solid var(--border-action-secondary); background: var(--surface-primary-subtle); transition: border-color 200ms, box-shadow 200ms; }
.demo-field.focus .demo-input { border-color: var(--border-action-primary); box-shadow: 0 0 0 1px var(--border-action-primary); }
.demo-text { flex: 1; min-width: 0; overflow: hidden; white-space: nowrap; border-radius: var(--radius-4); }
.demo-field.done .demo-text { animation: paste-flash 800ms var(--ease); }
@keyframes paste-flash { from { background: var(--surface-info-subtle); } }
.demo-input svg { flex: none; color: var(--icon-success); opacity: 0; transform: scale(0.4); transition: opacity 200ms, transform 300ms var(--ease); }
.demo-field.done .demo-input svg { opacity: 1; transform: none; }
.demo-btn { align-self: flex-start; display: inline-flex; align-items: center; gap: var(--space-50); min-height: 40px; margin-top: var(--space-50);
  padding: 0 var(--space-200); border-radius: var(--radius-full); background: var(--action-primary); color: var(--text-inverted);
  transition: transform 150ms var(--ease), background 150ms; }
.demo-btn.pressed { transform: scale(0.93); background: var(--action-primary-click); }
.showcase[data-scene] .ev, .showcase[data-scene] .toast { animation: none; opacity: 0; transform: translateY(12px);
  transition: opacity 400ms var(--ease), transform 400ms var(--ease); }
.showcase[data-scene="fill"] .ev, .showcase[data-scene="remind"] .ev { opacity: 1; transform: none; transition-delay: calc(var(--i, 0) * 110ms); }
.showcase[data-scene="remind"] .toast { opacity: 1; transform: none; }
@media (max-width: 480px) { .demo-card { padding: var(--space-200); } }
@media (max-width: 768px) {
  .showcase { padding: var(--space-200); }
  .cal { border-radius: var(--radius-8); } /* nested: 24 - 16 = 8 */
  .cal-grid { grid-template-columns: 44px repeat(3, minmax(0, 1fr)); grid-template-rows: auto auto repeat(9, 36px); }
  .c1, .c2 { display: none; }
  .c3 { grid-column: 2; } .c4 { grid-column: 3; } .c5 { grid-column: 4; }
  .cal-head { flex-direction: column; align-items: flex-start; }
  /* Narrow columns: let titles wrap onto two lines and drop the start time, which the time column already shows. */
  .ev span { white-space: normal; overflow-wrap: anywhere; }
  .ev .mono { display: none; }
  .toast { position: static; width: auto; margin-top: var(--space-200); }
}

/* Event chips, in the hero picture and on your Semsync page: classes blue, deadlines tinted orange, exams solid orange. */
.chip { border-radius: var(--radius-6); padding: var(--space-50) var(--space-75); overflow-wrap: anywhere; }
.chip .mono { display: block; }
.chip-class { background: var(--surface-info-subtle); color: var(--text-info); }
.chip-deadline { background: var(--surface-accent-subtle); color: var(--text-accent); }
.chip-exam { background: var(--surface-accent); color: var(--text-on-accent); }

section { padding: var(--space-700) 0; }
header.hero + section { padding-top: var(--space-900); } /* room for the reminder hanging off the hero picture */
.section-head { max-width: 680px; }
.section-head .body-7 { margin-top: var(--space-200); color: var(--text-secondary); }
@media (max-width: 640px) {
  section { padding: var(--space-600) 0; }
  header.hero + section { padding-top: var(--space-700); }
  .section-title { font-size: 30px; line-height: 36px; } /* heading-4 on phones */
}

/* What you get: four equal cards in a 2 x 2 grid. Each has the same shape: a picture area of fixed height on top
   (so every example sits at the same level), then a title and a line or two. Nested radius: 24 outside, 12 padding,
   so the picture area is 12. */
.features { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-200); margin-top: var(--space-600); }
.feature { display: flex; flex-direction: column; padding: var(--space-100); border-radius: var(--radius-24);
  background: var(--surface-primary-subtle); border: 1px solid var(--border-primary); }
.feature h3 { margin: var(--space-300) var(--space-200) 0; }
.feature > p { margin: var(--space-75) var(--space-200) var(--space-200); color: var(--text-secondary); }
.feature-stage { height: 220px; display: grid; place-items: center; padding: var(--space-300); overflow: hidden; border-radius: var(--radius-12);
  background: var(--surface-secondary); }
.stage-stack { display: flex; flex-direction: column; align-items: center; gap: var(--space-100); text-align: center; max-width: 100%; }
.stage-row { display: flex; flex-wrap: wrap; justify-content: center; gap: var(--space-100); }
.stage-arrow { display: grid; place-items: center; color: var(--icon-secondary); transform: rotate(90deg); }
.feature-stage .chip { display: inline-flex; flex-direction: column; align-items: flex-start; gap: var(--space-25); text-align: left;
  padding: var(--space-75) var(--space-100); box-shadow: 0 8px 20px var(--overlay-xs); }
.was { color: var(--text-secondary); text-decoration: line-through; }
.stage-weeks { display: grid; grid-template-columns: auto auto; align-items: center; gap: var(--space-75) var(--space-200); }
.stage-weeks .chip { padding: var(--space-50) var(--space-100); box-shadow: none; }
.stage-weeks .skipped { color: var(--text-secondary); }
.stage-weeks .skipped-chip { background: var(--surface-primary-subtle); color: var(--text-secondary); text-decoration: line-through; }
.stage-notes { display: flex; flex-direction: column; gap: var(--space-100); width: min(100%, 320px); }
.note { display: flex; align-items: center; gap: var(--space-100); padding: var(--space-100) var(--space-200); border-radius: var(--radius-12);
  background: var(--surface-primary-subtle); border: 1px solid var(--border-primary); box-shadow: 0 8px 20px var(--overlay-xs); }
.note:first-child { transform: scale(0.94); opacity: 0.7; }
.note .caption-5 { color: var(--text-secondary); }
.note .toast-icon { width: 32px; height: 32px; }
.pill { display: inline-flex; align-items: center; gap: var(--space-50); padding: var(--space-50) var(--space-100); border-radius: var(--radius-full);
  background: var(--surface-primary-subtle); color: var(--text-primary); }
@media (max-width: 768px) {
  .features { grid-template-columns: minmax(0, 1fr); }
  .feature-stage { height: 200px; padding: var(--space-200); }
}

/* How it works: steps on one side, the setup page they lead to on the other. */
.zig { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: var(--space-700); align-items: center; }
.steps { list-style: none; margin: var(--space-400) 0 0; padding: 0; display: flex; flex-direction: column; gap: var(--space-300); }
.step { display: flex; gap: var(--space-200); align-items: flex-start; }
.step-no { flex: none; width: 40px; height: 40px; border-radius: var(--radius-full); display: grid; place-items: center;
  background: var(--surface-info-subtle); color: var(--text-info); }
.mock { padding: var(--space-300); border-radius: var(--radius-24); background: var(--surface-info-subtle); }
/* Inside the 24px panel with 24px padding the formula gives 24 - 24 = 0, and below 2 the skill leaves the inner shape unchanged, so the card keeps 16. */
.mock-card { padding: var(--space-300); border-radius: var(--radius-16); background: var(--surface-primary-subtle); border: 1px solid var(--border-primary);
  box-shadow: 0 16px 32px var(--overlay-xs); }
.mock-field { margin-top: var(--space-200); }
.mock-input { display: flex; align-items: center; justify-content: space-between; gap: var(--space-75); margin-top: var(--space-75);
  min-height: 44px; padding: var(--space-75) var(--space-100); border-radius: var(--radius-8); border: 1px solid var(--border-action-secondary);
  background: var(--surface-primary-subtle); }
.mock-input span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mock-input svg { flex: none; color: var(--icon-success); }
.mock-btn { display: inline-flex; margin-top: var(--space-300); min-height: 44px; align-items: center; padding: var(--space-75) var(--space-100);
  border-radius: var(--radius-8); background: var(--action-primary); color: var(--text-inverted); }
@media (max-width: 768px) { .zig { grid-template-columns: minmax(0, 1fr); gap: var(--space-500); } }

/* Where to find your links: Canvas and NUSMods as tabs (both panels show without JavaScript). */
.guides { margin-top: var(--space-500); }
.tabs { display: none; gap: var(--space-50); padding: var(--space-50); border-radius: var(--radius-full); width: fit-content; max-width: 100%;
  background: var(--surface-secondary); }
.js .tabs { display: flex; }
.tab { display: inline-flex; align-items: center; gap: var(--space-75); min-height: 44px; padding: 0 var(--space-200); border: 0;
  border-radius: var(--radius-full); background: transparent; color: var(--text-secondary); font-family: inherit; cursor: pointer;
  transition: background-color 300ms var(--ease), color 300ms var(--ease); }
.tab:hover { color: var(--text-primary); }
.tab[aria-selected="true"] { background: var(--surface-primary-subtle); color: var(--text-primary); box-shadow: 0 2px 8px var(--overlay-xs); }
.tab svg { color: var(--icon-info); }
.tab-panel + .tab-panel { margin-top: var(--space-500); }
.js .tab-panel + .tab-panel { margin-top: 0; }
.tab-panel { margin-top: var(--space-300); }
.tab-panel[hidden] { display: none; }

/* One walkthrough: the steps on one side, a little screen acting each one out on the other. The steps are buttons that
   jump to that step; while it plays by itself, a bar under the current step fills up until the next one. */
.guide { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 3fr); gap: var(--space-500); align-items: center; }
.guide.compact { grid-template-columns: minmax(0, 1fr); gap: var(--space-200); margin-top: var(--space-75); }
.compact .guide-step { padding: var(--space-75) var(--space-100); gap: var(--space-100); }
.compact .guide-open { margin-left: var(--space-100); }
/* Stacked, the screen goes first, so the step it's acting out is highlighted just below it. */
@media (max-width: 768px) { .guide { grid-template-columns: minmax(0, 1fr); gap: var(--space-300); } .guide .guide-screen { order: -1; } }
.compact .guide-screen { order: -1; }
.guide-steps { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--space-50); }
.guide-step { position: relative; overflow: hidden; display: flex; gap: var(--space-200); align-items: flex-start; width: 100%; text-align: left;
  padding: var(--space-100) var(--space-200); border: 1px solid transparent; border-radius: var(--radius-12); background: transparent;
  color: var(--text-primary); font-family: inherit; cursor: pointer; transition: background-color 300ms var(--ease), border-color 300ms var(--ease); }
.guide-step:hover { background: var(--surface-primary-hover); }
.guide-step[aria-current="step"] { background: var(--surface-primary-subtle); border-color: var(--border-primary); }
.guide-step .step-no { width: 32px; height: 32px; transition: background-color 300ms var(--ease), color 300ms var(--ease); }
.guide-step[aria-current="step"] .step-no { background: var(--surface-brand); color: var(--text-on-brand); }
.guide-title, .guide-detail { display: block; }
.guide-detail { margin-top: var(--space-25); }
.guide-progress { position: absolute; left: 0; right: 0; bottom: 0; height: 2px; background: var(--surface-brand); transform: scaleX(0); transform-origin: left; }
.guide.playing .guide-step[aria-current="step"] .guide-progress { animation: guide-fill 3200ms linear forwards; }
@keyframes guide-fill { to { transform: scaleX(1); } }
.guide-open { display: inline-flex; align-items: center; gap: var(--space-50); min-height: 44px; margin: var(--space-100) 0 0 var(--space-200);
  color: var(--text-info); text-decoration: none; }
.guide-open svg { transition: transform 500ms var(--ease); }
.guide-open:hover svg { transform: translateX(var(--space-50)); }

/* The little screen. Everything inside is drawn with tokens, so it follows light and dark mode. */
.guide-screen { position: relative; aspect-ratio: 16 / 10; border-radius: var(--radius-16); overflow: hidden; background: var(--surface-primary-subtle);
  border: 1px solid var(--border-primary); box-shadow: 0 24px 48px var(--overlay-md); display: flex; flex-direction: column; }
.compact .guide-screen { border-radius: var(--radius-12); box-shadow: 0 12px 24px var(--overlay-xs); }
.gs-bar { flex: none; display: flex; align-items: center; gap: var(--space-100); padding: var(--space-75) var(--space-100); background: var(--surface-secondary); }
.gs-dots { display: flex; gap: var(--space-50); }
.gs-dots i { width: 8px; height: 8px; border-radius: var(--radius-full); background: var(--border-primary-light); }
.gs-url { flex: 1; min-width: 0; padding: var(--space-25) var(--space-100); border-radius: var(--radius-full); background: var(--surface-primary-subtle);
  color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gs-body { flex: 1; min-height: 0; }
/* Coloured blocks for events and classes: the solid colours, softened, so they read in both modes. */
.gs-mark-a { background: color-mix(in srgb, var(--surface-accent) 55%, transparent); }
.gs-mark-b { background: color-mix(in srgb, var(--surface-brand) 55%, transparent); }
.gs-mark-c { background: color-mix(in srgb, var(--surface-success) 50%, transparent); }
/* The thing to click glows while the pointer is on it. */
.is-target { transition: box-shadow 300ms var(--ease), background-color 300ms var(--ease); }
.guide[data-at="0"] [data-target="0"], .guide[data-at="1"] [data-target="1"], .guide[data-at="2"] [data-target="2"] {
  box-shadow: 0 0 0 2px var(--border-action-primary), 0 0 16px color-mix(in srgb, var(--surface-glow-brand) 60%, transparent); }

.gs-canvas { display: grid; grid-template-columns: 12% minmax(0, 1fr) 32%; }
.gs-rail { display: flex; flex-direction: column; align-items: center; gap: var(--space-100); padding: var(--space-100) 0; background: var(--surface-secondary); }
.gs-rail-item { width: 28px; height: 28px; border-radius: var(--radius-8); display: grid; place-items: center; color: var(--icon-secondary); }
.gs-rail-item i { width: 14px; height: 14px; border-radius: var(--radius-4); background: var(--border-primary-light); }
.gs-rail-item[data-target] { color: var(--icon-info); }
.gs-main { padding: var(--space-100); min-width: 0; display: flex; flex-direction: column; gap: var(--space-75); }
.gs-month { flex: 1; display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); grid-auto-rows: 1fr; gap: 1px; background: var(--border-primary);
  border: 1px solid var(--border-primary); border-radius: var(--radius-6); overflow: hidden; }
.gs-cell { background: var(--surface-primary-subtle); padding: var(--space-25); }
.gs-cell i { display: block; height: 4px; border-radius: var(--radius-2); }
.gs-side { padding: var(--space-100); display: flex; flex-direction: column; gap: var(--space-75); min-width: 0; }
.gs-mini { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: var(--space-25); }
.gs-mini i { aspect-ratio: 1; border-radius: var(--radius-full); background: var(--surface-secondary); }
.gs-line { display: flex; align-items: center; gap: var(--space-50); height: 8px; }
.gs-line i { width: 8px; height: 8px; border-radius: var(--radius-2); }
.gs-line::after { content: ''; flex: 1; height: 4px; border-radius: var(--radius-2); background: var(--surface-secondary); }
.gs-link { margin-top: auto; align-self: flex-start; padding: var(--space-25) var(--space-50); border-radius: var(--radius-4); color: var(--text-info);
  white-space: nowrap; }

.gs-nusmods { display: flex; flex-direction: column; gap: var(--space-75); padding: var(--space-100); }
.gs-tabs { display: flex; gap: var(--space-50); }
.gs-tabs span { padding: var(--space-25) var(--space-75); border-radius: var(--radius-full); }
.gs-tab-on { background: var(--surface-info-subtle); color: var(--text-info); }
.gs-tools { display: flex; justify-content: flex-end; gap: var(--space-50); }
.gs-tool { padding: var(--space-25) var(--space-75); border-radius: var(--radius-6); border: 1px solid var(--border-action-secondary); white-space: nowrap; }
.gs-week { flex: 1; display: flex; flex-direction: column; gap: var(--space-25); min-height: 0; }
.gs-day { flex: 1; display: grid; grid-template-columns: 32px minmax(0, 1fr); align-items: center; gap: var(--space-75); min-height: 0; }
.gs-slots { height: 100%; display: grid; grid-template-columns: repeat(8, minmax(0, 1fr)); gap: var(--space-25); padding: var(--space-25) 0;
  border-radius: var(--radius-4); background: var(--surface-primary-hover); }
.gs-slots i { border-radius: var(--radius-4); }

/* The dialog that the second click opens, with the link in it. */
/* Centred with auto margins rather than a transform, so the pointer can find the link inside it by offsets. */
.gs-dialog { position: absolute; inset: 0 10%; height: fit-content; margin: auto 0; padding: var(--space-200); border-radius: var(--radius-12);
  background: var(--surface-primary-subtle); border: 1px solid var(--border-primary); box-shadow: 0 16px 40px var(--overlay-lg);
  display: flex; flex-direction: column; gap: var(--space-75); opacity: 0; transform: translateY(var(--space-200)) scale(0.96); pointer-events: none;
  transition: opacity 400ms var(--ease), transform 500ms var(--ease); }
.guide[data-at="2"] .gs-dialog { opacity: 1; transform: none; }
.guide[data-at="2"] .gs-body { opacity: 0.5; transition: opacity 400ms var(--ease); }
.gs-field { min-width: 0; padding: var(--space-50) var(--space-75); border-radius: var(--radius-6); border: 1px solid var(--border-action-secondary);
  background: var(--surface-primary); }
.gs-field span { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gs-share { display: flex; gap: var(--space-50); align-items: stretch; }
.gs-share .gs-field { flex: 1; }
.gs-copy { flex: none; display: inline-flex; align-items: center; gap: var(--space-25); padding: 0 var(--space-75); border-radius: var(--radius-6);
  background: var(--action-primary); color: var(--text-inverted); }
.gs-copied { align-self: flex-start; display: inline-flex; align-items: center; gap: var(--space-25); padding: var(--space-25) var(--space-75);
  border-radius: var(--radius-full); background: var(--surface-success-subtle); color: var(--text-primary); opacity: 0; transform: translateY(4px);
  transition: opacity 300ms var(--ease), transform 300ms var(--ease); }
.gs-copied svg { color: var(--icon-success); }
.guide.copied .gs-copied { opacity: 1; transform: none; }
.guide.copied .gs-dialog .gs-field span { background: color-mix(in srgb, var(--surface-glow-brand) 30%, transparent); }

/* The pointer moves to each thing in turn and taps it. It needs JavaScript to know where things are. */
.gs-cursor { display: none; position: absolute; left: 0; top: 0; z-index: 2; pointer-events: none; color: var(--text-primary);
  filter: drop-shadow(0 2px 4px var(--overlay-md)); transition: transform 800ms var(--ease); }
.js .gs-cursor { display: block; }
.gs-cursor svg { display: block; fill: currentColor; stroke: var(--surface-primary-subtle); stroke-width: 1.5px; stroke-linejoin: round; }
.gs-cursor::after { content: ''; position: absolute; left: -10px; top: -10px; width: 24px; height: 24px; border-radius: var(--radius-full);
  border: 2px solid var(--border-action-primary); opacity: 0; transform: scale(0.4); }
.gs-cursor.tap::after { animation: tap 500ms var(--ease); }
@keyframes tap { 0% { opacity: 1; transform: scale(0.4); } 100% { opacity: 0; transform: scale(1.4); } }
@media (max-width: 480px) { .gs-copy { padding: 0 var(--space-50); } .gs-dialog { inset: 0 6%; padding: var(--space-100); } }
@media (prefers-reduced-motion: reduce) {
  .gs-cursor, .gs-dialog, .gs-copied, .is-target, .guide-step, .guide-step .step-no { transition: none; }
  .gs-cursor.tap::after { animation: none; }
}

/* Setup page: who you're signed in as, with a way out. */
.signed-in { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-50) var(--space-100); margin-top: var(--space-500);
  color: var(--text-secondary); }

/* Tagline reveal: its own large type moment on the electric blue, shaded deep blue in one corner and faintly lit in the
   opposite one, both clear of the text. */
.band { border-radius: var(--radius-24); color: var(--text-on-brand); padding: var(--space-900) var(--space-600); text-align: center;
  background: radial-gradient(60% 100% at 100% 100%, color-mix(in srgb, var(--surface-glow-deep) 80%, transparent), transparent),
    radial-gradient(40% 70% at 0% 0%, color-mix(in srgb, var(--surface-white) 14%, transparent), transparent),
    var(--surface-brand); }
.tagline { max-width: 680px; margin: 0 auto; text-wrap: balance; }
.tagline .w { opacity: 0.3; transition: opacity 600ms var(--ease); }
.tagline .w.lit { opacity: 1; }
@media (max-width: 640px) {
  .band { padding: var(--space-700) var(--space-300); }
  .tagline { font-size: 30px; line-height: 36px; } /* heading-4 on phones */
}

/* The closing card: the pitch on the left, the button on the right, both on one left edge when stacked. */
.final { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: var(--space-600);
  border-radius: var(--radius-24); padding: var(--space-700) var(--space-600); border: 1px solid var(--border-primary);
  background: radial-gradient(45% 55% at 32% 125%, color-mix(in srgb, var(--surface-glow-brand) 80%, transparent), transparent),
    radial-gradient(32% 45% at 72% 125%, color-mix(in srgb, var(--surface-glow-accent) 65%, transparent), transparent),
    var(--surface-primary-subtle); }
.final .section-title { max-width: 560px; }
.final .cta { margin-top: 0; }
@media (max-width: 768px) { .final { grid-template-columns: minmax(0, 1fr); gap: var(--space-300); padding: var(--space-500) var(--space-300); } }

.reveal { opacity: 0; transform: translateY(32px); transition: opacity 700ms var(--ease), transform 700ms var(--ease); }
.reveal.in { opacity: 1; transform: none; }
@media (prefers-reduced-motion: reduce) {
  .tagline .w { opacity: 1; transition: none; }
  .reveal { opacity: 1; transform: none; transition: none; }
  .btn { transition: none; }
}

/* FAQ: heading on the left, questions on the right, divided by 1px rules. The plus turns into a cross when open. */
.faq-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 2fr); gap: var(--space-700); align-items: start; }
details.faq summary { list-style: none; display: flex; justify-content: space-between; align-items: center; gap: var(--space-200);
  min-height: 44px; padding: var(--space-200) 0; cursor: pointer; text-wrap: balance; }
details.faq summary::-webkit-details-marker { display: none; }
.faq-icon { flex: none; width: 32px; height: 32px; border-radius: var(--radius-full); display: grid; place-items: center;
  background: var(--surface-info-subtle); color: var(--icon-info); transition: transform 500ms var(--ease); }
details.faq[open] .faq-icon { transform: rotate(45deg); }
details.faq p { color: var(--text-secondary); padding: 0 var(--space-600) var(--space-200) 0; }
@media (max-width: 768px) { .faq-grid { grid-template-columns: minmax(0, 1fr); gap: var(--space-300); } details.faq p { padding-right: 0; } }
@media (prefers-reduced-motion: reduce) { .faq-icon { transition: none; } }

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
.dot { width: 8px; height: 8px; border-radius: var(--radius-full); background: var(--icon-success); }
.dot.bad { background: var(--icon-error); }
.list { margin-top: var(--space-100); border: 1px solid var(--border-primary); border-radius: var(--radius-12); background: var(--surface-primary-subtle); }
.list > .divider { margin: 0 var(--space-200); }
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
/* Your Semsync page: the week up top, an agenda of what's due on the left, and everything about your calendar on the
   right. On phones it stacks with the calendar card first, since adding it is the first thing to do. */
.dash-wrap { max-width: 1120px; }
.dash-head { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-end; gap: var(--space-200); }
.dash-title { margin-top: var(--space-50); }
.sync-pill { display: flex; align-items: center; gap: var(--space-100); margin: 0; padding: var(--space-50) var(--space-50) var(--space-50) var(--space-200);
  border-radius: var(--radius-full); border: 1px solid var(--border-primary); background: var(--surface-primary-subtle); color: var(--text-secondary); }
.sync-pill .btn { border-color: transparent; background: var(--action-secondary); }
.sync-pill .btn:hover { background: var(--action-secondary-hover); }
/* Both columns end on the same line: the agenda stretches to the side column's height, and the last side card stretches
   to the agenda's, with its button pinned to the bottom. */
.dash { display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr); gap: var(--space-200); margin-top: var(--space-400); align-items: stretch; }
.dash-side { display: flex; flex-direction: column; gap: var(--space-200); min-width: 0; }
.dash-sources, .dash-courses { display: flex; flex-direction: column; }
/* On your page the calendar card takes any extra height, with its button at the bottom, so the columns end level
   without an empty gap in a plain card. */
.dash-dest { flex: 1; display: flex; }
.dash-dest .dest { flex: 1; display: flex; flex-direction: column; }
.dash-dest .dest-actions { margin-top: auto; padding-top: var(--space-300); }
.sources-actions { margin-top: auto; padding-top: var(--space-200); display: flex; flex-wrap: wrap; gap: var(--space-75); }
.sources-actions form { display: flex; margin: 0; }
@media (max-width: 880px) {
  .dash { grid-template-columns: minmax(0, 1fr); }
  .dash-side { display: contents; }
  .dash-dest { order: -1; }
}
.panel { min-width: 0; padding: var(--space-300); border-radius: var(--radius-16); border: 1px solid var(--border-primary); background: var(--surface-primary-subtle); }
.panel-head { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: baseline; gap: var(--space-100); }
@media (max-width: 480px) { .panel { padding: var(--space-200); } }
/* The calendar card gets the same soft blue light as the landing page, so the main action stands out. */
.panel-glow { background: radial-gradient(80% 90% at 100% 0%, color-mix(in srgb, var(--surface-glow-brand) 30%, transparent), transparent),
  var(--surface-primary-subtle); }
.dest-icon { width: 40px; height: 40px; border-radius: var(--radius-12); display: grid; place-items: center; margin-bottom: var(--space-200);
  background: var(--surface-brand); color: var(--text-on-brand); }
.dest-icon.warn { background: var(--surface-warning-subtle); color: var(--icon-warning); }
.dest p { margin-top: var(--space-75); overflow-wrap: anywhere; } /* long email addresses wrap instead of widening the page */
.dest-actions { display: flex; flex-wrap: wrap; gap: var(--space-75); margin-top: var(--space-300); }
/* "My calendars" as Google shows it, with Semsync's row lit up. Only beside the agenda, where there's room for it. */
.mini-cals { margin-top: var(--space-300); padding: var(--space-200); border-radius: var(--radius-12); border: 1px solid var(--border-primary);
  background: var(--surface-primary); display: flex; flex-direction: column; gap: var(--space-50); }
.mini-cals > p { margin: 0 0 var(--space-25); }
.mini-cal { display: flex; align-items: center; gap: var(--space-100); padding: var(--space-50) var(--space-75); margin: 0 calc(-1 * var(--space-75));
  border-radius: var(--radius-8); min-width: 0; }
.mini-on { background: var(--surface-info-subtle); font-weight: 600; }
.mini-on .badge { margin-left: auto; }
.mini-box { flex: none; width: 16px; height: 16px; border-radius: var(--radius-4); display: grid; place-items: center; color: #fff; }
@media (max-width: 880px) { .mini-cals { display: none; } }

/* Agenda: a date block per day (today circled in orange, as in the hero), events as the same chips as the calendar. */
.agenda { margin-top: var(--space-100); }
.agenda-day { display: grid; grid-template-columns: 48px minmax(0, 1fr); gap: var(--space-200); padding: var(--space-200) 0; }
.agenda-date { display: flex; flex-direction: column; align-items: center; gap: var(--space-25); color: var(--text-secondary); }
.agenda-num { width: 40px; height: 40px; border-radius: var(--radius-full); display: grid; place-items: center; color: var(--text-primary); }
.agenda-date.today .agenda-num { background: var(--surface-accent); color: var(--text-on-accent); }
.agenda-events { display: flex; flex-direction: column; gap: var(--space-75); min-width: 0; }
.agenda-ev { display: flex; flex-direction: column; gap: var(--space-25); padding: var(--space-75) var(--space-100); border-radius: var(--radius-8);
  overflow-wrap: anywhere; }
.panel .empty { padding: var(--space-500) var(--space-200); }

.tiles { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--space-75); margin-top: var(--space-200); }
.tile { display: flex; flex-direction: column; gap: var(--space-25); min-width: 0; padding: var(--space-100); border-radius: var(--radius-12);
  background: var(--surface-secondary); }
.tile-key { width: 12px; height: 12px; border-radius: var(--radius-4); margin-bottom: var(--space-50); }
.key-class { background: var(--text-info); }
.key-deadline { background: var(--text-accent); }
.key-exam { background: var(--surface-accent); }

.sources { display: flex; flex-direction: column; gap: var(--space-200); margin: var(--space-200) 0 var(--space-300); }
.source { display: flex; gap: var(--space-100); align-items: flex-start; }
.source > div { flex: 1; min-width: 0; }
.source-icon { flex: none; width: 36px; height: 36px; border-radius: var(--radius-8); display: grid; place-items: center;
  background: var(--surface-info-subtle); color: var(--icon-info); }
.source .ok { flex: none; margin-top: var(--space-75); color: var(--icon-success); }
.mods { display: flex; flex-wrap: wrap; gap: var(--space-50); margin-top: var(--space-50); }
.mod { padding: var(--space-25) var(--space-75); border-radius: var(--radius-full); background: var(--surface-secondary); color: var(--text-primary); }
.danger-link { color: var(--text-error); }
@media (max-width: 640px) {
  .dest-actions .btn, .sources-actions .btn, .courses-actions .btn, .setup-actions .btn, .confirm-actions .btn, .feed-actions .btn { width: 100%; }
  .sync-pill { width: 100%; }
  .sync-pill .btn { margin-left: auto; }
}

/* Setup: three numbered steps, each its own card, then one clear button. */
.setup-form { display: flex; flex-direction: column; gap: var(--space-200); margin-top: var(--space-400); }
.setup-step .input { margin-top: var(--space-200); }
.step-head { display: flex; gap: var(--space-200); align-items: flex-start; }
.step-head .step-no { flex: none; width: 32px; height: 32px; }
.step-head .hint { margin-top: var(--space-25); overflow-wrap: anywhere; } /* the long example link wraps instead of poking out */
legend.step-head { align-items: center; padding: 0; margin-bottom: var(--space-200); }
.setup-step .choices { margin: 0; }
.badge { display: inline-flex; align-items: center; margin-left: var(--space-75); padding: var(--space-25) var(--space-75); border-radius: var(--radius-full);
  background: var(--surface-secondary); color: var(--text-secondary); vertical-align: middle; }
.badge-brand { background: var(--surface-info-subtle); color: var(--text-info); }
.help-toggle { list-style: none; gap: var(--space-50); }
.help-toggle::-webkit-details-marker { display: none; }
.help-toggle svg { transition: transform 300ms var(--ease); }
.help[open] > .help-toggle svg { transform: rotate(180deg); }
/* What happens after Continue, so Google's screen isn't a surprise. */
.setup-next { display: flex; gap: var(--space-75); align-items: flex-start; margin: 0; }
.setup-next svg { flex: none; margin-top: 1px; }
/* The way to Outlook or Apple Calendar instead of Google, quietly under Continue. */
.setup-alt { margin: 0; }
/* The subscribe link: the address to copy, then Copy and Open side by side (stacked on phones). */
.feed-link { margin-top: var(--space-200); display: flex; flex-direction: column; gap: var(--space-100); }
.feed-link .input { width: 100%; min-width: 0; text-overflow: ellipsis; }
.feed-actions { display: flex; flex-wrap: wrap; gap: var(--space-75); }
.app-steps { margin-top: var(--space-200); }
.app-list { margin: var(--space-100) 0 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: var(--space-100); }
.app-list li { display: flex; flex-direction: column; gap: var(--space-25); color: var(--text-secondary); }
.app-list .title-4 { color: var(--text-primary); }
.dest-actions form { display: flex; margin: 0; }
.setup-actions { display: flex; flex-wrap: wrap; gap: var(--space-100); margin-top: var(--space-100); }
.link-button { min-height: 44px; padding: 0; border: 0; background: none; color: var(--text-info); font-family: inherit; text-decoration: underline;
  text-underline-offset: 3px; cursor: pointer; }
@media (prefers-reduced-motion: reduce) { .help-toggle svg { transition: none; } }

/* What goes in: a row per course, with a switch. The whole row is the tap target. */
.courses-form { display: flex; flex-direction: column; flex: 1; margin: var(--space-100) 0 0; }
.switch-row { display: flex; align-items: center; justify-content: space-between; gap: var(--space-200); min-height: 52px;
  padding: var(--space-75) 0; cursor: pointer; }
.switch-text { display: flex; flex-direction: column; min-width: 0; overflow-wrap: anywhere; }
.switch-text .title-4 { display: inline-flex; align-items: center; gap: var(--space-75); }
.course-dot { flex: none; width: 10px; height: 10px; border-radius: var(--radius-full); }
.switch { appearance: none; -webkit-appearance: none; flex: none; position: relative; width: 44px; height: 26px; margin: 0;
  border-radius: var(--radius-full); background: var(--border-action-secondary); cursor: pointer; transition: background-color 300ms var(--ease); }
.switch::before { content: ''; position: absolute; top: 3px; left: 3px; width: 20px; height: 20px; border-radius: var(--radius-full);
  background: var(--surface-white); box-shadow: 0 1px 3px var(--overlay-md); transition: transform 300ms var(--ease); }
.switch:checked { background: var(--surface-brand); }
.switch:checked::before { transform: translateX(18px); }
.switch:focus-visible { outline: 2px solid var(--border-action-primary); outline-offset: 2px; }
.courses-actions { margin-top: auto; padding-top: var(--space-200); }
/* Course chips: on is tinted blue with a tick, off is outlined and struck through. The checkbox stays in the page for
   keyboards and screen readers, just out of sight. */
.course-chips { display: flex; flex-wrap: wrap; gap: var(--space-75); margin-top: var(--space-100); }
.course-chip { position: relative; cursor: pointer; }
.course-chip input { position: absolute; inset: 0; margin: 0; opacity: 0; cursor: pointer; }
.course-chip > span { display: inline-flex; align-items: center; gap: var(--space-50); min-height: 44px; padding: 0 var(--space-100);
  border-radius: var(--radius-full); border: 1px solid var(--border-action-secondary); color: var(--text-secondary);
  transition: background-color 300ms var(--ease), border-color 300ms var(--ease), color 300ms var(--ease); }
.course-chip input:checked + span { background: var(--surface-info-subtle); border-color: transparent; color: var(--text-info); }
.course-chip input:not(:checked) + span { text-decoration: line-through; }
.course-chip .chip-on { display: none; }
.course-chip input:checked + span .chip-on { display: block; }
.course-chip input:focus-visible + span { outline: 2px solid var(--border-action-primary); outline-offset: 2px; }
.course-chip:hover > span { border-color: var(--border-action-primary); }
@media (prefers-reduced-motion: reduce) { .course-chip > span { transition: none; } }
@media (prefers-reduced-motion: reduce) { .switch, .switch::before { transition: none; } }

/* Account menu: your initial in the nav opens it. */
.avatar { display: grid; place-items: center; width: 44px; height: 44px; padding: 0; border: 0; border-radius: var(--radius-full);
  background: transparent; cursor: pointer; }
.avatar span { width: 32px; height: 32px; border-radius: var(--radius-full); display: grid; place-items: center;
  background: var(--surface-info-subtle); color: var(--text-info); transition: box-shadow 300ms var(--ease); }
.avatar:hover span, .avatar:focus-visible span { box-shadow: 0 0 0 3px color-mix(in srgb, var(--surface-glow-brand) 40%, transparent); }
.account-menu { position: fixed; inset: auto; top: 76px; right: var(--space-200); margin: 0; width: 260px; padding: var(--space-100);
  border-radius: var(--radius-16); border: 1px solid var(--border-primary); background: var(--surface-primary-subtle); color: var(--text-primary);
  box-shadow: 0 16px 40px var(--overlay-md); }
/* Shown only when open: as a popover, or with the .open class where popovers aren't supported. These stay separate
   rules, because a browser that doesn't know :popover-open drops the whole rule it appears in. */
.account-menu { display: none; }
.account-menu:popover-open { display: block; animation: confirm-in 200ms var(--ease); }
.account-menu.open { display: block; z-index: 20; }
.account-menu > p { padding: 0 var(--space-100); }
.account-menu > p:first-child { padding-top: var(--space-50); }
.account-email { overflow-wrap: anywhere; }
.menu-divider { margin: var(--space-100) 0 var(--space-50); }
.account-menu form { margin: 0; }
.menu-item { display: flex; align-items: center; gap: var(--space-100); width: 100%; min-height: 44px; padding: 0 var(--space-100); border: 0;
  border-radius: var(--radius-8); background: transparent; color: inherit; font-family: inherit; text-align: left; text-decoration: none; cursor: pointer;
  transition: background-color 300ms var(--ease); }
.menu-item:hover, .menu-item:focus-visible { background: var(--surface-primary-hover); }
.menu-item svg { color: var(--icon-secondary); }
.menu-item.danger-link { color: var(--text-error); }
.menu-item.danger-link svg { color: var(--icon-error); }
@media (prefers-reduced-motion: reduce) { .account-menu:popover-open { animation: none; } }
/* Tight phones: the current page's link goes, so the brand, toggle and account menu still fit. */
@media (max-width: 400px) { .nav-link[aria-current="page"] { display: none; } }
@media (max-width: 360px) { .nav-link { display: none; } } /* the brand already leads to your page */
.nav-link { white-space: nowrap; }

/* Delete confirmation: a modal dialog that fades up over a dimmed page, with its own page as the fallback. */
.confirm { width: min(460px, calc(100vw - 32px)); padding: var(--space-300); border-radius: var(--radius-16); border: 1px solid var(--border-primary);
  background: var(--surface-primary-subtle); color: var(--text-primary); box-shadow: 0 24px 64px var(--overlay-lg); }
.confirm::backdrop { background: var(--overlay-lg); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); }
.confirm[open] { animation: confirm-in 300ms var(--ease); }
@keyframes confirm-in { from { opacity: 0; transform: translateY(12px) scale(0.98); } }
@media (prefers-reduced-motion: reduce) { .confirm[open] { animation: none; } }
.confirm form, .confirm-page form { margin: 0; }
.confirm-icon { width: 48px; height: 48px; border-radius: var(--radius-full); display: grid; place-items: center;
  background: var(--surface-error-subtle); color: var(--icon-error); }
.confirm-list { margin: var(--space-200) 0 0; padding-left: var(--space-300); color: var(--text-secondary); display: flex; flex-direction: column; gap: var(--space-75); }
.confirm-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: var(--space-100); margin-top: var(--space-300); }
/* Narrow phones: full width buttons, stacked, with the action you came for on top. */
@media (max-width: 420px) { .confirm-actions { flex-direction: column-reverse; } .confirm-actions .btn { width: 100%; } }

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

const THEME_KEY = 'semsync-theme';

// Runs in <head> before the page draws: marks that JavaScript is on (so the toggle shows) and applies a saved light or
// dark choice, so there's no flash of the other mode.
export const THEME_INIT = `document.documentElement.classList.add('js');
try { var t = localStorage.getItem('${THEME_KEY}'); if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t; } catch (e) {}`;

// Reveal on scroll and the word by word tagline (IntersectionObserver, no scroll listeners),
// plus in-browser checks and a loading state for the setup form.
export const SCRIPT = `
(() => {
  const toggle = document.querySelector('[data-theme-toggle]');
  if (toggle) {
    const root = document.documentElement;
    const isDark = () => (root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches);
    const label = () => toggle.setAttribute('aria-label', isDark() ? 'Switch to light mode' : 'Switch to dark mode');
    label();
    toggle.addEventListener('click', () => {
      root.dataset.theme = isDark() ? 'light' : 'dark';
      try { localStorage.setItem('${THEME_KEY}', root.dataset.theme); } catch {}
      label();
    });
  }

  const io = 'IntersectionObserver' in window;
  document.querySelectorAll('.reveal').forEach((el) => {
    if (!io) return el.classList.add('in');
    const obs = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('in'); obs.unobserve(e.target); }
    }), { rootMargin: '0px 0px -10% 0px' });
    obs.observe(el);
  });
  // A section you jump to ("How it works") is shown at once, so it doesn't slide up under the nav after the jump lands.
  const showTarget = (hash) => {
    const el = hash.length > 1 && document.getElementById(decodeURIComponent(hash.slice(1)));
    const r = el && (el.classList.contains('reveal') ? el : el.closest('.reveal'));
    if (r && !r.classList.contains('in')) { r.style.transition = 'none'; r.classList.add('in'); }
  };
  showTarget(location.hash);
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a[href*="#"]');
    if (a && a.pathname === location.pathname) showTarget(a.hash);
  }, true);
  const words = io && new IntersectionObserver((entries) => entries.forEach((e) => {
    e.target.classList.toggle('lit', e.isIntersecting || e.boundingClientRect.top < 0);
  }), { rootMargin: '0px 0px -40% 0px' });
  document.querySelectorAll('.tagline .w').forEach((el) => (words ? words.observe(el) : el.classList.add('lit')));

  // Link guides: each one clicks through its steps by itself while it's on screen, until someone picks a step.
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.querySelectorAll('[data-guide]').forEach((guide) => {
    const screen = guide.querySelector('.guide-screen');
    const cursor = guide.querySelector('.gs-cursor');
    const steps = [...guide.querySelectorAll('[data-go]')];
    let at = 0;
    let timers = [];
    const later = (fn, ms) => timers.push(setTimeout(fn, still ? 0 : ms));
    // Where a target sits inside the screen, from offsets so the dialog's entrance transform doesn't throw it off.
    const point = (el) => {
      let x = el.offsetWidth * 0.55, y = el.offsetHeight * 0.6;
      for (let n = el; n && n !== screen; n = n.offsetParent) { x += n.offsetLeft; y += n.offsetTop; }
      return [x, y];
    };
    const aim = (instant) => {
      const target = guide.querySelector('[data-target="' + at + '"]');
      if (!target) return;
      const [x, y] = point(target);
      if (instant) cursor.style.transition = 'none';
      cursor.style.transform = 'translate(' + x + 'px, ' + y + 'px)';
      if (instant) { cursor.offsetWidth; cursor.style.transition = ''; }
    };
    const go = (i, instant) => {
      timers.forEach(clearTimeout);
      timers = [];
      at = i;
      guide.dataset.at = String(i);
      guide.classList.remove('copied');
      steps.forEach((s, j) => (j === i ? s.setAttribute('aria-current', 'step') : s.removeAttribute('aria-current')));
      // Let the dialog start opening before measuring, then move, then tap.
      later(() => {
        aim(instant);
        later(() => {
          cursor.classList.remove('tap'); cursor.offsetWidth; cursor.classList.add('tap');
          if (i === steps.length - 1) guide.classList.add('copied');
        }, 850);
      }, i === steps.length - 1 ? 150 : 0);
    };
    steps.forEach((s, i) => s.addEventListener('click', () => { guide.classList.remove('playing'); guide.dataset.stopped = '1'; go(i); }));
    guide.addEventListener('animationend', (e) => {
      if (!e.target.classList.contains('guide-progress') || !guide.classList.contains('playing')) return;
      go((at + 1) % steps.length);
    });
    if ('ResizeObserver' in window) new ResizeObserver(() => aim(true)).observe(screen);
    go(0, true);
    if (still || !io) return;
    new IntersectionObserver((entries) => entries.forEach((e) => {
      guide.classList.toggle('playing', e.isIntersecting && !guide.dataset.stopped);
    }), { threshold: 0.5 }).observe(screen);
  });

  // The hero follows a mouse pointer: it eases toward the target each frame and stops when it gets there.
  const stage = document.querySelector('.showcase');
  const cal = stage && stage.querySelector('.cal');
  if (stage && cal && !still && matchMedia('(hover: hover) and (pointer: fine)').matches) {
    let tx = 0, ty = 0, x = 0, y = 0, frame = 0;
    const step = () => {
      x += (tx - x) * 0.08;
      y += (ty - y) * 0.08;
      stage.style.setProperty('--gx', x.toFixed(3));
      stage.style.setProperty('--gy', y.toFixed(3));
      frame = Math.abs(tx - x) + Math.abs(ty - y) > 0.002 ? requestAnimationFrame(step) : 0;
    };
    const go = () => { if (!frame) frame = requestAnimationFrame(step); };
    const hero = stage.closest('.hero') || stage;
    hero.addEventListener('pointermove', (e) => {
      const r = stage.getBoundingClientRect();
      tx = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1));
      ty = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height) * 2 - 1));
      const c = cal.getBoundingClientRect();
      stage.style.setProperty('--sx', e.clientX - c.left + 'px');
      stage.style.setProperty('--sy', e.clientY - c.top + 'px');
      stage.style.setProperty('--spot', '1');
      go();
    });
    hero.addEventListener('pointerleave', () => { tx = 0; ty = 0; stage.style.setProperty('--spot', '0'); go(); });
  }

  // The hero demo, looping while it's on screen: the two links go in, Continue, the week fills, the reminder arrives.
  // With reduced motion the finished week stays as it is.
  const demo = document.querySelector('[data-demo]');
  if (demo && !still && io) {
    const fields = [...demo.querySelectorAll('[data-paste]')];
    const button = demo.querySelector('.demo-btn');
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const scene = (s) => { demo.dataset.scene = s; };
    let seen = false, playing = false;
    const play = async () => {
      playing = true;
      while (seen && !document.hidden) {
        fields.forEach((f) => { f.classList.remove('focus', 'done'); f.querySelector('.demo-text').textContent = ''; });
        button.classList.remove('pressed');
        scene('paste');
        for (const f of fields) {
          await wait(f === fields[0] ? 350 : 500); f.classList.add('focus');
          await wait(450);
          const text = f.querySelector('.demo-text');
          text.textContent = f.dataset.paste;
          text.scrollLeft = text.scrollWidth; // like a real field, it shows the end of the link
          f.classList.add('done');
          await wait(400); f.classList.remove('focus');
        }
        await wait(400); button.classList.add('pressed');
        await wait(300); scene('fill');
        await wait(1800); scene('remind');
        await wait(4000); scene('reset');
        await wait(700);
      }
      playing = false;
    };
    scene('reset');
    new IntersectionObserver(([e]) => { seen = e.isIntersecting; if (seen && !playing) play(); }, { threshold: 0.25 }).observe(demo);
    document.addEventListener('visibilitychange', () => { if (!document.hidden && seen && !playing) play(); });
  }

  // Tabs: arrow keys move between them, as the ARIA tabs pattern expects.
  document.querySelectorAll('[data-tabs]').forEach((box) => {
    const tabs = [...box.querySelectorAll('[role=tab]')];
    const pick = (tab, focus) => {
      tabs.forEach((t) => {
        const on = t === tab;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
      });
      if (focus) tab.focus();
    };
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => pick(t));
      t.addEventListener('keydown', (e) => {
        const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (d) { e.preventDefault(); pick(tabs[(i + d + tabs.length) % tabs.length], true); }
      });
    });
    pick(tabs[0]);
  });

  // The account menu opens under its button (it falls back to the top right corner). Browsers without popovers
  // (iOS 16 and older) get the same menu from a click handler and the .open class.
  const menu = document.getElementById('account-menu');
  const avatar = document.querySelector('[popovertarget="account-menu"]');
  const place = () => {
    const r = avatar.getBoundingClientRect();
    menu.style.top = r.bottom + 8 + 'px';
    menu.style.right = Math.max(16, innerWidth - r.right) + 'px';
  };
  if (menu && avatar && 'popover' in HTMLElement.prototype) {
    menu.addEventListener('beforetoggle', (e) => { if (e.newState === 'open') place(); });
  } else if (menu && avatar) {
    avatar.setAttribute('aria-expanded', 'false');
    const set = (open) => { menu.classList.toggle('open', open); avatar.setAttribute('aria-expanded', String(open)); if (open) place(); };
    avatar.addEventListener('click', (e) => { e.stopPropagation(); set(!menu.classList.contains('open')); });
    document.addEventListener('click', (e) => { if (!menu.contains(e.target)) set(false); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') set(false); });
  }

  // "Delete my data" opens a confirmation dialog; without JavaScript the link goes to the same confirmation as a page.
  document.querySelectorAll('[data-confirm]').forEach((link) => {
    const dialog = document.getElementById(link.dataset.confirm);
    if (!dialog || typeof dialog.showModal !== 'function') return;
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const owner = link.closest('[popover]'); // close the account menu first
      if (owner) { owner.classList.remove('open'); if (owner.hidePopover && owner.matches(':popover-open')) owner.hidePopover(); }
      dialog.showModal();
    });
    dialog.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => dialog.close()));
    dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); }); // a click on the dimmed page
  });

  const busy = (form, label, submitter) => {
    const button = submitter && submitter.classList.contains('btn') ? submitter : form.querySelector('button.btn[type=submit]');
    if (!button) return;
    button.setAttribute('aria-busy', 'true');
    button.textContent = label;
  };
  document.querySelectorAll('form[data-busy-label]:not([data-setup])').forEach((f) => f.addEventListener('submit', (e) => busy(f, f.dataset.busyLabel, e.submitter)));

  // The subscribe link: Copy puts it on the clipboard (or selects it, where that's not allowed), and a click selects it.
  document.querySelectorAll('[data-select]').forEach((input) => input.addEventListener('focus', () => input.select()));
  document.querySelectorAll('[data-copy]').forEach((button) => button.addEventListener('click', async () => {
    const input = document.getElementById(button.dataset.copy);
    const label = button.querySelector('span');
    try {
      await navigator.clipboard.writeText(input.value);
      label.textContent = 'Copied';
      setTimeout(() => { label.textContent = 'Copy link'; }, 1800);
    } catch {
      input.focus();
      input.select();
    }
  }));

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
    busy(setup, setup.dataset.busyLabel, event.submitter);
    const panel = document.querySelector('[data-loading]');
    if (panel) panel.hidden = false;
  });
})();
`;
