import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * State that survives a contrast theme — docs/06 §5, WCAG 1.4.1 / 2.4.7.
 *
 * In forced-colours mode (Windows "Contrast themes") the browser replaces
 * every colour and removes `box-shadow` and background images. A state shown
 * only by a fill or a shadow is then not shown at all: through 1.2.0 that was
 * the #edit tree's focused row, the line that says where a drag will land, the
 * selected theme, the current section, the selected option cards, the progress
 * bar's fill, and the drop zone's whole outline.
 *
 * Each of those components must carry a `@media (forced-colors: active)` block
 * that names a system colour. The list is hand-maintained, like the contrast
 * pairs: a NEW component that shows state by a fill or a shadow has to be
 * added here, and the PR checklist asks.
 */
const COMPONENTS = join(process.cwd(), 'src', 'lib', 'components');

const STATEFUL: [file: string, state: string][] = [
  ['TreeRow.svelte', 'the focused row and the drop lines'],
  ['ThemeToggle.svelte', 'the selected theme'],
  ['TabBar.svelte', 'the current section'],
  ['StatusBar.svelte', 'the current section (Settings / About)'],
  ['ImportOptions.svelte', 'the selected import mode'],
  ['FormatSelect.svelte', 'the selected export format'],
  ['ProgressBar.svelte', 'the fill'],
  ['DropZone.svelte', 'the zone’s boundary and the drag-over state'],
];

const SYSTEM_COLOR = /\b(?:Highlight|HighlightText|ButtonText|CanvasText|ButtonBorder)\b/;

/** The bodies of every `@media (forced-colors: active)` block in a component's styles. */
function forcedBlocks(source: string): string[] {
  const styles = [...source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)]
    .map((match) => match[1] ?? '')
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  const blocks: string[] = [];
  const opener = /@media\s*\(\s*forced-colors\s*:\s*active\s*\)\s*\{/g;
  for (let match = opener.exec(styles); match !== null; match = opener.exec(styles)) {
    let depth = 1;
    let end = opener.lastIndex;
    while (end < styles.length && depth > 0) {
      if (styles[end] === '{') depth++;
      else if (styles[end] === '}') depth--;
      end++;
    }
    blocks.push(styles.slice(opener.lastIndex, end - 1));
  }
  return blocks;
}

describe('forced colours', () => {
  it.each(STATEFUL)('%s says %s in system colours', (file) => {
    const blocks = forcedBlocks(readFileSync(join(COMPONENTS, file), 'utf8'));
    expect(blocks.length, `${file} has no forced-colors block`).toBeGreaterThan(0);
    expect(blocks.some((block) => SYSTEM_COLOR.test(block))).toBe(true);
  });

  it('never uses a theme token inside a forced-colours block', () => {
    // A token there is replaced like any other colour — the block would look
    // right in the source and do nothing in the browser.
    const offenders = STATEFUL.filter(([file]) =>
      forcedBlocks(readFileSync(join(COMPONENTS, file), 'utf8')).some((block) =>
        /var\(--/.test(block),
      ),
    ).map(([file]) => file);
    expect(offenders).toEqual([]);
  });

  it('reads a nested block whole, and ignores a commented-out one', () => {
    const source = `<style>
      /* @media (forced-colors: active) { .x { color: Highlight; } } */
      @media (forced-colors: active) {
        .a { outline: 2px solid Highlight; }
        .b::after { border-top: 2px solid Highlight; }
      }
    </style>`;
    const blocks = forcedBlocks(source);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toContain('.b::after');
  });
});
