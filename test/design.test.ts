import { describe, expect, it } from 'vitest';
import { Foundations, Landing, OgCard } from '../src/views/pages';
import { CSS } from '../src/views/styles';
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
    const defined = new Set([...CSS.matchAll(/--([a-z0-9-]+)\s*:/g)].map((m) => m[1]));
    const html = await Promise.all([Foundations({}), Landing({}), OgCard({})].map(async (n) => String(await (n as { toString(): string }).toString())));
    const used = new Set([...`${CSS}\n${html.join('\n')}`.matchAll(/var\(--([a-z0-9-]+)\)/g)].map((m) => m[1]));
    expect([...used].filter((u) => !defined.has(u))).toEqual([]);
  });

  it('uses only the allowed dark backgrounds for page and card surfaces', () => {
    const allowed = ['#000000', '#181818', '#1f1f1f', '#272727', '#313131', '#131209'];
    for (const t of ['surface-primary', 'surface-primary-subtle', 'surface-secondary']) expect(allowed).toContain(resolve(t, 'dark'));
  });
});
