import { describe, expect, it } from 'vitest';
import { canMoveInto, moveTargets, planDrop } from '@/lib/edit/move-target';
import { type EditNode, findNode } from '@/lib/edit/patch-tree';

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
        children: [
          { id: 'gh', parentId: 'dev', title: 'GitHub', url: 'https://github.com/' },
          { id: 'deep', parentId: 'dev', title: 'Deep', children: [] },
        ],
      },
    ],
  },
  { id: 'other', title: 'Other', children: [] },
  { id: 'managed', title: 'Managed bookmarks', unmodifiable: 'managed', children: [] },
];

const node = (id: string): EditNode => {
  const found = findNode(TREE, id);
  if (found === undefined) throw new Error(`no node ${id}`);
  return found;
};

describe('moveTargets', () => {
  it('offers folders only, never bookmarks', () => {
    expect(moveTargets(TREE, node('apple')).map((t) => t.id)).not.toContain('gh');
  });

  it('shows the full path so same-named folders are distinguishable', () => {
    expect(moveTargets(TREE, node('apple')).map((t) => t.label)).toContain('Bookmarks bar / Dev');
  });

  it('excludes the current parent — moving there is a no-op', () => {
    expect(moveTargets(TREE, node('apple')).map((t) => t.id)).not.toContain('bar');
  });

  it('excludes the node itself and its descendants', () => {
    const ids = moveTargets(TREE, node('dev')).map((t) => t.id);
    expect(ids).not.toContain('dev');
    expect(ids).not.toContain('deep');
    expect(ids).toContain('other');
  });

  it('excludes policy-managed folders', () => {
    expect(moveTargets(TREE, node('apple')).map((t) => t.id)).not.toContain('managed');
  });

  it('offers every folder when nothing is being moved', () => {
    expect(
      moveTargets(TREE, undefined)
        .map((t) => t.id)
        .sort(),
    ).toEqual(['bar', 'deep', 'dev', 'other']);
  });
});

describe('canMoveInto', () => {
  it('allows a move into an unrelated folder', () => {
    expect(canMoveInto(TREE, 'apple', 'other')).toBe(true);
  });

  it('refuses a drop onto a bookmark', () => {
    expect(canMoveInto(TREE, 'apple', 'gh')).toBe(false);
  });

  it('refuses a folder into itself or its own descendant', () => {
    expect(canMoveInto(TREE, 'dev', 'dev')).toBe(false);
    expect(canMoveInto(TREE, 'dev', 'deep')).toBe(false);
  });

  it('refuses a managed destination', () => {
    expect(canMoveInto(TREE, 'apple', 'managed')).toBe(false);
  });

  it('refuses unknown ids', () => {
    expect(canMoveInto(TREE, 'ghost', 'other')).toBe(false);
    expect(canMoveInto(TREE, 'apple', 'ghost')).toBe(false);
  });

  it('agrees with moveTargets about what is legal', () => {
    // The DnD path and the keyboard path must not drift apart.
    const legal = new Set(moveTargets(TREE, node('dev')).map((t) => t.id));
    for (const candidate of ['bar', 'dev', 'deep', 'other', 'managed', 'gh']) {
      if (candidate === 'bar') continue; // excluded as current parent, not as illegal
      expect(canMoveInto(TREE, 'dev', candidate)).toBe(legal.has(candidate));
    }
  });
});

describe('planDrop — reordering by drag (v1.1.0)', () => {
  // Bar: [a, b, c, F]; Other: [z]. ids as titles; parentIds as Chrome reports them.
  const TREE: EditNode[] = [
    {
      id: '1',
      parentId: '0',
      title: 'Bar',
      children: [
        { id: 'a', parentId: '1', title: 'a', url: 'https://a/' },
        { id: 'b', parentId: '1', title: 'b', url: 'https://b/' },
        { id: 'c', parentId: '1', title: 'c', url: 'https://c/' },
        { id: 'F', parentId: '1', title: 'F', children: [] },
      ],
    },
    {
      id: '2',
      parentId: '0',
      title: 'Other',
      children: [{ id: 'z', parentId: '2', title: 'z', url: 'https://z/' }],
    },
  ];

  it('counts a move to the right the way chrome.bookmarks.move does, and the result the way onMoved does', () => {
    // a → after c: Chrome wants index 3 (pre-removal); the node ends at 2.
    expect(planDrop(TREE, 'a', 'c', 'after')).toEqual({
      parentId: '1',
      position: { api: 3, local: 2 },
    });
    // c → before a: both 0.
    expect(planDrop(TREE, 'c', 'a', 'before')).toEqual({
      parentId: '1',
      position: { api: 0, local: 0 },
    });
  });

  it('moves across folders with one index', () => {
    expect(planDrop(TREE, 'z', 'b', 'after')).toEqual({
      parentId: '1',
      position: { api: 2, local: 2 },
    });
  });

  it('appends a drop into a folder, and refuses one into a bookmark', () => {
    expect(planDrop(TREE, 'a', 'F', 'into')).toEqual({ parentId: 'F' });
    expect(planDrop(TREE, 'a', 'b', 'into')).toBeUndefined();
  });

  it('treats dropping a node right beside itself as no move', () => {
    expect(planDrop(TREE, 'b', 'a', 'after')).toBeUndefined();
    expect(planDrop(TREE, 'b', 'c', 'before')).toBeUndefined();
  });

  it('never places anything beside a permanent root', () => {
    expect(planDrop(TREE, 'a', '2', 'before')).toBeUndefined();
  });
});
