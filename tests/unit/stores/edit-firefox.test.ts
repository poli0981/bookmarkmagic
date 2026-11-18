import { beforeEach, describe, expect, it } from 'vitest';
import { searchTree } from '@/lib/core/search';
import { countDescendants, isEditable, toEditNode } from '@/lib/edit/edit-node';
import type { EditNode } from '@/lib/edit/patch-tree';
import { planSort, sortedOrder } from '@/lib/edit/sort';
import { nudgeTarget, resolveKey, visibleRows } from '@/lib/edit/tree-keyboard';
import type { EditApi } from '@/lib/stores/edit-commands.svelte';
import { EditSession } from '@/lib/stores/edit-session.svelte';
import { FakeBookmarks, FIREFOX_ROOTS } from '../../helpers/fake-bookmarks';

/**
 * #edit on Firefox — docs/03 §3, docs/05 §10, docs/06 §5 (since v1.3.0).
 *
 * Separators are rows no command touches, and a same-folder move is sent with
 * Firefox's own index. Against the Firefox flavour of the fake, which behaves
 * the way Firefox's source says its API does (docs/11 §4).
 */

let fake: FakeBookmarks;
let session: EditSession;

function api(f: FakeBookmarks): EditApi {
  return {
    getRootChildren: async () => (await f.getTree())[0]?.children ?? [],
    getChildren: async (id: string) => f.children(id),
    create: f.create,
    update: f.update,
    move: f.moveTo,
    remove: f.remove,
    removeTree: f.removeTree,
  };
}

const MENU = FIREFOX_ROOTS.menu;

/** Menu: a, ——, b, c */
function seedMenu(): { a: string; sep: string; b: string; c: string } {
  const a = fake.seed(MENU, { title: 'a', url: 'https://a.example/' });
  const sep = fake.addSeparator(MENU);
  const b = fake.seed(MENU, { title: 'b', url: 'https://b.example/' });
  const c = fake.seed(MENU, { title: 'c', url: 'https://c.example/' });
  return { a, sep, b, c };
}

beforeEach(() => {
  fake = new FakeBookmarks({ flavour: 'firefox' });
  session = new EditSession(api(fake), () => 'en');
});

describe('the edit model', () => {
  it('marks a separator, keeps its url so it is never mistaken for a folder', () => {
    const node = toEditNode({ id: 's', title: '', type: 'separator', url: 'data:' });
    expect(node).toMatchObject({ separator: true, url: 'data:' });
    expect(node.children).toBeUndefined();
    // Even without the url Firefox sends today, it stays a non-folder.
    expect(toEditNode({ id: 's', title: '', type: 'separator' }).url).toBe('data:');
  });

  it('offers no command on a separator, and does not count it as an item', () => {
    const roots: EditNode[] = [
      {
        id: 'r',
        title: 'root',
        children: [
          { id: 's', title: '', url: 'data:', separator: true, parentId: 'r' },
          { id: 'x', title: 'x', url: 'https://x/', parentId: 'r' },
        ],
      },
    ];
    expect(isEditable(roots, roots[0]?.children?.[0] as EditNode)).toBe(false);
    expect(isEditable(roots, roots[0]?.children?.[1] as EditNode)).toBe(true);
    expect(countDescendants(roots[0])).toBe(1);
  });

  it('never matches a separator in a search, "data" included', () => {
    const roots = [
      { id: 's', title: '', url: 'data:', separator: true as const },
      { id: 'd', title: 'data sheet', url: 'https://d/' },
    ];
    expect([...searchTree(roots, 'data').matched]).toEqual(['d']);
  });
});

describe('keyboard and positions', () => {
  const folder: EditNode = {
    id: 'f',
    title: 'F',
    children: [
      { id: 'a', title: 'alpha', url: 'https://a/', parentId: 'f' },
      { id: 's', title: '', url: 'data:', separator: true, parentId: 'f' },
      { id: 'b', title: 'beta', url: 'https://b/', parentId: 'f' },
    ],
  };
  const rows = visibleRows([folder], new Set(['f']));

  it('counts items, not separators, in posinset and setsize', () => {
    const byId = new Map(rows.map((row) => [row.node.id, row]));
    expect(byId.get('a')).toMatchObject({ posInSet: 1, setSize: 2 });
    expect(byId.get('b')).toMatchObject({ posInSet: 2, setSize: 2 });
  });

  it('moves focus over a separator, never onto it', () => {
    expect(resolveKey('ArrowDown', 'a', rows)).toEqual({ kind: 'focus', id: 'b' });
    expect(resolveKey('ArrowUp', 'b', rows)).toEqual({ kind: 'focus', id: 'a' });
    expect(resolveKey('End', 'a', rows)).toEqual({ kind: 'focus', id: 'b' });
  });

  it('lets Alt+↑/↓ step past a separator as one place', () => {
    expect(nudgeTarget(rows, 'b', -1)).toBe('s');
    expect(nudgeTarget(rows, 'a', 1)).toBe('s');
  });
});

describe('a folder of separators is not a folder of items', () => {
  const onlySeparators: EditNode = {
    id: 'f',
    title: 'F',
    children: [
      { id: 's1', title: '', url: 'data:', separator: true, parentId: 'f' },
      { id: 'x', title: 'x', url: 'https://x/', parentId: 'f' },
      { id: 's2', title: '', url: 'data:', separator: true, parentId: 'f' },
    ],
  };

  it('is not expandable when it holds nothing but separators', () => {
    const empty: EditNode = {
      ...onlySeparators,
      children: [onlySeparators.children?.[0] as EditNode],
    };
    expect(visibleRows([empty], new Set())[0]?.expandable).toBe(false);
    expect(visibleRows([onlySeparators], new Set())[0]?.expandable).toBe(true);
  });

  it('cannot be sorted with a single item between separators', async () => {
    await session.load();
    expect(session.canSort(onlySeparators)).toBe(false);
    const two: EditNode = {
      ...onlySeparators,
      children: [
        ...(onlySeparators.children ?? []),
        { id: 'y', title: 'y', url: 'https://y/', parentId: 'f' },
      ],
    };
    expect(session.canSort(two)).toBe(true);
  });
});

describe('Sort A→Z with separators', () => {
  const node = (id: string, separator = false): EditNode =>
    separator
      ? { id, title: '', url: 'data:', separator: true }
      : { id, title: id, url: `https://${id}/` };

  it('sorts each run on its own and leaves every separator in place', () => {
    const children = [node('d'), node('b'), node('s1', true), node('z'), node('a')];
    expect(sortedOrder(children, 'en').map((n) => n.id)).toEqual(['b', 'd', 's1', 'a', 'z']);
  });

  it('plans only leftward moves that reproduce that order', () => {
    const children = [node('d'), node('b'), node('s1', true), node('z'), node('a')];
    const current = [...children];
    for (const move of planSort(children, 'en')) {
      const from = current.findIndex((n) => n.id === move.id);
      expect(from).toBeGreaterThan(move.index);
      const [moved] = current.splice(from, 1);
      current.splice(move.index, 0, moved as EditNode);
    }
    expect(current.map((n) => n.id)).toEqual(['b', 'd', 's1', 'a', 'z']);
  });
});

describe('EditSession on Firefox', () => {
  it('drops a row after a later sibling exactly where it was dropped', async () => {
    const { a, b, c } = seedMenu();
    await session.load();
    session.draggingId = a;
    await session.drop(b, 'after');
    // Sent with Chrome's index, Firefox put it one place further, after c.
    expect(fake.childTitles(MENU)).toEqual(['', 'b', 'a', 'c']);
    expect(session.roots[0]?.children?.map((n) => n.title)).toEqual(['', 'b', 'a', 'c']);
    expect(c).toBeDefined();
  });

  it('moves one place with Alt+↓, past a separator too', async () => {
    const { a } = seedMenu();
    await session.load();
    await session.nudge(a, 1);
    expect(fake.childTitles(MENU)).toEqual(['', 'a', 'b', 'c']);
    await session.nudge(a, 1);
    expect(fake.childTitles(MENU)).toEqual(['', 'b', 'a', 'c']);
  });

  it('sorts a folder around its separators', async () => {
    fake.seed(MENU, { title: 'z', url: 'https://z.example/' });
    fake.seed(MENU, { title: 'y', url: 'https://y.example/' });
    fake.addSeparator(MENU);
    fake.seed(MENU, { title: 'k', url: 'https://k.example/' });
    fake.seed(MENU, { title: 'j', url: 'https://j.example/' });
    await session.load();
    const menu = session.roots[0] as EditNode;
    expect(session.requestSort(menu)).toBe(true);
    await session.confirmSort();
    expect(fake.childTitles(MENU)).toEqual(['y', 'z', '', 'j', 'k']);
  });

  it('never lists separators as duplicates of each other', async () => {
    fake.addSeparator(MENU);
    fake.addSeparator(MENU);
    fake.seed(MENU, { title: 'x', url: 'https://x.example/' });
    fake.seed(MENU, { title: 'x again', url: 'https://x.example/' });
    await session.load();
    session.showDuplicates = true;
    expect(session.duplicateGroups).toHaveLength(1);
    expect(session.duplicateGroups[0]?.nodes.map((n) => n.title)).toEqual(['x', 'x again']);
  });

  it('re-reads the tree when the browser reports a different landing place', async () => {
    const { a, b } = seedMenu();
    // A browser whose rule changed under us: it reports where it REALLY put
    // the node, and the session must believe it over its own patch.
    const lying: EditApi = {
      ...api(fake),
      move: async (id, destination) => {
        await fake.moveTo(id, destination);
        return 99;
      },
    };
    session = new EditSession(lying, () => 'en');
    await session.load();
    let reads = 0;
    const load = session.load;
    session.load = async () => {
      reads++;
      await load();
    };
    session.draggingId = a;
    await session.drop(b, 'after');
    expect(reads).toBe(1);
  });
});
