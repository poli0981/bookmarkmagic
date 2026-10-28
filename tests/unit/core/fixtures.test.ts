import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type BookmarkNode, type ParseWarning, walkTree } from '@/lib/core/model';
import { parseBmJson } from '@/lib/core/parse/bm-json';
import { parseCsv } from '@/lib/core/parse/csv';
import { parseNetscapeHtml } from '@/lib/core/parse/netscape-html';
import { parseBookmarkFile } from '@/lib/core/parse-file';
import { serializeNetscapeHtml } from '@/lib/core/serialize/netscape-html';
import { expectBmError } from '../../helpers/errors';
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
  'chrome-156-export.html',
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
    expect(parseBookmarkFile(text).format).toBe('netscape-html');
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

  it('weird: a loose bookmark before the wrapper list keeps the whole list', () => {
    // v1.0.x returned only "Loose first": the wrapper <DL> nested inside it.
    const { roots, warnings } = parseNetscapeHtml(read('weird/loose-first.html'));
    expect(roots.map((r) => r.title)).toEqual(['Loose first', 'Folder', 'After']);
    expect(roots[1]?.children?.map((r) => r.title)).toEqual(['Inside']);
    expect(warnings).toEqual([]);
  });

  it('weird: an unclosed <b> in a title does not hide every later entry', () => {
    const { roots, stats, warnings } = parseNetscapeHtml(read('weird/unclosed-format-tag.html'));
    expect(roots.map((r) => r.title)).toEqual(['C++ tips', 'Next', 'Folder', 'Last']);
    expect(roots[2]?.children?.map((r) => r.title)).toEqual(['Inner', 'Inner two']);
    expect(stats).toEqual({ bookmarks: 5, folders: 1, maxDepth: 2 });
    expect(warnings).toEqual([]);
  });

  it('weird: addresses Chrome would reject are skipped up front and counted', () => {
    const { roots, warnings } = parseNetscapeHtml(read('weird/invalid-urls.html'));
    expect(roots.map((r) => r.title)).toEqual(['Valid', 'Bookmarklet']);
    expect(warnings).toEqual(
      expect.arrayContaining([
        { code: 'INVALID_URL', count: 3 },
        { code: 'PLACE_QUERIES_SKIPPED', count: 1 },
        { code: 'MISSING_URL', count: 1 },
      ]),
    );
  });
});

describe('malformed fixtures', () => {
  it('no-doctype: throws NOT_NETSCAPE', () => {
    expectBmError(() => parseNetscapeHtml(read('malformed/no-doctype.html')), 'NOT_NETSCAPE');
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
    expect(parseBookmarkFile(text).format).toBe('bm-json');
    const { roots, stats } = parseBmJson(text);
    expect(roots[0]?.toolbar).toBe(true);
    expect(stats).toEqual({ bookmarks: 2, folders: 3, maxDepth: 3 });
  });

  it('csv-comma.csv detects, parses and honours the \\/ path escape', () => {
    const text = read('csv-comma.csv');
    expect(parseBookmarkFile(text).format).toBe('csv');
    const { roots } = parseCsv(text);
    expect(roots.map((r) => r.title)).toEqual(['Bookmarks bar', 'Example', 'Escaped/slash']);
  });

  it('csv-semicolon.csv detects and parses despite BOM + ; delimiter', () => {
    const text = read('csv-semicolon.csv');
    expect(parseBookmarkFile(text).format).toBe('csv');
    expect(parseCsv(text).roots[0]?.children?.[0]?.url).toBe('https://semi.example/');
  });
});

/**
 * The browser JSON formats — docs/04 §2a/§2b.
 *
 * Each JSON fixture describes the same profile as an HTML fixture written by
 * that browser's own exporter, and the parity rule is the spec: reading the
 * JSON must give exactly what reading the HTML gives, once the JSON's extra
 * knowledge is projected away. Chrome writes Other and Mobile contents loose,
 * with no folder line; Firefox leaves Mobile out of its HTML entirely.
 */
function htmlShape(roots: readonly BookmarkNode[], browser: 'chrome' | 'firefox'): BookmarkNode[] {
  const out: BookmarkNode[] = [];
  for (const node of roots) {
    if (browser === 'chrome' && node.root !== undefined) out.push(...(node.children ?? []));
    else if (browser === 'firefox' && node.root === 'mobile') continue;
    else out.push(node);
  }
  return out;
}

const byCode = (warnings: readonly ParseWarning[]): ParseWarning[] =>
  [...warnings].sort((a, b) => a.code.localeCompare(b.code));

describe('browser JSON fixtures', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('chrome-156-Bookmarks (no extension) is read as a Chrome profile file', () => {
    const { format, result } = parseBookmarkFile(read('chrome-156-Bookmarks'));
    expect(format).toBe('chrome-json');
    expect(result.roots.map((r) => [r.title, r.toolbar, r.root])).toEqual([
      ['Bookmarks bar', true, undefined],
      ['Other bookmarks', undefined, 'other'],
      ['Mobile bookmarks', undefined, 'mobile'],
    ]);
    expect(result.warnings).toEqual([]);
  });

  it("chrome: the profile file and Chrome's own HTML export of it read the same", () => {
    const json = parseBookmarkFile(read('chrome-156-Bookmarks')).result;
    const html = parseNetscapeHtml(read('chrome-156-export.html'));
    expect(htmlShape(json.roots, 'chrome')).toEqual(html.roots);
    expect(byCode(json.warnings)).toEqual(byCode(html.warnings));
  });

  it('chrome: dates are microseconds since 1601, truncated to the second as Chrome does', () => {
    const [bar] = parseBookmarkFile(read('chrome-156-Bookmarks')).result.roots;
    expect(bar?.addDate).toBe(1700000000);
    expect(bar?.children?.[1]?.children?.[0]?.addDate).toBe(1700000003);
  });

  it('firefox-bookmarks-2026-07-25.json is read as a Firefox backup, Mobile included', () => {
    const { format, result } = parseBookmarkFile(read('firefox-bookmarks-2026-07-25.json'), {
      rootTitles: {
        toolbar: 'Bookmarks Toolbar',
        other: 'Other Bookmarks',
        mobile: 'Mobile Bookmarks',
      },
    });
    expect(format).toBe('firefox-json');
    expect(result.roots.map((r) => [r.title, r.toolbar, r.root])).toEqual([
      ['Bookmarks Toolbar', true, undefined],
      ['Mobile Bookmarks', undefined, 'mobile'],
    ]);
    // The tags root lists Mozilla a second time; it must not be imported twice.
    expect(result.stats.bookmarks).toBe(3);
  });

  it('firefox: the backup and the HTML export of the same profile read the same', () => {
    const json = parseBookmarkFile(read('firefox-bookmarks-2026-07-25.json'), {
      rootTitles: { toolbar: 'Bookmarks Toolbar' },
    }).result;
    const html = parseNetscapeHtml(read('firefox-html-export.html'));
    expect(htmlShape(json.roots, 'firefox')).toEqual(html.roots);
    expect(byCode(json.warnings)).toEqual(byCode(html.warnings));
  });

  it('parses each JSON fixture exactly once', () => {
    const spy = vi.spyOn(JSON, 'parse');
    parseBookmarkFile(read('chrome-156-Bookmarks'));
    parseBookmarkFile(read('firefox-bookmarks-2026-07-25.json'));
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
