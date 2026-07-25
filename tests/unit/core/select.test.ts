import { describe, expect, it } from 'vitest';
import {
  checkStateOf,
  filterBySelection,
  pathTo,
  subtreeIds,
  type TreeLike,
  toggleSelection,
} from '@/lib/core/select';

interface Node extends TreeLike {
  id: string;
  title: string;
  url?: string;
  children?: Node[];
}

const TREE: Node[] = [
  {
    id: 'bar',
    title: 'Bookmarks bar',
    children: [
      { id: 'a', title: 'a', url: 'https://a.example/' },
      {
        id: 'dev',
        title: 'Dev',
        children: [
          { id: 'gh', title: 'GitHub', url: 'https://github.com/' },
          { id: 'mdn', title: 'MDN', url: 'https://mdn.example/' },
        ],
      },
    ],
  },
  { id: 'other', title: 'Other', children: [{ id: 'z', title: 'z', url: 'https://z.example/' }] },
];

const byId = (id: string): Node => {
  const found = pathTo(TREE, id).at(-1);
  if (found === undefined) throw new Error(`no node ${id}`);
  return found as Node;
};

describe('subtreeIds / pathTo', () => {
  it('collects a node and everything under it', () => {
    expect([...subtreeIds(byId('dev'))].sort()).toEqual(['dev', 'gh', 'mdn']);
  });

  it('returns the full ancestor path, inclusive', () => {
    expect(pathTo(TREE, 'gh').map((n) => n.id)).toEqual(['bar', 'dev', 'gh']);
  });

  it('returns nothing for an unknown id', () => {
    expect(pathTo(TREE, 'nope')).toEqual([]);
  });
});

describe('checkStateOf', () => {
  it('reports a directly selected node as checked', () => {
    expect(checkStateOf(TREE, byId('dev'), new Set(['dev']))).toBe('checked');
  });

  it('reports a node covered by a selected ancestor as checked', () => {
    expect(checkStateOf(TREE, byId('gh'), new Set(['bar']))).toBe('checked');
  });

  it('reports a partially covered folder as indeterminate', () => {
    expect(checkStateOf(TREE, byId('bar'), new Set(['gh']))).toBe('indeterminate');
  });

  it('reports an untouched folder as unchecked', () => {
    expect(checkStateOf(TREE, byId('other'), new Set(['gh']))).toBe('unchecked');
  });
});

describe('toggleSelection — checking', () => {
  it('stores one covering id and drops redundant descendants', () => {
    const selection = toggleSelection(TREE, byId('bar'), true, new Set(['gh', 'mdn']));
    expect([...selection]).toEqual(['bar']);
  });

  it('collapses a fully selected set of siblings into the parent', () => {
    let selection = toggleSelection(TREE, byId('gh'), true, new Set());
    selection = toggleSelection(TREE, byId('mdn'), true, selection);
    // Both children of Dev are now selected, so Dev itself is the right key.
    expect(selection.has('dev')).toBe(true);
    expect(selection.has('gh')).toBe(false);
  });
});

describe('toggleSelection — unchecking', () => {
  it('removes a directly selected node', () => {
    expect([...toggleSelection(TREE, byId('dev'), false, new Set(['dev']))]).toEqual([]);
  });

  it('splits a selected ancestor so the rest of it stays selected', () => {
    // Ticking "Bookmarks bar" then unticking "Dev" must keep "a" selected.
    // Without the expansion the untick would silently do nothing.
    const selection = toggleSelection(TREE, byId('dev'), false, new Set(['bar']));
    expect([...selection].sort()).toEqual(['a']);
    expect(checkStateOf(TREE, byId('a'), selection)).toBe('checked');
    expect(checkStateOf(TREE, byId('gh'), selection)).toBe('unchecked');
    expect(checkStateOf(TREE, byId('bar'), selection)).toBe('indeterminate');
  });

  it('splits across two levels', () => {
    const selection = toggleSelection(TREE, byId('gh'), false, new Set(['bar']));
    expect([...selection].sort()).toEqual(['a', 'mdn']);
    expect(checkStateOf(TREE, byId('mdn'), selection)).toBe('checked');
    expect(checkStateOf(TREE, byId('gh'), selection)).toBe('unchecked');
  });
});

describe('filterBySelection', () => {
  it('brings the whole subtree of a selected folder', () => {
    expect(filterBySelection(TREE, new Set(['dev']))).toEqual([
      { id: 'bar', title: 'Bookmarks bar', children: [byId('dev')] },
    ]);
  });

  it('keeps unselected ancestors only as a path to a selection', () => {
    const filtered = filterBySelection(TREE, new Set(['gh']));
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.id).toBe('bar');
    expect(filtered[0]?.children?.[0]?.id).toBe('dev');
    expect(filtered[0]?.children?.[0]?.children).toEqual([byId('gh')]);
  });

  it('drops branches with nothing selected', () => {
    expect(filterBySelection(TREE, new Set(['z']))?.map((n) => n.id)).toEqual(['other']);
  });

  it('returns nothing for an empty selection', () => {
    expect(filterBySelection(TREE, new Set())).toEqual([]);
  });

  it('does not mutate the source tree', () => {
    filterBySelection(TREE, new Set(['gh']));
    expect(byId('dev').children).toHaveLength(2);
  });
});
