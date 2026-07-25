import { describe, expect, it } from 'vitest';
import type { EditNode } from '@/lib/edit/patch-tree';
import { resolveKey, visibleRows } from '@/lib/edit/tree-keyboard';

const TREE: EditNode[] = [
  {
    id: 'bar',
    title: 'Bookmarks bar',
    children: [
      { id: 'apple', parentId: 'bar', title: 'Apple', url: 'https://apple.example/' },
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

const rowsWith = (...open: string[]) => visibleRows(TREE, new Set(open));

describe('visibleRows', () => {
  it('lists only what is on screen, in visual order', () => {
    expect(rowsWith().map((r) => r.node.id)).toEqual(['bar', 'other']);
    expect(rowsWith('bar').map((r) => r.node.id)).toEqual(['bar', 'apple', 'dev', 'other']);
    expect(rowsWith('bar', 'dev').map((r) => r.node.id)).toEqual([
      'bar',
      'apple',
      'dev',
      'gh',
      'other',
    ]);
  });

  it('reports depth, parent and expandability', () => {
    const [bar, apple, dev] = rowsWith('bar');
    expect(bar).toMatchObject({ depth: 1, parentId: undefined, expandable: true, expanded: true });
    expect(apple).toMatchObject({ depth: 2, parentId: 'bar', expandable: false });
    expect(dev).toMatchObject({ depth: 2, parentId: 'bar', expandable: true, expanded: false });
  });

  it('treats an empty folder as not expandable', () => {
    expect(rowsWith().find((r) => r.node.id === 'other')?.expandable).toBe(false);
  });

  it('honours a search visibility filter', () => {
    const rows = visibleRows(TREE, new Set(['bar', 'dev']), new Set(['bar', 'dev', 'gh']));
    expect(rows.map((r) => r.node.id)).toEqual(['bar', 'dev', 'gh']);
  });
});

describe('resolveKey — movement', () => {
  const rows = rowsWith('bar');

  it('moves down and up', () => {
    expect(resolveKey('ArrowDown', 'bar', rows)).toEqual({ kind: 'focus', id: 'apple' });
    expect(resolveKey('ArrowUp', 'apple', rows)).toEqual({ kind: 'focus', id: 'bar' });
  });

  it('clamps at both ends rather than wrapping', () => {
    expect(resolveKey('ArrowUp', 'bar', rows)).toEqual({ kind: 'focus', id: 'bar' });
    expect(resolveKey('ArrowDown', 'other', rows)).toEqual({ kind: 'focus', id: 'other' });
  });

  it('jumps to first and last with Home/End', () => {
    expect(resolveKey('Home', 'dev', rows)).toEqual({ kind: 'focus', id: 'bar' });
    expect(resolveKey('End', 'bar', rows)).toEqual({ kind: 'focus', id: 'other' });
  });
});

describe('resolveKey — the WAI-ARIA expand/collapse pattern', () => {
  it('right opens a closed folder, then steps into it', () => {
    expect(resolveKey('ArrowRight', 'dev', rowsWith('bar'))).toEqual({ kind: 'expand', id: 'dev' });
    expect(resolveKey('ArrowRight', 'dev', rowsWith('bar', 'dev'))).toEqual({
      kind: 'focus',
      id: 'gh',
    });
  });

  it('left closes an open folder, then steps out to the parent', () => {
    expect(resolveKey('ArrowLeft', 'dev', rowsWith('bar', 'dev'))).toEqual({
      kind: 'collapse',
      id: 'dev',
    });
    expect(resolveKey('ArrowLeft', 'dev', rowsWith('bar'))).toEqual({ kind: 'focus', id: 'bar' });
  });

  it('left on a bookmark goes to its parent', () => {
    expect(resolveKey('ArrowLeft', 'apple', rowsWith('bar'))).toEqual({ kind: 'focus', id: 'bar' });
  });

  it('does nothing at the top level with nowhere to go', () => {
    expect(resolveKey('ArrowLeft', 'other', rowsWith())).toEqual({ kind: 'none' });
    expect(resolveKey('ArrowRight', 'other', rowsWith())).toEqual({ kind: 'none' });
  });
});

describe('resolveKey — actions', () => {
  const rows = rowsWith('bar');

  it('maps Enter, F2 and Delete', () => {
    expect(resolveKey('Enter', 'apple', rows)).toEqual({ kind: 'activate', id: 'apple' });
    expect(resolveKey('F2', 'apple', rows)).toEqual({ kind: 'rename', id: 'apple' });
    expect(resolveKey('Delete', 'apple', rows)).toEqual({ kind: 'delete', id: 'apple' });
  });

  it('ignores keys with no binding', () => {
    expect(resolveKey('Escape', 'apple', rows)).toEqual({ kind: 'none' });
  });
});

describe('resolveKey — type-ahead', () => {
  const rows = rowsWith('bar');

  it('jumps to the next row starting with the letter', () => {
    expect(resolveKey('d', 'bar', rows)).toEqual({ kind: 'focus', id: 'dev' });
  });

  it('is case-insensitive', () => {
    expect(resolveKey('A', 'bar', rows)).toEqual({ kind: 'focus', id: 'apple' });
  });

  it('wraps around to find a match above the cursor', () => {
    expect(resolveKey('a', 'other', rows)).toEqual({ kind: 'focus', id: 'apple' });
  });

  it('does nothing when no row matches', () => {
    expect(resolveKey('z', 'bar', rows)).toEqual({ kind: 'none' });
  });
});
