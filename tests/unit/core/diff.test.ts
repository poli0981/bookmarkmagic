import { describe, expect, it } from 'vitest';
import { buildFolderPathIndex } from '@/lib/core/diff';
import type { BookmarkNode } from '@/lib/core/model';

const TREE: BookmarkNode[] = [
  {
    title: 'Bookmarks bar',
    children: [
      { title: 'Dev', children: [{ title: 'Deep', children: [] }] },
      { title: 'Link', url: 'https://a.example/' },
    ],
  },
  { title: 'Other', children: [] },
];

describe('buildFolderPathIndex — merge-mode folder matching (docs/05 §5)', () => {
  const index = buildFolderPathIndex(TREE);

  it('keys folders by their full ancestor-title path', () => {
    expect([...index.keys()].sort()).toEqual(
      [
        JSON.stringify(['Bookmarks bar']),
        JSON.stringify(['Bookmarks bar', 'Dev']),
        JSON.stringify(['Bookmarks bar', 'Dev', 'Deep']),
        JSON.stringify(['Other']),
      ].sort(),
    );
  });

  it('indexes folders only, never bookmarks', () => {
    expect(index.has(JSON.stringify(['Bookmarks bar', 'Link']))).toBe(false);
  });

  it('matches are exact and case-sensitive', () => {
    expect(index.has(JSON.stringify(['bookmarks bar']))).toBe(false);
  });

  it('keeps the first of two identically-named siblings', () => {
    const first: BookmarkNode = { title: 'Dup', children: [{ title: 'a', url: 'https://a/' }] };
    const second: BookmarkNode = { title: 'Dup', children: [] };
    const dupIndex = buildFolderPathIndex([first, second]);
    expect(dupIndex.get(JSON.stringify(['Dup']))).toBe(first);
  });

  it('distinguishes same-named folders at different paths', () => {
    const tree: BookmarkNode[] = [
      { title: 'A', children: [{ title: 'Shared', children: [] }] },
      { title: 'B', children: [{ title: 'Shared', children: [] }] },
    ];
    const paths = buildFolderPathIndex(tree);
    expect(paths.has(JSON.stringify(['A', 'Shared']))).toBe(true);
    expect(paths.has(JSON.stringify(['B', 'Shared']))).toBe(true);
  });
});
