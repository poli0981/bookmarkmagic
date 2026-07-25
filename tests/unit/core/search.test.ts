import { describe, expect, it } from 'vitest';
import { type SearchableNode, searchTree } from '@/lib/core/search';

const TREE: SearchableNode[] = [
  {
    id: 'bar',
    title: 'Bookmarks bar',
    children: [
      { id: 'a', title: 'Apple', url: 'https://apple.example/' },
      {
        id: 'dev',
        title: 'Dev tools',
        children: [
          { id: 'gh', title: 'GitHub', url: 'https://github.com/' },
          { id: 'mdn', title: 'MDN', url: 'https://developer.mozilla.example/' },
        ],
      },
    ],
  },
  {
    id: 'other',
    title: 'Other',
    children: [{ id: 'z', title: 'Zebra', url: 'https://z.example/' }],
  },
];

describe('searchTree', () => {
  it('matches on title, case-insensitively', () => {
    expect([...searchTree(TREE, 'github').matched]).toEqual(['gh']);
    expect([...searchTree(TREE, 'GITHUB').matched]).toEqual(['gh']);
  });

  it('matches on URL as well as title', () => {
    expect([...searchTree(TREE, 'mozilla').matched]).toEqual(['mdn']);
  });

  it('keeps ancestors visible so a deep hit has context', () => {
    const { visible } = searchTree(TREE, 'github');
    expect([...visible].sort()).toEqual(['bar', 'dev', 'gh']);
  });

  it('auto-expands the ancestors of a match, but not the match itself', () => {
    const { expand } = searchTree(TREE, 'github');
    expect([...expand].sort()).toEqual(['bar', 'dev']);
  });

  it('shows the whole subtree of a matching FOLDER', () => {
    // Matching "Dev tools" should reveal what is inside it, not just its name.
    const { matched, visible } = searchTree(TREE, 'dev tools');
    expect([...matched]).toEqual(['dev']);
    expect([...visible].sort()).toEqual(['bar', 'dev', 'gh', 'mdn']);
  });

  it('returns empty sets for a blank query — "no filter", not "no results"', () => {
    for (const query of ['', '   ']) {
      const result = searchTree(TREE, query);
      expect(result.matched.size).toBe(0);
      expect(result.visible.size).toBe(0);
    }
  });

  it('distinguishes no results from no filter', () => {
    const result = searchTree(TREE, 'zzz-nothing-matches');
    expect(result.matched.size).toBe(0);
    expect(result.visible.size).toBe(0);
  });

  it('finds several matches across branches', () => {
    const { matched, visible } = searchTree(TREE, 'e');
    expect(matched.has('a')).toBe(true);
    expect(matched.has('z')).toBe(true);
    expect(visible.has('other')).toBe(true);
  });
});

describe('searchTree — the haystack is title + url, not two fields', () => {
  it('matches a query that spans the title/url boundary (docs/05 §8)', () => {
    // "Apple https://apple.example/" is one string; testing the two fields
    // separately would find nothing here.
    expect([...searchTree(TREE, 'apple https').matched]).toEqual(['a']);
  });

  it('still matches within either field alone', () => {
    expect([...searchTree(TREE, 'zebra').matched]).toEqual(['z']);
    expect([...searchTree(TREE, 'z.example').matched]).toEqual(['z']);
  });
});
