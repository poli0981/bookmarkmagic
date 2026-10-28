import { describe, expect, it } from 'vitest';
import { MAX_DEPTH } from '@/lib/core/limits';
import { readFirefoxJson } from '@/lib/core/parse/firefox-json';
import { expectBmError } from '../../../helpers/errors';

/** Firefox's JSON backup — docs/04 §2b. */
const CONTAINER = 'text/x-moz-place-container';
const place = (title: string, uri: string, extra: Record<string, unknown> = {}) => ({
  type: 'text/x-moz-place',
  typeCode: 1,
  title,
  uri,
  ...extra,
});
const container = (title: string, children?: unknown[], extra: Record<string, unknown> = {}) => ({
  type: CONTAINER,
  typeCode: 2,
  title,
  ...(children !== undefined && { children }),
  ...extra,
});
const root = (key: string, title: string, children?: unknown[]) =>
  container(title, children, { root: key });
const places = (children: unknown[]) => container('', children, { root: 'placesRoot' });
const TITLES = {
  toolbar: 'Bookmarks Toolbar',
  other: 'Other Bookmarks',
  mobile: 'Mobile Bookmarks',
};

describe('readFirefoxJson — roots', () => {
  const doc = places([
    root('mobileFolder', 'mobile', [place('phone', 'https://phone.example/')]),
    root('unfiledBookmarksFolder', 'unfiled', [place('loose', 'https://loose.example/')]),
    root('tagsFolder', 'tags', [container('tag', [place('', 'https://menu.example/')])]),
    root('toolbarFolder', 'toolbar', [place('bar', 'https://bar.example/')]),
    root('bookmarksMenuFolder', 'menu', [place('in menu', 'https://menu.example/')]),
  ]);

  it('puts the menu loose at the top, then toolbar, Other and Mobile — whatever the file order', () => {
    const { roots } = readFirefoxJson(doc, { rootTitles: TITLES });
    expect(roots.map((r) => [r.title, r.toolbar, r.root])).toEqual([
      ['in menu', undefined, undefined],
      ['Bookmarks Toolbar', true, undefined],
      ['Other Bookmarks', undefined, 'other'],
      ['Mobile Bookmarks', undefined, 'mobile'],
    ]);
  });

  it('drops the tags root without a warning: it lists bookmarks held elsewhere', () => {
    const { stats, warnings } = readFirefoxJson(doc, { rootTitles: TITLES });
    expect(stats.bookmarks).toBe(4);
    expect(warnings).toEqual([]);
  });

  it('uses the file’s own key when no localized title is passed', () => {
    const { roots } = readFirefoxJson(doc);
    expect(roots[1]?.title).toBe('toolbar');
  });

  it('skips an unknown root and counts its bookmarks', () => {
    const { roots, warnings } = readFirefoxJson(
      places([root('someVendorFolder', 'x', [place('a', 'https://a.example/')])]),
    );
    expect(roots).toEqual([]);
    expect(warnings).toEqual([
      { code: 'EXTRA_ROOTS_SKIPPED', count: 1 },
      { code: 'NO_BOOKMARKS', count: 1 },
    ]);
  });

  it('keeps a toolbar holding only a separator, as Firefox’s HTML export does', () => {
    const { roots } = readFirefoxJson(
      places([root('toolbarFolder', 'toolbar', [{ type: 'text/x-moz-place-separator' }])]),
    );
    expect(roots).toEqual([{ title: 'toolbar', toolbar: true, children: [] }]);
  });

  it('reads a container that is not the places root as a plain list', () => {
    const { roots } = readFirefoxJson(container('Some export', [place('a', 'https://a.example/')]));
    expect(roots).toEqual([{ title: 'a', url: 'https://a.example/' }]);
  });

  it('refuses anything that is not a places container', () => {
    expectBmError(() => readFirefoxJson({ type: 'text/x-moz-place', children: [] }), 'NOT_BM_JSON');
  });
});

describe('readFirefoxJson — entries', () => {
  const read = (children: unknown[]) =>
    readFirefoxJson(places([root('toolbarFolder', 'toolbar', children)])).roots[0]?.children;

  it('converts PRTime microseconds, truncating to the second', () => {
    expect(
      read([
        place('t', 'https://t.example/', {
          dateAdded: 1700000000999999,
          lastModified: 1751500000000000,
        }),
      ]),
    ).toEqual([
      { title: 't', url: 'https://t.example/', addDate: 1700000000, lastModified: 1751500000 },
    ]);
  });

  it('counts favicons under either spelling, and descriptions, as the HTML export would', () => {
    const description = { name: 'bookmarkProperties/description', value: 'd' };
    const { warnings } = readFirefoxJson(
      places([
        root('toolbarFolder', 'toolbar', [
          place('a', 'https://a.example/', { iconUri: 'https://a.example/i.ico' }),
          place('b', 'https://b.example/', {
            iconuri: 'https://b.example/i.ico',
            annos: [description],
          }),
          container('F', [], { annos: [description, { name: 'other/anno', value: 'x' }] }),
        ]),
      ]),
    );
    expect(warnings).toEqual(
      expect.arrayContaining([
        { code: 'FAVICONS_IGNORED', count: 2 },
        { code: 'DESCRIPTIONS_DROPPED', count: 2 },
      ]),
    );
  });

  it('falls back to typeCode when a node has no type string', () => {
    expect(read([{ typeCode: 1, title: 'coded', uri: 'https://c.example/' }])).toEqual([
      { title: 'coded', url: 'https://c.example/' },
    ]);
  });

  it('skips what Chrome could not use, and counts each kind', () => {
    const toolbar = readFirefoxJson(
      places([
        root('toolbarFolder', 'toolbar', [
          place('smart', 'place:sort=8&maxResults=10'),
          place('broken', 'https://exa mple.com/'),
          place('none', ''),
          { type: 'text/x-moz-unknown' },
          place('ok', 'https://ok.example/'),
        ]),
      ]),
    );
    expect(toolbar.roots[0]?.children?.map((n) => n.title)).toEqual(['ok']);
    expect(toolbar.warnings).toEqual(
      expect.arrayContaining([
        { code: 'PLACE_QUERIES_SKIPPED', count: 1 },
        { code: 'INVALID_URL', count: 1 },
        { code: 'MISSING_URL', count: 1 },
        { code: 'UNREADABLE_ENTRIES', count: 1 },
      ]),
    );
  });

  it('enforces the depth cap', () => {
    let node: unknown = place('leaf', 'https://leaf.example/');
    for (let i = 0; i < MAX_DEPTH; i++) node = container(`d${i}`, [node]);
    expectBmError(() => read([node]), 'TOO_DEEP');
  });
});
