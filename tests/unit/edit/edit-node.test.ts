import { describe, expect, it } from 'vitest';
import type { LiveNode } from '@/lib/browser/bookmarks';
import {
  countDescendants,
  extraCopyIds,
  flattenTree,
  isEditable,
  resolveNewFolderParent,
  toEditNode,
} from '@/lib/edit/edit-node';
import type { EditNode } from '@/lib/edit/patch-tree';

const BAR: EditNode = {
  id: '1',
  title: 'Bookmarks bar',
  children: [
    {
      id: '10',
      parentId: '1',
      title: 'Docs',
      children: [{ id: '11', parentId: '10', title: 'A', url: 'https://a.test/' }],
    },
    { id: '12', parentId: '1', title: 'B', url: 'https://b.test/' },
  ],
};
const MANAGED: EditNode = { id: '2', title: 'Managed', unmodifiable: 'managed', children: [] };
const ROOTS: EditNode[] = [BAR, MANAGED];

describe('toEditNode', () => {
  it('omits absent keys rather than setting them undefined', () => {
    // exactOptionalPropertyTypes (docs/10 §2): an explicit undefined is a type
    // error at every construction site, and `'url' in node` must stay reliable.
    const live = { id: '5', title: 'Folder', children: [] } as LiveNode;
    const node = toEditNode(live);
    expect(Object.hasOwn(node, 'url')).toBe(false);
    expect(Object.hasOwn(node, 'parentId')).toBe(false);
    expect(Object.hasOwn(node, 'unmodifiable')).toBe(false);
  });

  it('gives folders children and bookmarks none, which is what folder tests rely on', () => {
    const folder = toEditNode({ id: '5', title: 'F', children: [] } as LiveNode);
    const link = toEditNode({ id: '6', title: 'L', url: 'https://x.test/' } as LiveNode);
    expect(folder.children).toEqual([]);
    expect(Object.hasOwn(link, 'children')).toBe(false);
  });

  it('recurses, preserving order', () => {
    const live = {
      id: '1',
      title: 'root',
      children: [
        { id: '2', parentId: '1', title: 'first', url: 'https://1.test/' },
        { id: '3', parentId: '1', title: 'second', children: [] },
      ],
    } as LiveNode;
    expect(toEditNode(live).children?.map((child) => child.id)).toEqual(['2', '3']);
  });

  it('carries unmodifiable through, since it gates every destructive affordance', () => {
    const live = { id: '2', title: 'Managed', unmodifiable: 'managed', children: [] } as LiveNode;
    expect(toEditNode(live).unmodifiable).toBe('managed');
  });
});

describe('flattenTree', () => {
  it('lists every node depth-first, parents before children', () => {
    expect(flattenTree(ROOTS).map((node) => node.id)).toEqual(['1', '10', '11', '12', '2']);
  });

  it('handles an empty forest', () => {
    expect(flattenTree([])).toEqual([]);
  });
});

describe('isEditable', () => {
  it('refuses the permanent roots', () => {
    expect(isEditable(ROOTS, BAR)).toBe(false);
  });

  it('refuses policy-managed nodes', () => {
    expect(isEditable(ROOTS, MANAGED)).toBe(false);
  });

  it('allows ordinary descendants', () => {
    expect(isEditable(ROOTS, ROOTS[0]?.children?.[0] as EditNode)).toBe(true);
  });
});

describe('resolveNewFolderParent', () => {
  it('nests inside the focused folder', () => {
    expect(resolveNewFolderParent(ROOTS, ROOTS[0]?.children?.[0])).toBe('10');
  });

  it('puts it beside a focused bookmark, not inside it', () => {
    expect(resolveNewFolderParent(ROOTS, ROOTS[0]?.children?.[1])).toBe('1');
  });

  it('falls back to the first WRITABLE root when nothing is focused', () => {
    // Using the focused node's parent unconditionally resolved a selected root
    // to the synthetic root "0", which every create rejects.
    expect(resolveNewFolderParent(ROOTS, undefined)).toBe('1');
    expect(resolveNewFolderParent([MANAGED, BAR], undefined)).toBe('1');
  });

  it('returns undefined when every root is unmodifiable', () => {
    expect(resolveNewFolderParent([MANAGED], undefined)).toBeUndefined();
  });

  it('treats a focused root as the target folder itself', () => {
    expect(resolveNewFolderParent(ROOTS, BAR)).toBe('1');
  });
});

describe('countDescendants', () => {
  it('counts everything inside, at any depth', () => {
    expect(countDescendants(BAR)).toBe(3);
  });

  it('is 0 for a bookmark and for nothing', () => {
    expect(countDescendants(ROOTS[0]?.children?.[1])).toBe(0);
    expect(countDescendants(undefined)).toBe(0);
  });
});

describe('extraCopyIds', () => {
  it('keeps the first of each group and names the rest', () => {
    const groups = [
      { nodes: [{ id: 'a1' }, { id: 'a2' }, { id: 'a3' }] as EditNode[] },
      { nodes: [{ id: 'b1' }, { id: 'b2' }] as EditNode[] },
    ];
    expect(extraCopyIds(groups)).toEqual(['a2', 'a3', 'b2']);
  });

  it('names nothing for a group of one', () => {
    expect(extraCopyIds([{ nodes: [{ id: 'only' }] as EditNode[] }])).toEqual([]);
  });
});
