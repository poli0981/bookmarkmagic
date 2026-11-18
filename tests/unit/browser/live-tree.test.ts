import { describe, expect, it } from 'vitest';
import {
  countLive,
  isSeparator,
  type LiveNode,
  moveIndexFor,
  toBookmarkNodes,
  withoutSeparators,
} from '@/lib/browser/live-tree';

/**
 * The pure half of the bookmarks adapter — docs/02 §4. Firefox's separators
 * come with `url: "data:"`, so every "has a url, so it is a bookmark" test
 * would count, export and dedupe them as bookmarks; these pin the one
 * recognition rule (`type`) and everything built on it.
 */

const separator = (id: string): LiveNode => ({ id, title: '', type: 'separator', url: 'data:' });
const bookmark = (id: string, url = `https://${id}.example/`): LiveNode => ({
  id,
  title: id,
  url,
  type: 'bookmark',
});

const FIREFOX_TREE: LiveNode[] = [
  {
    id: 'menu________',
    title: 'Bookmarks Menu',
    type: 'folder',
    children: [bookmark('a'), separator('s1'), bookmark('b')],
  },
  {
    id: 'toolbar_____',
    title: 'Bookmarks Toolbar',
    type: 'folder',
    children: [
      { id: 'f', title: 'Dev', type: 'folder', children: [separator('s2'), bookmark('c')] },
    ],
  },
];

describe('isSeparator', () => {
  it('goes by type, never by url', () => {
    expect(isSeparator(separator('x'))).toBe(true);
    // A real bookmark to a data: address is still a bookmark.
    expect(isSeparator(bookmark('d', 'data:text/plain,hi'))).toBe(false);
    expect(isSeparator({ id: 'chrome', title: 'no type at all' } as LiveNode)).toBe(false);
  });
});

describe('withoutSeparators', () => {
  it('removes separators at every depth and keeps everything else in order', () => {
    const out = withoutSeparators(FIREFOX_TREE);
    expect(out[0]?.children?.map((n) => n.id)).toEqual(['a', 'b']);
    expect(out[1]?.children?.[0]?.children?.map((n) => n.id)).toEqual(['c']);
  });

  it('returns untouched leaves as they are', () => {
    const leaf = bookmark('z');
    expect(withoutSeparators([leaf])[0]).toBe(leaf);
  });
});

describe('countLive', () => {
  it('counts separators apart from bookmarks and folders', () => {
    expect(countLive(FIREFOX_TREE)).toEqual({ bookmarks: 3, folders: 3, separators: 2 });
  });

  it('is all zero on an empty forest', () => {
    expect(countLive([])).toEqual({ bookmarks: 0, folders: 0, separators: 0 });
  });
});

describe('toBookmarkNodes', () => {
  it('leaves separators out — no format BookmarkMagic writes can hold one', () => {
    const nodes = toBookmarkNodes(FIREFOX_TREE);
    expect(JSON.stringify(nodes)).not.toContain('data:');
    expect(nodes[0]?.children?.map((n) => n.url)).toEqual([
      'https://a.example/',
      'https://b.example/',
    ]);
  });

  it('marks the Bookmarks Menu as root "menu" (docs/04 §2)', () => {
    const [menu, toolbar] = toBookmarkNodes(FIREFOX_TREE, {
      toolbarId: 'toolbar_____',
      menuId: 'menu________',
    });
    expect(menu?.root).toBe('menu');
    expect(toolbar?.toolbar).toBe(true);
  });
});

describe('moveIndexFor — each browser its own rule (docs/05 §10)', () => {
  // Moving `a` after `c` in [a, b, c]: before removal 3, after removal 2.
  const position = { api: 3, local: 2 };

  it('sends Chromium the index counted before the node is removed', () => {
    expect(moveIndexFor(position, 'chromium')).toBe(3);
  });

  it('sends Firefox the final position', () => {
    expect(moveIndexFor(position, 'firefox')).toBe(2);
  });
});
