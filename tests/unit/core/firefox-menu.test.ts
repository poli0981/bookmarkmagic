import { describe, expect, it } from 'vitest';
import { capUrlLength } from '@/lib/core/href';
import type { BookmarkNode, ParseResult } from '@/lib/core/model';
import { computeStats } from '@/lib/core/model';
import { parseBmJson } from '@/lib/core/parse/bm-json';
import { readFirefoxJson } from '@/lib/core/parse/firefox-json';
import { parseNetscapeHtml } from '@/lib/core/parse/netscape-html';
import { buildImportPlan } from '@/lib/core/plan';
import { routeTopLevel } from '@/lib/core/route';
import { serializeBmJson } from '@/lib/core/serialize/bm-json';
import { serializeNetscapeHtml } from '@/lib/core/serialize/netscape-html';

/**
 * Firefox's Bookmarks Menu, separators and address limit in the pure core —
 * docs/03 §1, docs/04 (since v1.3.0).
 */

const link = (title: string): BookmarkNode => ({ title, url: `https://${title}.example/` });

/** A Firefox profile's export as BookmarkMagic models it: four marked roots. */
const FIREFOX_EXPORT: BookmarkNode[] = [
  { title: 'Bookmarks Menu', root: 'menu', children: [link('m1'), link('m2')] },
  { title: 'Bookmarks Toolbar', toolbar: true, children: [link('t1')] },
  { title: 'Other Bookmarks', root: 'other', children: [link('o1')] },
  { title: 'Mobile Bookmarks', root: 'mobile', children: [link('p1')] },
];

const titles = (nodes: readonly BookmarkNode[]): string[] => nodes.map((n) => n.title);

describe('routeTopLevel — the Bookmarks Menu', () => {
  it('unwraps a menu folder into the menu, and sends loose entries there, on Firefox', () => {
    const routed = routeTopLevel([...FIREFOX_EXPORT, link('loose')], {
      hasMobileRoot: true,
      hasMenuRoot: true,
    });
    expect(titles(routed.menu)).toEqual(['m1', 'm2', 'loose']);
    expect(titles(routed.toolbar)).toEqual(['t1']);
    expect(titles(routed.other)).toEqual(['o1']);
    expect(titles(routed.mobile)).toEqual(['p1']);
    expect(routed.unwrapped).toBe(4);
  });

  it('keeps a menu folder as a folder under Other where there is no menu (Chromium)', () => {
    const routed = routeTopLevel([...FIREFOX_EXPORT, link('loose')], { hasMobileRoot: true });
    expect(routed.menu).toEqual([]);
    expect(titles(routed.other)).toEqual(['Bookmarks Menu', 'o1', 'loose']);
    expect(routed.unwrapped).toBe(3);
  });

  it('still keeps a Mobile folder under Other when the profile has no Mobile root', () => {
    const routed = routeTopLevel(FIREFOX_EXPORT, { hasMobileRoot: false, hasMenuRoot: true });
    expect(titles(routed.other)).toEqual(['o1', 'Mobile Bookmarks']);
  });
});

describe('buildImportPlan — a fourth destination', () => {
  const destinations = {
    menu: { id: 'menu________', title: 'Bookmarks Menu', children: [] },
    toolbar: { id: 'toolbar_____', title: 'Bookmarks Toolbar', children: [] },
    other: { id: 'unfiled_____', title: 'Other Bookmarks', children: [] },
    mobile: { id: 'mobile______', title: 'Mobile Bookmarks', children: [] },
  };

  it('writes the menu into the menu, first, in Merge and Replace', () => {
    for (const mode of ['merge', 'replace'] as const) {
      const plan = buildImportPlan({
        roots: FIREFOX_EXPORT,
        mode,
        dedupe: false,
        browserIndex: new Set(),
        destinations,
        newFolderTitle: 'Imported',
      });
      expect(plan.segments.map((s) => s.parentId)).toEqual([
        'menu________',
        'toolbar_____',
        'unfiled_____',
        'mobile______',
      ]);
      expect(plan.stats.bookmarkCount).toBe(5);
    }
  });

  it('puts the New-folder wrapper under Other Bookmarks, as on Chrome', () => {
    const plan = buildImportPlan({
      roots: FIREFOX_EXPORT,
      mode: 'new-folder',
      dedupe: false,
      browserIndex: new Set(),
      destinations,
      newFolderTitle: 'Imported',
    });
    expect(plan.segments.map((s) => s.parentId)).toEqual(['unfiled_____']);
  });
});

describe('BM JSON — root "menu"', () => {
  it('round-trips the marker (additive; the version stays 1)', () => {
    const text = serializeBmJson(FIREFOX_EXPORT, {
      version: '1.3.0',
      exportedAt: '2026-11-18T00:00:00Z',
    });
    expect(JSON.parse(text).version).toBe(1);
    const { roots } = parseBmJson(text);
    expect(roots[0]?.root).toBe('menu');
    expect(roots[0]?.children?.map((n) => n.title)).toEqual(['m1', 'm2']);
  });
});

describe('Netscape HTML — the menu is written loose, as Firefox writes it', () => {
  it('unwraps a top-level menu folder and keeps the marked roots', () => {
    const html = serializeNetscapeHtml(FIREFOX_EXPORT);
    expect(html).not.toContain('Bookmarks Menu');
    const { roots } = parseNetscapeHtml(html);
    // The menu's entries come back loose, first, and route into the menu on
    // Firefox (above) — the file round-trips there.
    expect(titles(roots).slice(0, 2)).toEqual(['m1', 'm2']);
    expect(roots[2]?.toolbar).toBe(true);
    expect(roots[3]?.root).toBe('other');
    expect(roots[4]?.root).toBe('mobile');
  });

  it('leaves a deeper folder called "menu" alone: markers count at the top only', () => {
    const nested: BookmarkNode[] = [
      { title: 'Folder', children: [{ title: 'Inner', root: 'menu', children: [link('x')] }] },
    ];
    expect(parseNetscapeHtml(serializeNetscapeHtml(nested)).roots[0]?.children?.[0]?.title).toBe(
      'Inner',
    );
  });
});

describe('separators a file holds are counted (docs/04 §1.2, §2b)', () => {
  it('counts <HR> in HTML', () => {
    const html =
      '<!DOCTYPE NETSCAPE-Bookmark-file-1><DL><p><DT><A HREF="https://a.example/">a</A><HR><HR>' +
      '<DT><A HREF="https://b.example/">b</A></DL><p>';
    expect(parseNetscapeHtml(html).warnings).toEqual([{ code: 'SEPARATORS_SKIPPED', count: 2 }]);
  });

  it('counts separator entries in a Firefox JSON backup', () => {
    const doc = {
      guid: 'root________',
      title: '',
      type: 'text/x-moz-place-container',
      root: 'placesRoot',
      children: [
        {
          guid: 'menu________',
          title: 'menu',
          type: 'text/x-moz-place-container',
          root: 'bookmarksMenuFolder',
          children: [
            { title: 'a', type: 'text/x-moz-place', uri: 'https://a.example/' },
            { type: 'text/x-moz-place-separator' },
            { title: 'b', type: 'text/x-moz-place', uri: 'https://b.example/' },
          ],
        },
      ],
    };
    const result = readFirefoxJson(doc);
    expect(titles(result.roots)).toEqual(['a', 'b']);
    expect(result.warnings).toContainEqual({ code: 'SEPARATORS_SKIPPED', count: 1 });
  });
});

describe('capUrlLength — what Firefox refuses for its length (docs/04 §1.2)', () => {
  const long = `https://long.example/${'x'.repeat(65_536)}`;
  const parsed = (roots: BookmarkNode[]): ParseResult => ({
    roots,
    stats: computeStats(roots),
    warnings: [],
  });

  it('drops addresses over the limit, at any depth, and says how many', () => {
    const result = capUrlLength(
      parsed([
        link('ok'),
        { title: 'long', url: long },
        { title: 'F', children: [{ title: 'deep', url: long }, link('kept')] },
      ]),
      65_536,
    );
    expect(result.roots.map((n) => n.title)).toEqual(['ok', 'F']);
    expect(result.roots[1]?.children?.map((n) => n.title)).toEqual(['kept']);
    expect(result.stats.bookmarks).toBe(2);
    expect(result.warnings).toEqual([{ code: 'URL_TOO_LONG', count: 2 }]);
  });

  it('changes nothing without a limit (Chromium) or when nothing is too long', () => {
    const input = parsed([{ title: 'long', url: long }]);
    expect(capUrlLength(input, undefined)).toBe(input);
    const short = parsed([link('a')]);
    expect(capUrlLength(short, 65_536)).toBe(short);
  });
});
