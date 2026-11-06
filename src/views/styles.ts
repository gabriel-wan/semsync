import { SPACING, tokensCss } from './tokens.js';

// What every page carries inline: the design tokens as CSS variables, and the spacing helpers made from them
// (.mt-25 and so on). Every other rule is in public/site.css, which only uses these variables.
export const CSS = `${tokensCss()}\n${Object.keys(SPACING)
  .filter((k) => Number(k) >= 25)
  .map((k) => `.mt-${k} { margin-top: var(--space-${k}); }`)
  .join(' ')}\n`;

/** Where a chosen light or dark mode is saved. public/app.js uses the same key. */
export const THEME_KEY = 'semsync-theme';

// Runs in <head> before the page draws: marks that JavaScript is on (so the toggle shows) and applies a saved light or
// dark choice, so there's no flash of the other mode.
export const THEME_INIT = `document.documentElement.classList.add('js');
try { var t = localStorage.getItem('${THEME_KEY}'); if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t; } catch (e) {}`;

// Everything else that runs in the browser is public/app.js, loaded with defer on every page.
