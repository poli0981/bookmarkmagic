import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Motion only for those who have not asked for less — docs/06 §5, WCAG 2.3.3.
 *
 * Every `animation`, and every `transition` that moves something, must sit
 * inside `@media (prefers-reduced-motion: no-preference)`. Colour and opacity
 * fades are not motion and may live anywhere. Parsed from the real styles, so
 * a new component cannot opt out by forgetting.
 */
const SRC = join(process.cwd(), 'src');
const GUARD = /@media\s*\(\s*prefers-reduced-motion\s*:\s*no-preference\s*\)/;
/** Properties whose transition changes appearance without moving anything. */
const STILL = new Set([
  'color',
  'background',
  'background-color',
  'border-color',
  'outline-color',
  'opacity',
  'box-shadow',
  'fill',
  'stroke',
]);

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return files(full);
    return /\.(svelte|css)$/.test(entry.name) ? [full] : [];
  });
}

/** The CSS of a file: a stylesheet as-is, a component's `<style>` blocks. */
function cssOf(path: string, text: string): string {
  if (path.endsWith('.css')) return text;
  return [...text.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1] ?? '').join('\n');
}

/** Declarations as [property, value, guarded], with comments stripped. */
function declarations(css: string): [string, string, boolean][] {
  const out: [string, string, boolean][] = [];
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const guards: boolean[] = [];
  let buffer = '';
  for (const ch of clean) {
    if (ch === '{') {
      guards.push(GUARD.test(buffer) || guards.at(-1) === true);
      buffer = '';
    } else if (ch === '}' || ch === ';') {
      const match = buffer.match(/^\s*([a-z-]+)\s*:([\s\S]*)$/i);
      if (match?.[1] !== undefined) {
        out.push([match[1].toLowerCase(), (match[2] ?? '').trim(), guards.at(-1) === true]);
      }
      buffer = '';
      if (ch === '}') guards.pop();
    } else {
      buffer += ch;
    }
  }
  return out;
}

function moves(property: string, value: string): boolean {
  if (property === 'animation' || property === 'animation-name') return value !== 'none';
  if (property === 'transition') {
    return value
      .split(',')
      .map((part) => part.trim().split(/\s+/)[0] ?? '')
      .some((name) => name !== 'none' && !STILL.has(name));
  }
  if (property === 'transition-property') {
    return value.split(',').some((name) => !STILL.has(name.trim()));
  }
  return false;
}

describe('motion is opt-in', () => {
  const sources = files(SRC).map((path) => [path, cssOf(path, readFileSync(path, 'utf8'))]);

  it('finds the styles it is meant to police', () => {
    expect(sources.filter(([, css]) => css !== '').length).toBeGreaterThan(20);
  });

  it('keeps every animation and moving transition inside the reduced-motion guard', () => {
    const offenders: string[] = [];
    for (const [path, css] of sources) {
      for (const [property, value, guarded] of declarations(css ?? '')) {
        if (!guarded && moves(property, value)) {
          offenders.push(`${relative(SRC, path ?? '')}: ${property}: ${value}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('recognises a guarded block and an unguarded one', () => {
    const css = `a { transition: transform 1s; }
      @media (prefers-reduced-motion: no-preference) { b { animation: spin 1s; } }
      c { transition: color 1s, opacity 1s; }`;
    const found = declarations(css).filter(([p, v, g]) => !g && moves(p, v));
    expect(found).toEqual([['transition', 'transform 1s', false]]);
  });
});
