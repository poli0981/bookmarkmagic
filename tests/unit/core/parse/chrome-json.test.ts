import { describe, expect, it } from 'vitest';
import { MAX_DEPTH, MAX_NODES } from '@/lib/core/limits';
import { readChromeBookmarks } from '@/lib/core/parse/chrome-json';
import { expectBmError } from '../../../helpers/errors';

/** Chrome's profile `Bookmarks` file — docs/04 §2a. */
const url = (name: string, href: string, extra: Record<string, unknown> = {}) => ({
  type: 'url',
  name,
  url: href,
  ...extra,
});
const folder = (name: string, children: unknown[], extra: Record<string, unknown> = {}) => ({
  type: 'folder',
  name,
  children,
  ...extra,
});
const profile = (roots: Record<string, unknown>) => ({ checksum: 'x', roots, version: 1 });

describe('readChromeBookmarks — roots', () => {
  it('always emits the bar, and Other and Mobile only when they hold something', () => {
    const empty = readChromeBookmarks(
      profile({
        bookmark_bar: folder('Bookmarks bar', []),
        other: folder('Other bookmarks', []),
        synced: folder('Mobile bookmarks', []),
      }),
    );
    expect(empty.roots).toEqual([{ title: 'Bookmarks bar', toolbar: true, children: [] }]);
    expect(empty.warnings).toEqual([]);
  });

  it('skips vendor roots and counts the bookmarks in them — but not old sync strings', () => {
    const { roots, warnings } = readChromeBookmarks(
      profile({
        bookmark_bar: folder('Bar', [url('kept', 'https://kept.example/')]),
        custom_root: folder('Opera', [
          folder('Speed Dial', [url('a', 'https://a.example/'), url('b', 'https://b.example/')]),
          folder('Trash', [url('c', 'https://c.example/')]),
        ]),
        sync_transaction_version: '297',
      }),
    );
    expect(roots).toHaveLength(1);
    expect(warnings).toEqual([{ code: 'EXTRA_ROOTS_SKIPPED', count: 3 }]);
  });

  it('falls back to the localized title only when the file has none', () => {
    const { roots } = readChromeBookmarks(
      profile({
        bookmark_bar: folder('', []),
        other: folder('Andere Lesezeichen', [url('x', 'https://x.example/')]),
      }),
      { rootTitles: { toolbar: 'Thanh dấu trang', other: 'Dấu trang khác' } },
    );
    expect(roots.map((r) => r.title)).toEqual(['Thanh dấu trang', 'Andere Lesezeichen']);
  });

  it('refuses a document with none of the three roots', () => {
    expectBmError(() => readChromeBookmarks({ roots: { custom_root: {} } }), 'NOT_BM_JSON');
  });
});

describe('readChromeBookmarks — entries', () => {
  const read = (children: unknown[]) =>
    readChromeBookmarks(profile({ bookmark_bar: folder('Bar', children) }));

  it('reads urls and folders, and ignores ids, guids and metadata', () => {
    const { roots } = read([
      url('Docs', 'https://docs.example/', {
        id: '9',
        guid: 'g',
        meta_info: { Nickname: 'n' },
        date_added: '13344473600000000',
        date_last_used: '13344473700000000',
      }),
      folder('Sub', [url('in', 'https://in.example/')], {
        date_added: '13344473600000000',
        date_modified: '13395973600000000',
      }),
    ]);
    expect(roots[0]?.children).toEqual([
      { title: 'Docs', url: 'https://docs.example/', addDate: 1700000000 },
      {
        title: 'Sub',
        addDate: 1700000000,
        lastModified: 1751500000,
        children: [{ title: 'in', url: 'https://in.example/' }],
      },
    ]);
  });

  it('skips what Chrome itself could not store, and counts each kind', () => {
    const { roots, warnings } = read([
      url('blank', ''),
      { type: 'url', name: 'no url at all' },
      url('broken', 'http://exa mple.com/'),
      url('smart', 'place:sort=8'),
      { type: 'separator', name: 'unknown type' },
      'not even an object',
      url('ok', 'https://ok.example/'),
    ]);
    expect(roots[0]?.children?.map((n) => n.title)).toEqual(['ok']);
    expect(warnings).toEqual(
      expect.arrayContaining([
        { code: 'MISSING_URL', count: 2 },
        { code: 'INVALID_URL', count: 1 },
        { code: 'PLACE_QUERIES_SKIPPED', count: 1 },
        { code: 'UNREADABLE_ENTRIES', count: 2 },
      ]),
    );
  });

  it('keeps an empty title and flags dates it cannot trust', () => {
    const { roots, warnings } = read([
      url('', 'https://untitled.example/', { date_added: 'yesterday' }),
    ]);
    expect(roots[0]?.children?.[0]).toEqual({ title: '', url: 'https://untitled.example/' });
    expect(warnings).toEqual(
      expect.arrayContaining([
        { code: 'EMPTY_TITLE', count: 1 },
        { code: 'INVALID_DATE', count: 1 },
      ]),
    );
  });
});

describe('readChromeBookmarks — caps', () => {
  it('enforces the depth cap', () => {
    let node: unknown = url('leaf', 'https://leaf.example/');
    for (let i = 0; i < MAX_DEPTH; i++) node = folder(`d${i}`, [node]);
    expectBmError(
      () => readChromeBookmarks(profile({ bookmark_bar: folder('Bar', [node]) })),
      'TOO_DEEP',
    );
  });

  it('enforces the node cap', () => {
    const many = Array.from({ length: MAX_NODES }, (_, i) => url(`${i}`, 'https://e.example/'));
    expectBmError(
      () => readChromeBookmarks(profile({ bookmark_bar: folder('Bar', many) })),
      'TOO_MANY_NODES',
    );
  });
});
