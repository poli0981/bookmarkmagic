import { describe, expect, it } from 'vitest';
import { buildUrlIndex, dedupeAgainst, findDuplicateGroups } from '@/lib/core/dedupe';
import { diffAgainstBrowser, type NodeStatus } from '@/lib/core/diff';
import type { BookmarkNode } from '@/lib/core/model';

const BROWSER: BookmarkNode[] = [
  {
    title: 'Bar',
    children: [{ title: 'Example', url: 'https://example.com/' }],
  },
];

const FILE: BookmarkNode[] = [
  {
    title: 'Imported',
    children: [
      { title: 'Example again', url: 'https://EXAMPLE.com' }, // same link, different case + slash
      { title: 'New one', url: 'https://new.example/' },
      { title: 'New one dup', url: 'https://new.example/' }, // in-file repeat
    ],
  },
  { title: 'Empty after dedupe', children: [{ title: 'x', url: 'https://example.com/' }] },
];

describe('buildUrlIndex', () => {
  it('indexes every bookmark URL by normalized key', () => {
    const index = buildUrlIndex(BROWSER);
    expect(index.has('https://example.com')).toBe(true);
    expect(index.size).toBe(1);
  });
});

describe('dedupeAgainst', () => {
  const result = dedupeAgainst(FILE, buildUrlIndex(BROWSER));

  it('counts browser duplicates and in-file repeats separately (docs/05 §3)', () => {
    expect(result.skippedExisting).toBe(2); // "Example again" + the one in the 2nd folder
    expect(result.skippedInFile).toBe(1);
  });

  it('keeps only the first occurrence of an in-file repeat', () => {
    expect(result.nodes[0]?.children).toEqual([{ title: 'New one', url: 'https://new.example/' }]);
  });

  it('preserves folders that became empty', () => {
    expect(result.nodes[1]).toEqual({ title: 'Empty after dedupe', children: [] });
  });

  it('does not mutate the input tree', () => {
    expect(FILE[0]?.children).toHaveLength(3);
  });

  it('skips nothing against an empty index — the Replace-mode guard', () => {
    // Replace deletes the browser tree first, so the plan is built against an
    // empty index. A user re-importing their own backup must lose nothing.
    const replace = dedupeAgainst(BROWSER, new Set<string>());
    expect(replace.skippedExisting).toBe(0);
    expect(replace.nodes).toEqual(BROWSER);
  });
});

describe('diffAgainstBrowser', () => {
  it('counts every occurrence, so 3 copies of one URL count 3 times', () => {
    const tree: BookmarkNode[] = [
      { title: 'a', url: 'https://example.com/' },
      { title: 'b', url: 'https://example.com/' },
      { title: 'c', url: 'https://fresh.example/' },
    ];
    const { newCount, existsCount, status } = diffAgainstBrowser(tree, buildUrlIndex(BROWSER));
    expect(existsCount).toBe(2);
    expect(newCount).toBe(1);
    const first: NodeStatus | undefined = status.get(tree[0] as BookmarkNode);
    expect(first).toBe('exists');
    expect(status.get(tree[2] as BookmarkNode)).toBe('new');
  });

  it('does not badge folders', () => {
    const tree: BookmarkNode[] = [{ title: 'folder', children: [] }];
    const { status } = diffAgainstBrowser(tree, new Set<string>());
    expect(status.has(tree[0] as BookmarkNode)).toBe(false);
  });
});

describe('findDuplicateGroups', () => {
  it('groups by normalized URL, largest group first, and carries ids', () => {
    const live = [
      { id: '1', url: 'https://a.example/' },
      { id: '2', url: 'https://A.example' },
      { id: '3', url: 'https://a.example/' },
      { id: '4', url: 'https://b.example/' },
      { id: '5', url: 'https://b.example/' },
      { id: '6', title: 'folder' } as { id: string; url?: string },
    ];
    const groups = findDuplicateGroups(live);
    expect(groups).toHaveLength(2);
    expect(groups[0]?.nodes.map((n) => n.id)).toEqual(['1', '2', '3']);
    expect(groups[1]?.nodes.map((n) => n.id)).toEqual(['4', '5']);
  });

  it('returns nothing when every URL is unique', () => {
    expect(findDuplicateGroups([{ url: 'https://a.example/' }])).toEqual([]);
  });
});
