import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { detectFormat } from '@/lib/core/detect-format';
import { type BmParseError, type BookmarkNode, walkTree } from '@/lib/core/model';
import { parseBmJson } from '@/lib/core/parse/bm-json';
import { parseCsv } from '@/lib/core/parse/csv';
import { parseNetscapeHtml } from '@/lib/core/parse/netscape-html';
import { serializeNetscapeHtml } from '@/lib/core/serialize/netscape-html';
import { project } from '../../helpers/tree';

/**
 * Real-world fixtures — docs/11 §2.
 *
 * Rule: every browser-specific quirk discovered later gets a fixture and a
 * regression test in the same PR.
 */
// Vitest runs from the project root; import.meta.url is not a file: URL under
// the jsdom environment, so resolve from cwd instead.
const dir = join(process.cwd(), 'tests', 'fixtures');
const read = (name: string): string => readFileSync(join(dir, name), 'utf8');

const BROWSER_EXPORTS = [
  'chrome-131-export.html',
  'edge-export.html',
  'firefox-html-export.html',
  'safari-export.html',
  'vivaldi-export.html',
];

const urlsOf = (roots: readonly BookmarkNode[]): string[] => {
  const out: string[] = [];
  for (const { node } of walkTree(roots)) if (node.url !== undefined) out.push(node.url);
  return out.sort();
};

describe.each(BROWSER_EXPORTS)('fixture: %s', (name) => {
  const text = read(name);

  it('is detected as Netscape HTML', () => {
    expect(detectFormat(text)).toBe('netscape-html');
  });

  it('parses to a non-empty tree', () => {
    const { roots, stats } = parseNetscapeHtml(text);
    expect(roots.length).toBeGreaterThan(0);
    expect(stats.bookmarks).toBeGreaterThan(0);
  });

  it('re-imports its own HTML export under the documented projection', () => {
    // Not identity: Firefox writes LAST_MODIFIED on <A>, which our serializer
    // (like Chrome) does not emit — docs/04 §1.1, docs/11 §3.
    const once = parseNetscapeHtml(text).roots;
    expect(parseNetscapeHtml(serializeNetscapeHtml(once)).roots).toEqual(
      project(once, 'netscape-html'),
    );
  });
});

describe('fixture specifics', () => {
  it('chrome: reads the toolbar folder, preserves the empty folder, decodes entities', () => {
    const { roots, warnings } = parseNetscapeHtml(read('chrome-131-export.html'));
    expect(roots[0]?.title).toBe('Bookmarks bar');
    expect(roots[0]?.toolbar).toBe(true);
    expect(roots[0]?.children?.[2]).toEqual({
      title: 'Empty folder',
      addDate: 1700000005,
      children: [],
    });
    expect(urlsOf(roots)).toContain('https://example.com/?q=a&b=1#frag');
    // ICON present on one bookmark; ADD_DATE="0" must NOT warn.
    expect(warnings.find((w) => w.code === 'FAVICONS_IGNORED')?.count).toBe(1);
    expect(warnings.map((w) => w.code)).not.toContain('INVALID_DATE');
  });

  it('edge: keeps a file:// bookmark verbatim', () => {
    const { roots } = parseNetscapeHtml(read('edge-export.html'));
    expect(urlsOf(roots)).toContain('file:///C:/Users/Public/notes.txt');
  });

  it('firefox: DD does not eat the subtree, HR is skipped, extras ignored', () => {
    const { roots, warnings } = parseNetscapeHtml(read('firefox-html-export.html'));
    const toolbar = roots[0];
    expect(toolbar?.title).toBe('Bookmarks Toolbar');
    expect(urlsOf(roots)).toEqual(['https://support.mozilla.org/', 'https://www.mozilla.org/']);
    expect(warnings.map((w) => w.code)).toContain('DESCRIPTIONS_DROPPED');
  });

  it('safari: both top-level folders survive', () => {
    const { roots } = parseNetscapeHtml(read('safari-export.html'));
    expect(roots.map((r) => r.title)).toEqual(['Favorites', 'Reading List']);
    expect(urlsOf(roots)).toHaveLength(3);
  });

  it('weird: dd fixture keeps the nested bookmark and its sibling', () => {
    const { roots } = parseNetscapeHtml(read('weird/folder-with-dd.html'));
    expect(roots[0]?.children?.[0]?.url).toBe('https://kept.example/');
    expect(roots[1]?.url).toBe('https://sibling.example/');
  });

  it('weird: Safari export with no wrapper <DL> keeps both top-level folders', () => {
    const { roots } = parseNetscapeHtml(read('weird/safari-no-wrapper.html'));
    expect(roots.map((r) => r.title)).toEqual(['Favorites', 'Reading List']);
    expect(urlsOf(roots)).toEqual(['https://webkit.org/blog/', 'https://www.apple.com/']);
  });

  it('weird: a wrapper <DL> mixed with loose top-level <DT>s keeps both halves', () => {
    const { roots } = parseNetscapeHtml(read('weird/mixed-wrapper.html'));
    expect(roots.map((r) => r.title)).toEqual(['Bookmarks bar', 'Other Bookmarks']);
    expect(urlsOf(roots)).toEqual(['https://in.example/', 'https://out.example/']);
  });

  it('weird: explicit </DT> exercises the sibling-DL branch', () => {
    const { roots } = parseNetscapeHtml(read('weird/explicit-close-dt.html'));
    expect(roots[0]?.children?.[0]?.url).toBe('https://sibling-dl.example/');
  });

  it('weird: epoch magnitudes all normalize to the same second', () => {
    const { roots, warnings } = parseNetscapeHtml(read('weird/microsecond-dates.html'));
    const dates = roots.filter((r) => r.url !== undefined).map((r) => r.addDate);
    expect(dates.slice(0, 3)).toEqual([1700000000, 1700000000, 1700000000]);
    expect(warnings.find((w) => w.code === 'INVALID_DATE')?.count).toBe(1);
  });

  it('weird: depth 150 parses under the 200 cap', () => {
    const { stats } = parseNetscapeHtml(read('weird/deep-nesting.html'));
    expect(stats.maxDepth).toBe(151);
  });

  it('weird: emoji, RTL and entities survive a round trip', () => {
    const once = parseNetscapeHtml(read('weird/emoji-rtl-titles.html')).roots;
    expect(once[0]?.title).toBe('🌸 桜 フォルダ');
    expect(once[0]?.children?.[1]?.title).toBe('Tom & Jerry <3 "quoted"');
    expect(parseNetscapeHtml(serializeNetscapeHtml(once)).roots).toEqual(once);
  });
});

describe('malformed fixtures', () => {
  it('no-doctype: throws NOT_NETSCAPE', () => {
    try {
      parseNetscapeHtml(read('malformed/no-doctype.html'));
      expect.unreachable('should have thrown');
    } catch (err) {
      expect((err as BmParseError).code).toBe('NOT_NETSCAPE');
    }
  });

  it('doctype-only: yields an empty result with NO_BOOKMARKS, not a crash', () => {
    const { roots, warnings } = parseNetscapeHtml(read('malformed/doctype-only.html'));
    expect(roots).toEqual([]);
    expect(warnings.map((w) => w.code)).toContain('NO_BOOKMARKS');
  });

  it('truncated: recovers what it can', () => {
    const { roots } = parseNetscapeHtml(read('malformed/truncated.html'));
    expect(urlsOf(roots)).toEqual(['https://example.com/']);
  });

  it('script-injection: titles are inert text and nothing executes (T1)', () => {
    const { roots } = parseNetscapeHtml(read('malformed/script-injection.html'));
    expect((globalThis as Record<string, unknown>).__pwned).toBeUndefined();
    const titles = [...walkTree(roots)].map(({ node }) => node.title);
    expect(titles).toContain('<img src=x onerror=alert(1)>');
    expect(titles).toContain('<script>alert(2)</script>');
    expect(urlsOf(roots)).toContain('https://ok.example/');
  });

  it('js-url: dangerous schemes are parsed and stored verbatim, not dropped (T3)', () => {
    const { roots } = parseNetscapeHtml(read('malformed/js-url.html'));
    expect(urlsOf(roots)).toEqual([
      'data:text/html,<h1>hi</h1>',
      'https://safe.example/',
      'javascript:alert(1)',
    ]);
  });
});

describe('non-HTML fixtures', () => {
  it('bm-v1-sample.json detects and parses', () => {
    const text = read('bm-v1-sample.json');
    expect(detectFormat(text)).toBe('bm-json');
    const { roots, stats } = parseBmJson(text);
    expect(roots[0]?.toolbar).toBe(true);
    expect(stats).toEqual({ bookmarks: 2, folders: 3, maxDepth: 3 });
  });

  it('csv-comma.csv detects, parses and honours the \\/ path escape', () => {
    const text = read('csv-comma.csv');
    expect(detectFormat(text)).toBe('csv');
    const { roots } = parseCsv(text);
    expect(roots.map((r) => r.title)).toEqual(['Bookmarks bar', 'Example', 'Escaped/slash']);
  });

  it('csv-semicolon.csv detects and parses despite BOM + ; delimiter', () => {
    const text = read('csv-semicolon.csv');
    expect(detectFormat(text)).toBe('csv');
    expect(parseCsv(text).roots[0]?.children?.[0]?.url).toBe('https://semi.example/');
  });
});
