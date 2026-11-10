import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * A focus ring must not be drawn in the colour of what is under it —
 * docs/06 §5, WCAG 2.4.7.
 *
 * The global ring is `--accent`, outside the control, where it sits on the
 * page. A component that insets it (`outline-offset` below zero) draws it on
 * the control itself, and if the control is filled with `--accent` the ring is
 * accent on accent. That shipped through 1.2.0 on the theme control, whose
 * roving focus only ever lands on the filled segment; `contrast.test.ts` is
 * token-level and could not see it. Such a component has to switch the ring
 * to `--accent-fg`, the fill's own text colour.
 */
const SRC = join(process.cwd(), 'src');
const INSET_RING = /outline-offset\s*:\s*-/;
const ACCENT_FILL = /background(?:-color)?\s*:\s*var\(--accent\)/;
const RING_ON_FILL = /:focus-visible\s*\{[^}]*outline-color\s*:\s*var\(--accent-fg\)/;

function components(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return components(full);
    return entry.name.endsWith('.svelte') ? [full] : [];
  });
}

function css(path: string): string {
  return [...readFileSync(path, 'utf8').matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)]
    .map((match) => match[1] ?? '')
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, '');
}

/** True when a ring drawn inside this component could land on an accent fill unseen. */
function hidesRing(styles: string): boolean {
  return INSET_RING.test(styles) && ACCENT_FILL.test(styles) && !RING_ON_FILL.test(styles);
}

describe('focus rings on filled controls', () => {
  const sources = components(SRC).map((path): [string, string] => [path, css(path)]);

  it('finds the components it is meant to police', () => {
    expect(sources.filter(([, styles]) => styles !== '').length).toBeGreaterThan(20);
    // The case this test exists for must be in what it reads.
    expect(sources.some(([path]) => path.endsWith('ThemeToggle.svelte'))).toBe(true);
  });

  it('never insets a ring over an accent fill without giving it the fill’s text colour', () => {
    const offenders = sources
      .filter(([, styles]) => hidesRing(styles))
      .map(([path]) => relative(SRC, path));
    expect(offenders).toEqual([]);
  });

  it('recognises the 1.2.0 defect and its fix', () => {
    const broken = `button:focus-visible { outline-offset: -2px; }
      .selected { background: var(--accent); color: var(--accent-fg); }`;
    expect(hidesRing(broken)).toBe(true);
    expect(
      hidesRing(`${broken} .selected:focus-visible { outline-color: var(--accent-fg); }`),
    ).toBe(false);
    // A tint is not a fill, and an outset ring sits on the page.
    expect(hidesRing('a { outline-offset: -2px; } b { background: var(--accent-subtle); }')).toBe(
      false,
    );
    expect(hidesRing('a { outline-offset: 2px; } b { background: var(--accent); }')).toBe(false);
  });
});
