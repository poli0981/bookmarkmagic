import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * docs/06 §5 requires ≥ 4.5:1 contrast "in both themes (tokens chosen
 * accordingly)". Nothing enforced that, and they were not: shipping code had
 * white ink on the dark-theme accent at 3.67:1 and three status colours used as
 * text between 3.26 and 4.27 in light theme.
 *
 * Parsing the stylesheet rather than hardcoding the palette is the point — the
 * test fails when someone edits a colour, which is exactly when it matters.
 */

const TOKENS = readFileSync(join(process.cwd(), 'src/styles/tokens.css'), 'utf8');
const REQUIRED_RATIO = 4.5;

function blockOf(pattern: RegExp): Record<string, string> {
  const match = TOKENS.match(pattern);
  if (match?.[1] === undefined) throw new Error(`tokens.css: no block matching ${pattern}`);
  const out: Record<string, string> = {};
  for (const declaration of match[1].matchAll(/(--[a-z-]+):\s*(#[0-9a-f]{6})\b/gi)) {
    const [, name, value] = declaration;
    if (name !== undefined && value !== undefined) out[name] = value;
  }
  return out;
}

function relativeLuminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
}

function contrast(a: string, b: string): number {
  const [lighter, darker] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return ((lighter ?? 0) + 0.05) / ((darker ?? 0) + 0.05);
}

const light = blockOf(/:root\s*\{([\s\S]*?)\n\}/);
// The dark block overrides a subset; everything else inherits from :root.
const dark = { ...light, ...blockOf(/\[data-theme='dark'\]\s*\{([\s\S]*?)\n\}/) };
const darkMedia = {
  ...light,
  ...blockOf(/:root:not\(\[data-theme='light'\]\)\s*\{([\s\S]*?)\n\s{2}\}/),
};

/** [foreground, background] — every pair where the fg is rendered as TEXT. */
const TEXT_PAIRS: [fg: string, bg: string][] = [
  ['--fg', '--bg'],
  ['--fg', '--bg-raised'],
  ['--fg-muted', '--bg'],
  ['--fg-muted', '--bg-raised'],
  // base.css colours every <a> with --accent, and rows/links sit on both.
  ['--accent', '--bg'],
  ['--accent', '--bg-raised'],
  // Rendered as text: DuplicatePanel counts, TreePreviewNode badges,
  // WarningList's summary.
  ['--danger', '--bg-raised'],
  ['--success', '--bg-raised'],
  ['--warn', '--bg-raised'],
  // Ink on a filled control: Button .primary/.danger, ConfirmDialog .danger,
  // ThemeToggle .selected.
  ['--accent-fg', '--accent'],
  ['--danger-fg', '--danger'],
];

const THEMES: [name: string, tokens: Record<string, string>][] = [
  ['light', light],
  ['dark (data-theme)', dark],
  ['dark (prefers-color-scheme)', darkMedia],
];

describe('token contrast', () => {
  it.each(THEMES)('%s meets 4.5:1 on every text pair', (_name, tokens) => {
    const failures: string[] = [];
    for (const [fg, bg] of TEXT_PAIRS) {
      const fgValue = tokens[fg];
      const bgValue = tokens[bg];
      if (fgValue === undefined || bgValue === undefined) {
        failures.push(`${fg} or ${bg} is undefined in this theme`);
        continue;
      }
      const ratio = contrast(fgValue, bgValue);
      if (ratio < REQUIRED_RATIO) {
        failures.push(`${fg} (${fgValue}) on ${bg} (${bgValue}) = ${ratio.toFixed(2)}:1`);
      }
    }
    expect(failures).toEqual([]);
  });

  it('keeps the two dark blocks identical', () => {
    // tokens.css carries the dark palette twice — once for the explicit
    // override and once for prefers-color-scheme. They drifted once already:
    // --accent-fg was added to one and not the other.
    expect(darkMedia).toEqual(dark);
  });

  it('defines an explicit ink for every token used as a filled background', () => {
    for (const pair of ['accent', 'danger']) {
      expect(dark[`--${pair}-fg`], `--${pair}-fg missing from the dark block`).toBeDefined();
      expect(light[`--${pair}-fg`], `--${pair}-fg missing from :root`).toBeDefined();
    }
  });
});
