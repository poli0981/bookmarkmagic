import { describe, expect, it } from 'vitest';
import {
  changeNode,
  type EditNode,
  findNode,
  insertNode,
  moveNode,
  removeNode,
} from '@/lib/edit/patch-tree';

const tree = (): EditNode[] => [
  {
    id: 'bar',
    title: 'Bookmarks bar',
    children: [
      { id: 'a', parentId: 'bar', title: 'a', url: 'https://a.example/' },
      {
        id: 'dev',
        parentId: 'bar',
        title: 'Dev',
        children: [{ id: 'gh', parentId: 'dev', title: 'GitHub', url: 'https://github.com/' }],
      },
    ],
  },
  { id: 'other', title: 'Other', children: [] },
];

const ids = (nodes: readonly EditNode[]): string[] => nodes.map((n) => n.id);

describe('insertNode', () => {
  it('appends when no index is given', () => {
    const next = insertNode(tree(), 'other', undefined, {
      id: 'new',
      title: 'n',
      url: 'https://n/',
    });
    expect(ids(findNode(next, 'other')?.children ?? [])).toEqual(['new']);
  });

  it('respects an explicit index', () => {
    const next = insertNode(tree(), 'bar', 0, { id: 'new', title: 'n', url: 'https://n/' });
    expect(ids(findNode(next, 'bar')?.children ?? [])).toEqual(['new', 'a', 'dev']);
  });

  it('clamps an out-of-range index to the end', () => {
    const next = insertNode(tree(), 'bar', 99, { id: 'new', title: 'n', url: 'https://n/' });
    expect(ids(findNode(next, 'bar')?.children ?? [])).toEqual(['a', 'dev', 'new']);
  });

  it('ignores an event for a parent we do not hold', () => {
    const before = tree();
    const next = insertNode(before, 'nonexistent', 0, { id: 'new', title: 'n' });
    expect(next).toEqual(before);
  });

  it('never targets a bookmark as a parent', () => {
    const before = tree();
    expect(insertNode(before, 'a', 0, { id: 'new', title: 'n' })).toEqual(before);
  });

  it('is immutable and shares untouched branches', () => {
    const before = tree();
    const next = insertNode(before, 'other', 0, { id: 'new', title: 'n' });
    expect(before[1]?.children).toEqual([]);
    // The "bar" branch was not touched, so it should be the same object.
    expect(next[0]).toBe(before[0]);
  });
});

describe('removeNode', () => {
  it('removes a leaf', () => {
    const next = removeNode(tree(), 'a');
    expect(ids(findNode(next, 'bar')?.children ?? [])).toEqual(['dev']);
  });

  it('removes a folder together with its subtree', () => {
    const next = removeNode(tree(), 'dev');
    expect(findNode(next, 'gh')).toBeUndefined();
  });

  it('ignores an unknown id — events for already-removed nodes are routine', () => {
    const before = tree();
    expect(removeNode(before, 'ghost')).toEqual(before);
  });

  it('does not mutate the input', () => {
    const before = tree();
    removeNode(before, 'a');
    expect(ids(before[0]?.children ?? [])).toEqual(['a', 'dev']);
  });
});

describe('changeNode', () => {
  it('applies a title change', () => {
    expect(findNode(changeNode(tree(), 'gh', { title: 'Renamed' }), 'gh')?.title).toBe('Renamed');
  });

  it('applies a url change without touching the title', () => {
    const next = changeNode(tree(), 'gh', { url: 'https://new.example/' });
    expect(findNode(next, 'gh')).toMatchObject({ title: 'GitHub', url: 'https://new.example/' });
  });

  it('ignores an unknown id', () => {
    const before = tree();
    expect(changeNode(before, 'ghost', { title: 'x' })).toEqual(before);
  });
});

describe('moveNode', () => {
  it('reparents a node', () => {
    const next = moveNode(tree(), 'gh', 'other', 0);
    expect(ids(findNode(next, 'other')?.children ?? [])).toEqual(['gh']);
    expect(findNode(next, 'dev')?.children).toEqual([]);
  });

  it('updates parentId on the moved node', () => {
    expect(findNode(moveNode(tree(), 'gh', 'other', 0), 'gh')?.parentId).toBe('other');
  });

  it('reorders within the same parent using post-removal indices', () => {
    // onMoved reports the index the node lands at AFTER being lifted out.
    const next = moveNode(tree(), 'a', 'bar', 1);
    expect(ids(findNode(next, 'bar')?.children ?? [])).toEqual(['dev', 'a']);
  });

  it('refuses to move a folder into its own descendant', () => {
    // Allowing it would detach the whole subtree from the tree.
    const before = tree();
    expect(moveNode(before, 'dev', 'gh', 0)).toEqual(before);
    expect(moveNode(before, 'dev', 'dev', 0)).toEqual(before);
  });

  it('ignores an unknown id', () => {
    const before = tree();
    expect(moveNode(before, 'ghost', 'other', 0)).toEqual(before);
  });
});
