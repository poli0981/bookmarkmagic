import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { detectFormat } from '@/lib/core/detect-format';
import { type BookmarkNode, computeStats, type ParseResult, walkTree } from '@/lib/core/model';
import { parseBmJson } from '@/lib/core/parse/bm-json';
import { parseCsv } from '@/lib/core/parse/csv';
import { parseNetscapeHtml } from '@/lib/core/parse/netscape-html';

/**
 * `scripts/sanitize-bookmarks.mjs` — docs/11 §2, docs/09 §6.
 *
 * The script makes exactly one promise: after sanitizing, the bug still
 * reproduces. That is directly assertable against the committed corpus — parse
 * both versions and require the parser to see the same thing — so this suite
 * asserts the promise rather than the implementation.
 *
 * The script is invoked as a subprocess rather than imported. It is a `.mjs`
 * with no type declarations, and it has to keep running from a fresh clone with
 * nothing installed; spawning it also exercises the real entry point, argument
 * parsing included.
 */
const root = process.cwd();
const script = join(root, 'scripts', 'sanitize-bookmarks.mjs');
const fixtures = join(root, 'tests', 'fixtures');

const sanitize = (absPath: string): string =>
  execFileSync(process.execPath, [script, absPath, '--stdout'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });

/**
 * Every committed fixture file, as paths relative to `tests/fixtures/`.
 *
 * Discovered rather than listed, so a fixture added by a future bug report is
 * covered without anyone remembering to add it here. `generated/` is skipped:
 * it is git-ignored `gen-fixture.mjs` output, so it exists on some machines and
 * not others, and a suite whose corpus depends on that is not reproducible.
 */
function corpus(): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'generated') continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(html|json|csv)$/.test(entry.name)) out.push(relative(fixtures, full));
    }
  };
  walk(fixtures);
  return out.sort();
}

const FIXTURES = corpus();

/** Parse with whichever parser the sniffed format selects. */
function parseAny(text: string): ParseResult {
  const format = detectFormat(text);
  if (format === 'netscape-html') return parseNetscapeHtml(text);
  if (format === 'bm-json') return parseBmJson(text);
  return parseCsv(text);
}

/** Structure only: folder/bookmark shape and nesting, with no titles or URLs. */
function topology(roots: readonly BookmarkNode[]): string {
  const render = (nodes: readonly BookmarkNode[]): string =>
    nodes.map((n) => (n.url === undefined ? `F(${render(n.children ?? [])})` : 'B')).join(',');
  return render(roots);
}

const hostsIn = (roots: readonly BookmarkNode[]): string[] => {
  const out: string[] = [];
  for (const { node } of walkTree(roots)) {
    if (node.url === undefined) continue;
    try {
      const { host } = new URL(node.url);
      if (host !== '') out.push(host);
    } catch {
      // Unparseable URLs carry no host to leak.
    }
  }
  return out;
};

it('the corpus is non-empty, so a broken walk cannot pass vacuously', () => {
  expect(FIXTURES.length).toBeGreaterThan(10);
});

describe.each(FIXTURES)('sanitize %s', (name) => {
  const original = readFileSync(join(fixtures, name), 'utf8');
  const cleaned = sanitize(join(fixtures, name));

  it('keeps the file recognisable as the same format', () => {
    let before: string;
    try {
      before = detectFormat(original);
    } catch {
      // A fixture that is deliberately unrecognisable must stay unrecognisable.
      expect(() => detectFormat(cleaned)).toThrow();
      return;
    }
    expect(detectFormat(cleaned)).toBe(before);
  });

  it('parses to the same stats, warnings and structure — or fails the same way', () => {
    let before: ParseResult;
    try {
      before = parseAny(original);
    } catch (err) {
      // The interesting half: a fixture that reproduces a parse *failure* must
      // still reproduce it, with the same code, after sanitizing.
      const code = (err as { code?: string }).code;
      expect(() => parseAny(cleaned)).toThrowError(expect.objectContaining({ code }));
      return;
    }

    const after = parseAny(cleaned);
    expect(after.stats).toEqual(before.stats);
    expect(computeStats(after.roots)).toEqual(computeStats(before.roots));
    expect(topology(after.roots)).toBe(topology(before.roots));
    expect(after.warnings.map((w) => w.code).sort()).toEqual(
      before.warnings.map((w) => w.code).sort(),
    );
  });

  it('preserves byte-level shape: BOM, line endings and length of the untouched parts', () => {
    expect(cleaned.charCodeAt(0) === 0xfeff).toBe(original.charCodeAt(0) === 0xfeff);
    expect(cleaned.includes('\r\n')).toBe(original.includes('\r\n'));
    expect(cleaned.split('\n').length).toBe(original.split('\n').length);
  });

  it('preserves every timestamp exactly', () => {
    const stamps = (text: string): string[] =>
      (text.match(/(?:ADD_DATE|LAST_MODIFIED)="(\d*)"/gi) ?? []).sort();
    expect(stamps(cleaned)).toEqual(stamps(original));
  });

  it('leaks no hostname from the original', () => {
    let before: ParseResult;
    try {
      before = parseAny(original);
    } catch {
      return;
    }
    const leaked = hostsIn(before.roots).filter((h) => cleaned.includes(h));
    expect(leaked).toEqual([]);
  });

  it('keeps distinct URLs distinct, so dedupe behaviour is unchanged', () => {
    let before: ParseResult;
    try {
      before = parseAny(original);
    } catch {
      return;
    }
    const urls = (r: ParseResult): number => {
      const set = new Set<string>();
      for (const { node } of walkTree(r.roots)) if (node.url !== undefined) set.add(node.url);
      return set.size;
    };
    expect(urls(parseAny(cleaned))).toBe(urls(before));
  });
});
