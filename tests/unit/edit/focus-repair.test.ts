import { describe, expect, it } from 'vitest';
import { nearestShownAncestor, parentIndex } from '@/lib/edit/focus-repair';
import type { EditNode } from '@/lib/edit/patch-tree';

const TREE: EditNode[] = [
  {
    id: '1',
    title: 'Bar',
    children: [
      {
        id: 'dev',
        title: 'Dev',
        children: [
          {
            id: 'ref',
            title: 'Reference',
            children: [{ id: 'spec', title: 'Spec', url: 'https://s/' }],
          },
        ],
      },
    ],
  },
  { id: '2', title: 'Other', children: [] },
];

describe('parentIndex', () => {
  it('maps every node to its parent and the roots to undefined', () => {
    const parents = parentIndex(TREE);
    expect(parents.get('spec')).toBe('ref');
    expect(parents.get('ref')).toBe('dev');
    expect(parents.get('dev')).toBe('1');
    expect(parents.has('1')).toBe(true);
    expect(parents.get('1')).toBeUndefined();
    expect(parents.size).toBe(5);
  });

  it('walks a tree deeper than any call stack', () => {
    let node: EditNode = { id: 'leaf', title: 'leaf', url: 'https://x/' };
    for (let i = 0; i < 20_000; i++) node = { id: `f${i}`, title: 'f', children: [node] };
    expect(parentIndex([node]).get('leaf')).toBe('f0');
  });
});

describe('nearestShownAncestor', () => {
  const parents = parentIndex(TREE);

  it('climbs to the closest folder that is on screen', () => {
    expect(nearestShownAncestor('spec', parents, new Set(['1', 'dev']))).toBe('dev');
    expect(nearestShownAncestor('spec', parents, new Set(['1']))).toBe('1');
  });

  it('gives up when nothing above is shown, and never returns the node itself', () => {
    expect(nearestShownAncestor('spec', parents, new Set(['spec']))).toBeUndefined();
    expect(nearestShownAncestor('1', parents, new Set(['1']))).toBeUndefined();
    expect(nearestShownAncestor('unknown', parents, new Set(['1']))).toBeUndefined();
  });

  it('cannot loop on a corrupt index', () => {
    const cycle = new Map<string, string | undefined>([
      ['a', 'b'],
      ['b', 'a'],
    ]);
    expect(nearestShownAncestor('a', cycle, new Set())).toBeUndefined();
  });
});
