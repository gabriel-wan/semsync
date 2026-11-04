// Design tokens, structured exactly like the figma-designer skill: spacing and radius scales, raw "Core Colors"
// palettes, and role-named "Color System" tokens (its standard set) with Light and Dark modes aliasing Core Colors.
// The CSS and the /foundations page are both generated from this file, so they can't drift apart.

export const SPACING = {
  '0': 0, '25': 2, '50': 4, '75': 8, '100': 12, '200': 16, '300': 24, '400': 32, '500': 40, '600': 48, '700': 64, '800': 80, '900': 96,
} as const;

export const RADIUS = { '0': 0, '2': 2, '4': 4, '6': 6, '8': 8, '12': 12, '16': 16, '24': 24, full: 9999 } as const;

// --- Core Colors (shade steps per palette as the skill lists them) ---

const PRIMARY_STEPS = ['00', '50', '100', '150', '200', '300', '350', '400', '450', '500', '600', '700', '800', '850', '900', '950', '1000'];
const STEPS = ['00', '50', '100', '150', '200', '300', '400', '500', '600', '700', '800', '850', '900', '950', '1000'];

// Dark steps 750-1000 are fixed by the skill (#313131, #272727, #1F1F1F, #181818, #000000), and so are 400 and 600
// (the hero gradient's #9B9B9B and #666666). The light steps lean cool, towards the sky blue brand; 00 is the brand white.
const GRAYSCALE: Record<string, string> = {
  '00': '#fcffff', '50': '#f3f7fa', '100': '#eaf0f4', '150': '#e0e7ec', '200': '#d2dbe2', '250': '#c2ccd4',
  '300': '#acb6be', '400': '#9b9b9b', '450': '#888888', '500': '#737373', '600': '#666666', '700': '#4a4a4a',
  '750': '#313131', '800': '#272727', '850': '#1f1f1f', '870': '#181818', '900': '#121212', '950': '#0a0a0a', '1000': '#000000',
};

// Grayscale/700 at 16, 24, 40, 64 and 80% opacity, stored in the colour itself (aliases can't add opacity).
const GRAYSCALE_ALPHA: Record<string, string> = {
  '700-16': '#4a4a4a29', '700-24': '#4a4a4a3d', '700-40': '#4a4a4a66', '700-64': '#4a4a4aa3', '700-80': '#4a4a4acc',
};

/** A palette from one base hue (shade 500), mixed towards white and black in OKLab so steps look even. */
function palette(base: string, steps: string[]): Record<string, string> {
  return Object.fromEntries(
    steps.map((s) => {
      const n = Number(s);
      if (n === 500) return [s, base];
      return [s, n < 500 ? mix(base, '#ffffff', ((500 - n) / 500) * 0.95) : mix(base, '#000000', ((n - 500) / 500) * 0.9)];
    }),
  );
}

export const CORE: Record<string, Record<string, string>> = {
  primary: palette('#0297de', PRIMARY_STEPS), // electric blue: the brand (logo, glow, tagline band, classes, links, focus rings)
  secondary: palette('#09318d', STEPS), // deep blue: second brand hue, reserved
  // Orange: the one accent (deadlines, exams, today, the warm half of the glow, the button's hover glow). The chosen
  // #FC734D is 97% saturated; #EB7352 is the same orange at 79%, inside the skill's "one accent below 80%" rule.
  accent: palette('#eb7352', STEPS),
  grayscale: GRAYSCALE,
  red: palette('#d0453a', STEPS), // errors and exams
  green: palette('#3a9a58', STEPS),
  yellow: palette('#d9a02b', STEPS),
  'grayscale-alpha': GRAYSCALE_ALPHA,
};

// --- Color System ---

type Ref = readonly [palette: string, shade: string];

/**
 * One Color System token. `ref` is the skill's Dark alias, used as is unless `dark` overrides it.
 * Light is the skill's method: mirror the Dark shade (1000 - n), unless `light` overrides it.
 * Every override says why, and the tests fail if a reason is missing. `added` marks tokens the skill doesn't list.
 */
type Spec = { ref: Ref; dark?: Ref; darkWhy?: string; light?: Ref; lightWhy?: string; added?: string };

const G = (s: string): Ref => ['grayscale', s];
const P = (s: string): Ref => ['primary', s];
const A = (s: string): Ref => ['accent', s];
const R = (s: string): Ref => ['red', s];
const Gr = (s: string): Ref => ['green', s];
const Y = (s: string): Ref => ['yellow', s];
const OA = (s: string): Ref => ['grayscale-alpha', s];

const PAGE = 'Mirroring gives a mid grey; pages and cards need clear light steps: page grayscale/50, cards white, hover and selected one and two steps darker.';
const SUBTLE_DARK = 'The skill maps this to a light tint, which glares as a full width notice on a dark page; the dark 850 tint keeps the same hue quietly.';
const CTA = "Primary buttons are the inverted neutral, matching Google's own sign in buttons (white on dark pages, near black on light ones), so the orange stays in the glow and the exam chips (the skill aliases Action/Primary to the brand hue).";

export const SYSTEM_SPEC: Record<string, Spec> = {
  // Border
  'border-primary': { ref: G('750') },
  'border-primary-disabled': { ref: G('800') },
  'border-primary-light': { ref: G('700') },
  'border-secondary': { ref: G('750') },
  'border-tertiary': { ref: G('600') },
  'border-action-primary': { ref: P('400') },
  'border-action-disabled': { ref: P('600') },
  'border-action-secondary': { ref: G('500') },
  'border-error': { ref: R('400') },
  'border-error-disabled': { ref: R('700') },
  'border-success': { ref: Gr('400') },
  'border-warning': { ref: Y('300') },
  'border-warning-disabled': { ref: Y('700') },

  // Surface
  'surface-primary': {
    ref: G('870'), light: G('50'), lightWhy: PAGE,
    dark: G('1000'), darkWhy: 'The midnight page behind the glow: #000000, the darkest background the skill allows. Cards stay on 850.',
  },
  'surface-primary-hover': { ref: G('800'), light: G('100'), lightWhy: PAGE },
  'surface-primary-selected': { ref: G('700'), light: G('150'), lightWhy: PAGE },
  'surface-primary-subtle': { ref: G('850'), light: G('00'), lightWhy: PAGE },
  'surface-secondary': { ref: G('800'), light: G('100'), lightWhy: PAGE },
  'surface-secondary-hover': { ref: G('700'), light: G('150'), lightWhy: PAGE },
  'surface-secondary-selected': { ref: G('700'), light: G('150'), lightWhy: PAGE },
  'surface-secondary-subtle': { ref: G('750'), light: G('150'), lightWhy: PAGE },
  'surface-tertiary': { ref: G('600') },
  'surface-tertiary-hover': { ref: G('450') },
  'surface-accent': { ref: A('500') },
  'surface-accent-subtle': { ref: A('200'), dark: A('850'), darkWhy: SUBTLE_DARK },
  'surface-info': { ref: P('400') },
  'surface-info-subtle': { ref: P('150'), dark: P('850'), darkWhy: SUBTLE_DARK },
  'surface-error': { ref: R('500') },
  'surface-error-subtle': { ref: R('100'), dark: R('850'), darkWhy: SUBTLE_DARK },
  'surface-error-darker': { ref: R('700') },
  'surface-inverted': { ref: G('00') },
  'surface-inverted-hover': { ref: G('250') },
  'surface-inverted-disabled': { ref: G('450') },
  'surface-warning': { ref: Y('500') },
  'surface-warning-subtle': { ref: Y('100'), dark: Y('850'), darkWhy: SUBTLE_DARK },
  'surface-warning-hover': { ref: Y('700') },
  'surface-success': { ref: Gr('500') },
  'surface-success-subtle': { ref: Gr('100'), dark: Gr('850'), darkWhy: SUBTLE_DARK },
  'surface-brand': { ref: P('500'), added: 'The brand electric blue in both modes: the logo mark and the tagline band.' },
  // The glow behind the hero calendar, the tagline band and the closing panel is the site's one deliberate break from
  // the skills' "no background gradients" rule, at the user's request: flat panels read as artificial next to the light
  // the inspiration sites use. Text, buttons and cards stay flat, and no text sits on the glow itself.
  'surface-glow-brand': {
    ref: P('500'), light: P('300'), lightWhy: 'A paler blue keeps the glow soft on a light page.',
    added: 'The cool half of the soft glow behind the hero calendar.',
  },
  'surface-glow-deep': {
    ref: ['secondary', '500'],
    added: 'Deep blue shading in one corner of the electric blue tagline band, so it has depth instead of reading as one flat colour.',
  },
  'surface-glow-accent': {
    ref: A('500'), light: A('300'), lightWhy: 'A peach keeps the glow soft on a light page.',
    added: 'The warm half of the glow, and the glow around a primary button on hover.',
  },
  'surface-white': {
    ref: G('00'), light: G('00'), lightWhy: 'White in both modes.',
    added: "The white disc behind Google's G on the pink sign in button; Google's branding keeps the G on white.",
  },

  // Action
  'action-primary': { ref: P('500'), light: G('950'), lightWhy: CTA, dark: G('00'), darkWhy: CTA },
  'action-primary-hover': { ref: P('700'), light: G('800'), lightWhy: CTA, dark: G('150'), darkWhy: CTA },
  'action-primary-click': { ref: P('600'), light: G('700'), lightWhy: CTA, dark: G('200'), darkWhy: CTA },
  'action-primary-disabled': { ref: P('700'), light: G('200'), lightWhy: CTA, dark: G('750'), darkWhy: CTA },
  'action-secondary': { ref: G('600'), light: G('150'), lightWhy: 'The mirrored grayscale/400 fill is heavy next to white cards; grayscale/150 reads as a quieter secondary button.' },
  'action-secondary-hover': { ref: G('750'), light: G('200'), lightWhy: 'One step darker than the adjusted secondary fill.' },
  'action-secondary-click': { ref: G('700'), light: G('250'), lightWhy: 'Two steps darker than the adjusted secondary fill.' },
  'action-error': { ref: R('700') },
  'action-error-hover': { ref: R('800') },
  'action-error-disabled': { ref: R('800') },
  'action-error-subtle': { ref: R('150') },
  'action-warning': { ref: Y('500') },
  'action-warning-hover': { ref: Y('700'), dark: Y('400'), darkWhy: 'The dark warning label falls below 4.5:1 on yellow/700, so hover lightens instead.' },
  'action-warning-disabled': { ref: Y('800') },
  'action-warning-subtle': { ref: Y('100') },

  // Text
  'text-primary': { ref: G('50') },
  'text-primary-disabled': { ref: G('750') },
  'text-primary-subtle': { ref: G('500') },
  'text-secondary': { ref: G('200'), light: G('600'), lightWhy: 'The mirrored grayscale/800 is almost as dark as primary text, so secondary text would lose its hierarchy.' },
  'text-secondary-disabled': { ref: G('500') },
  'text-tertiary': { ref: G('400') },
  'text-inverted': { ref: G('850'), light: G('00'), lightWhy: 'White labels on the brand and accent fills, instead of the mirrored light grey.' },
  'text-error': { ref: R('500'), dark: R('400'), darkWhy: 'red/500 is 3.3:1 on the dark page, below 4.5:1 for body text.' },
  'text-error-disabled': { ref: R('800') },
  'text-error-inverted': { ref: R('800') },
  'text-error-inverted-disabled': { ref: R('200') },
  'text-success': { ref: Gr('600'), dark: Gr('400'), darkWhy: 'green/600 is below 4.5:1 on the dark page.' },
  'text-success-inverted': { ref: Gr('700') },
  'text-success-inverted-disabled': { ref: Gr('300') },
  'text-info': { ref: P('350'), light: P('700'), lightWhy: 'Mirrored primary/600 is 4.0:1 on the light info tint, below 4.5:1.' },
  'text-info-inverted': { ref: P('700') },
  'text-info-inverted-disabled': { ref: P('200') },
  'text-warning': { ref: Y('500'), light: Y('800'), lightWhy: 'Mirrored yellow/500 on a light page is below 4.5:1.' },
  'text-warning-disabled': { ref: Y('800') },
  'text-warning-inverted': { ref: Y('800'), light: Y('950'), lightWhy: 'Warning buttons stay yellow in both modes, so their label stays dark.' },
  'text-warning-inverted-disabled': { ref: Y('300') },
  'text-accent': { ref: A('300'), added: 'Label text on accent tinted chips (deadlines); the skill has no Text/Accent.' },
  'text-on-brand': {
    ref: G('00'), light: G('00'), lightWhy: 'White on the electric blue in both modes.',
    added: 'Large headings and icons on surface-brand. White on the electric blue is 3.2:1, so only large text (24px and up) goes there.',
  },
  'text-on-accent': {
    ref: G('950'), light: G('950'), lightWhy: 'Near black on the orange in both modes.',
    added: 'Labels on surface-accent (exam chips, today). White on the orange is under 3:1; near black passes 4.5:1.',
  },
  'text-hero-from': { ref: G('00'), added: 'Hero gradient start. The skill requires both gradient stops to be variables but does not name them.' },
  'text-hero-to': { ref: G('400'), added: 'Hero gradient end (#9B9B9B dark, #666666 light, as the skill specifies).' },

  // Icon
  'icon-default': { ref: G('50') },
  'icon-secondary': { ref: G('200') },
  'icon-subtle': { ref: G('500') },
  'icon-inverted': { ref: G('850'), light: G('00'), lightWhy: 'Matches text-inverted.' },
  'icon-disabled': { ref: G('750') },
  'icon-error': { ref: R('500'), light: R('600'), lightWhy: 'Mirrored red/500 is 2.9:1 on the light error tint, below 3:1.' },
  'icon-error-disabled': { ref: R('800') },
  'icon-error-inverted-disabled': { ref: R('200') },
  'icon-info': { ref: P('350') },
  'icon-info-disabled': { ref: P('200') },
  'icon-warning': { ref: Y('500'), light: Y('700'), lightWhy: 'Mirrored yellow/500 is below 3:1 on light surfaces.' },
  'icon-warning-inverted': { ref: Y('700') },
  'icon-warning-disabled': { ref: Y('800') },
  'icon-warning-inverted-disabled': { ref: Y('300') },
  'icon-success': { ref: Gr('400') },
  'icon-success-inverted-disabled': { ref: Gr('300') },

  // Overlay
  'overlay-xs': { ref: OA('700-16'), light: OA('700-16'), lightWhy: 'Overlays are the same translucent scrim in both modes.' },
  'overlay-sm': { ref: OA('700-24'), light: OA('700-24'), lightWhy: 'Overlays are the same translucent scrim in both modes.' },
  'overlay-md': { ref: OA('700-40'), light: OA('700-40'), lightWhy: 'Overlays are the same translucent scrim in both modes.' },
  'overlay-lg': { ref: OA('700-64'), light: OA('700-64'), lightWhy: 'Overlays are the same translucent scrim in both modes.' },
  'overlay-xlg': { ref: OA('700-80'), light: OA('700-80'), lightWhy: 'Overlays are the same translucent scrim in both modes.' },
};

/** The skill's light method: mirror the shade around 500, snapped to the nearest shade that palette has. */
export function mirror([p, s]: Ref): Ref {
  const target = 1000 - Number(s);
  const shades = Object.keys(CORE[p]);
  const nearest = shades.reduce((best, x) => (Math.abs(Number(x) - target) < Math.abs(Number(best) - target) ? x : best));
  return [p, nearest];
}

export type Mode = 'light' | 'dark';

export const SYSTEM: Record<string, { light: Ref; dark: Ref }> = Object.fromEntries(
  Object.entries(SYSTEM_SPEC).map(([name, t]) => {
    const dark = t.dark ?? t.ref;
    return [name, { dark, light: t.light ?? mirror(dark) }];
  }),
);

export function resolve(token: string, mode: Mode): string {
  const [p, s] = SYSTEM[token][mode];
  return CORE[p][s];
}

// --- Text styles (names and sizes exactly as the skill lists them) ---

type TextStyle = { size: number; line: number; weight: 400 | 500 | 600 };

// Heading weight: figma-designer says Regular, landing-page-design says Semibold. This is a web page, so the web
// skill wins here; it is the one place the two skills can't both be followed.
const HEADING_WEIGHT = 600;

export const TEXT_STYLES: Record<string, TextStyle> = {
  'heading-1': { size: 60, line: 60, weight: HEADING_WEIGHT },
  'heading-2': { size: 48, line: 48, weight: HEADING_WEIGHT },
  'heading-3': { size: 36, line: 40, weight: HEADING_WEIGHT },
  'heading-4': { size: 30, line: 36, weight: HEADING_WEIGHT },
  'heading-5': { size: 24, line: 32, weight: HEADING_WEIGHT },
  'heading-6': { size: 20, line: 28, weight: HEADING_WEIGHT },
  'title-1': { size: 20, line: 28, weight: 500 },
  'title-2': { size: 18, line: 28, weight: 500 },
  'title-3': { size: 16, line: 24, weight: 500 },
  'title-4': { size: 14, line: 20, weight: 500 },
  'title-5': { size: 12, line: 16, weight: 500 },
  'body-1': { size: 16, line: 24, weight: 600 },
  'body-2': { size: 16, line: 24, weight: 500 },
  'body-3': { size: 16, line: 24, weight: 400 },
  'body-4': { size: 14, line: 20, weight: 600 },
  'body-5': { size: 14, line: 20, weight: 500 },
  'body-6': { size: 14, line: 20, weight: 400 },
  // Added per the skill's rule (next number in the group, on a scale step): 18/28 regular for lead paragraphs.
  'body-7': { size: 18, line: 28, weight: 400 },
  'button-lg': { size: 18, line: 28, weight: 600 },
  'button-md': { size: 16, line: 24, weight: 600 },
  'button-sm': { size: 14, line: 20, weight: 600 },
  'button-xsm': { size: 12, line: 16, weight: 600 },
  'caption-1': { size: 14, line: 20, weight: 500 },
  'caption-2': { size: 14, line: 20, weight: 400 },
  'caption-3': { size: 12, line: 16, weight: 600 },
  'caption-4': { size: 12, line: 16, weight: 500 },
  'caption-5': { size: 12, line: 16, weight: 400 },
};

export function tokensCss(): string {
  const vars = (entries: [string, string][]) => entries.map(([k, v]) => `--${k}: ${v};`).join(' ');
  const core = vars(Object.entries(CORE).flatMap(([p, shades]) => Object.entries(shades).map(([s, hex]): [string, string] => [`${p}-${s}`, hex])));
  const system = (mode: Mode) =>
    vars(Object.entries(SYSTEM).map(([name, t]): [string, string] => [name, `var(--${t[mode][0]}-${t[mode][1]})`]));
  const scale = vars([
    ...Object.entries(SPACING).map(([k, v]): [string, string] => [`space-${k}`, `${v}px`]),
    ...Object.entries(RADIUS).map(([k, v]): [string, string] => [`radius-${k}`, `${v}px`]),
  ]);
  const styles = Object.entries(TEXT_STYLES)
    .map(([name, s]) => `.${name} { font-size: ${s.size}px; line-height: ${s.line}px; font-weight: ${s.weight}; }`)
    .join('\n');
  // The page follows the system setting until someone uses the toggle, which sets data-theme on <html>.
  // .mode-light / .mode-dark come last so they win, letting /foundations show both modes side by side.
  return `:root { ${core} ${scale} }
:root { ${system('light')} color-scheme: light; }
@media (prefers-color-scheme: dark) { :root { ${system('dark')} color-scheme: dark; } }
:root[data-theme="light"] { ${system('light')} color-scheme: light; }
:root[data-theme="dark"] { ${system('dark')} color-scheme: dark; }
.mode-light { ${system('light')} color-scheme: light; }
.mode-dark { ${system('dark')} color-scheme: dark; }
${styles}`;
}

// --- Colour maths (OKLab mixing, WCAG contrast) ---

function toLinear(c: number) {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function toSrgb(c: number) {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
}

function hexToRgb(hex: string): number[] {
  const n = parseInt(hex.slice(1, 7), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255);
}

function rgbToHex(rgb: number[]): string {
  return `#${rgb.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0')).join('')}`;
}

function toOklab(rgb: number[]): number[] {
  const [r, g, b] = rgb.map(toLinear);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function fromOklab([L, a, b]: number[]): number[] {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map(toSrgb);
}

export function mix(a: string, b: string, t: number): string {
  const A = toOklab(hexToRgb(a));
  const B = toOklab(hexToRgb(b));
  return rgbToHex(fromOklab(A.map((v, i) => v + (B[i] - v) * t)));
}

export function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = hexToRgb(hex).map(toLinear);
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** HSL saturation, 0 to 1. */
export function saturation(hex: string): number {
  const rgb = hexToRgb(hex);
  const max = Math.max(...rgb);
  const min = Math.min(...rgb);
  const l = (max + min) / 2;
  return max === min ? 0 : (max - min) / (1 - Math.abs(2 * l - 1));
}
