import { beforeEach, describe, expect, it } from 'vitest';
import { EditSession } from '@/lib/stores/edit-session.svelte';
import { FakeBookmarks } from '../../helpers/fake-bookmarks';

/**
 * The #edit commands against the in-memory bookmarks API — docs/03 §3.
 * The API is injected, so nothing here mounts a component or mocks a module.
 */
let fake: FakeBookmarks;
let session: EditSession;

function api(f: FakeBookmarks) {
  return {
    getRootChildren: async () => (await f.getTree())[0]?.children ?? [],
    getChildren: async (id: string) => f.children(id),
    create: f.create,
    update: f.update,
    move: f.move,
    remove: f.remove,
    removeTree: f.removeTree,
  };
}

beforeEach(async () => {
  fake = new FakeBookmarks();
  session = new EditSession(api(fake), () => 'en');
});

describe('EditSession — loading', () => {
  it('opens the roots on first load, and keeps the user’s expansion and focus on a resync', async () => {
    const dev = fake.seed('1', { title: 'Dev' });
    await session.load();
    expect(session.loading).toBe(false);
    // Root 3 is absent: like desktop Chrome, the fake hides an empty Mobile root.
    expect([...session.expanded].sort()).toEqual(['1', '2']);

    session.toggle(dev);
    session.focusedId = dev;
    await session.load();
    expect(session.expanded.has(dev)).toBe(true);
    expect(session.focusedId).toBe(dev);
  });
});

describe('EditSession — sort A→Z', () => {
  it('plans first, then sorts the folder with the fewest moves', async () => {
    for (const title of ['b', 'C', 'a'])
      fake.seed('2', { title, url: `https://${title}.example/` });
    fake.seed('2', { title: 'Folder' });
    await session.load();
    const other = session.roots[1];
    if (other === undefined) throw new Error('no Other root');

    expect(session.requestSort(other)).toBe(true);
    expect(session.pendingSort?.moves.length).toBeGreaterThan(0);
    await session.confirmSort();
    expect(fake.childTitles('2')).toEqual(['Folder', 'a', 'b', 'C']);
    expect(session.roots[1]?.children?.map((n) => n.title)).toEqual(['Folder', 'a', 'b', 'C']);
    expect(session.busy).toBe(false);
  });

  it('re-plans from the folder as it is at confirm time', async () => {
    // F holds [b, a]; while the dialog is open, "a" is moved out to G.
    const g = fake.seed('2', { title: 'G' });
    const f = fake.seed('2', { title: 'F' });
    fake.seed(f, { title: 'b', url: 'https://b/' });
    const a = fake.seed(f, { title: 'a', url: 'https://a/' });
    await session.load();
    const folder = session.roots[1]?.children?.find((n) => n.id === f);
    if (folder === undefined) throw new Error('no F');
    session.requestSort(folder);
    await fake.move(a, { parentId: g });
    await session.confirmSort();
    expect(fake.childTitles(f)).toEqual(['b']);
    expect(fake.childTitles(g)).toEqual(['a']);
  });

  it('declines a folder that is already sorted', async () => {
    fake.seed('2', { title: 'a', url: 'https://a/' });
    fake.seed('2', { title: 'b', url: 'https://b/' });
    await session.load();
    const other = session.roots[1];
    expect(other !== undefined && session.requestSort(other)).toBe(false);
  });

  it('says how far it got when the browser refuses part-way, and re-reads the folder', async () => {
    for (const title of ['d', 'c', 'b', 'a']) fake.seed('2', { title, url: `https://${title}/` });
    let calls = 0;
    const move = fake.move;
    fake.move = async (...args) => {
      if (++calls === 2) throw new Error('refused');
      await move(...args);
    };
    session = new EditSession(api(fake), () => 'en');
    await session.load();
    const other = session.roots[1];
    if (other === undefined) throw new Error('no Other root');
    session.requestSort(other);
    await session.confirmSort();
    expect(session.actionError?.partial).toEqual({ done: 1, total: 3, kind: 'sort' });
    expect(session.roots[1]?.children?.map((n) => n.title)).toEqual(fake.childTitles('2'));
  });
});

describe('EditSession — drag and drop', () => {
  it('reorders within a folder using Chrome’s index rules', async () => {
    const ids = ['a', 'b', 'c'].map((t) => fake.seed('1', { title: t, url: `https://${t}/` }));
    await session.load();
    session.draggingId = ids[0];
    await session.drop(ids[2] ?? '', 'after');
    expect(fake.childTitles('1')).toEqual(['b', 'c', 'a']);
    expect(session.roots[0]?.children?.map((n) => n.title)).toEqual(['b', 'c', 'a']);
    expect(session.draggingId).toBeUndefined();
  });

  it('ignores a drop with nothing dragged', async () => {
    await session.load();
    await session.drop('1', 'into');
    expect(fake.countCalls('move')).toBe(0);
  });
});

describe('EditSession — rename, delete, new folder', () => {
  it('trims a rename and ignores a blank or unchanged one', async () => {
    const id = fake.seed('1', { title: 'old', url: 'https://x/' });
    await session.load();
    await session.commitRename(id, '  new  ');
    expect(fake.childTitles('1')).toEqual(['new']);
    await session.commitRename(id, '   ');
    await session.commitRename(id, 'new');
    expect(fake.countCalls('update')).toBe(1);
  });

  it('moves focus to the next row after a delete from the tree', async () => {
    const [a, b] = ['a', 'b'].map((t) => fake.seed('1', { title: t, url: `https://${t}/` }));
    await session.load();
    session.focusedId = a;
    const node = session.roots[0]?.children?.[0];
    if (node === undefined) throw new Error('no row');
    session.requestDelete(node, true);
    expect(await session.confirmDelete()).toBe(true);
    expect(session.focusedId).toBe(b);
    expect(fake.childTitles('1')).toEqual(['b']);
  });

  it('leaves focus alone when the delete came from the duplicate panel (v1.1.0 review)', async () => {
    const [a, b] = ['a', 'b'].map((t) => fake.seed('1', { title: t, url: `https://${t}/` }));
    await session.load();
    session.focusedId = a;
    const copy = session.roots[0]?.children?.find((n) => n.id === b);
    if (copy === undefined) throw new Error('no row');
    session.requestDelete(copy, false);
    expect(await session.confirmDelete()).toBe(false);
    expect(session.focusedId).toBe(a);
    expect(fake.childTitles('1')).toEqual(['a']);
  });

  it('clears a search that would hide the folder it just created, and shows its row', async () => {
    await session.load();
    session.query = 'zzz';
    session.debounced = 'zzz';
    await session.newFolder('New folder');
    expect(session.filtering).toBe(false);
    expect(session.renamingId).toBe(session.focusedId);
    expect(session.rows.some((row) => row.node.id === session.renamingId)).toBe(true);
  });

  it('keeps a new folder visible when the search that opened its parent clears (v1.1.0 review)', async () => {
    const dev = fake.seed('1', { title: 'Dev' });
    const ref = fake.seed(dev, { title: 'Reference' });
    fake.seed(ref, { title: 'Spec', url: 'https://spec.example/' });
    await session.load();
    // The component's effect, by hand: the search opens Bar > Dev for "Reference".
    session.debounced = 'Reference';
    session.syncSearchExpansion(session.search.expand, true);
    session.focusedId = ref;
    await session.newFolder('New folder');
    session.syncSearchExpansion(session.search.expand, session.filtering);
    session.repairFocus();
    const created = session.renamingId;
    expect(created).toBeDefined();
    expect(session.rows.some((row) => row.node.id === created)).toBe(true);
    expect(session.focusedId).toBe(created);
  });
});

describe('EditSession — focus stays on a rendered row (v1.1.0 review)', () => {
  it('moves focus to the nearest visible folder when its row is collapsed away', async () => {
    const dev = fake.seed('1', { title: 'Dev' });
    const gh = fake.seed(dev, { title: 'GitHub', url: 'https://github.com/' });
    await session.load();
    session.toggle(dev);
    session.focusedId = gh;
    session.repairFocus();
    expect(session.focusedId).toBe(gh);
    session.collapseAll();
    session.repairFocus();
    expect(session.focusedId).toBe('1');
  });

  it('climbs from a row deleted elsewhere, using the tree as it was', async () => {
    const dev = fake.seed('1', { title: 'Dev' });
    const gh = fake.seed(dev, { title: 'GitHub', url: 'https://github.com/' });
    await session.load();
    session.toggle(dev);
    session.focusedId = gh;
    session.repairFocus();
    session.applyLiveEvents([{ kind: 'removed', id: gh }]);
    session.repairFocus();
    expect(session.focusedId).toBe(dev);
  });

  it('drops a rename whose row is no longer on screen', async () => {
    const dev = fake.seed('1', { title: 'Dev' });
    const gh = fake.seed(dev, { title: 'GitHub', url: 'https://github.com/' });
    await session.load();
    session.toggle(dev);
    session.renamingId = gh;
    session.toggle(dev);
    session.repairFocus();
    expect(session.renamingId).toBeUndefined();
  });
});

describe('EditSession — a search remembers what the user closed (v1.1.0 review)', () => {
  it('keeps a folder closed through a tree change during the search', async () => {
    const dev = fake.seed('1', { title: 'Dev' });
    fake.seed(dev, { title: 'Docs', url: 'https://docs.example/' });
    await session.load();
    session.debounced = 'Docs';
    session.syncSearchExpansion(session.search.expand, true);
    expect(session.expanded.has(dev)).toBe(true);
    session.toggle(dev);
    // A rename elsewhere re-runs the search and the component's effect.
    session.applyLiveEvents([{ kind: 'changed', id: '2', changes: { title: 'Other' } }]);
    session.syncSearchExpansion(session.search.expand, true);
    expect(session.expanded.has(dev)).toBe(false);
  });
});

describe('EditSession — one bulk command at a time (v1.1.0 review)', () => {
  it('refuses every other write while a sort runs, and only the sort clears busy', async () => {
    for (const title of ['d', 'c', 'b', 'a']) fake.seed('2', { title, url: `https://${title}/` });
    const x = fake.seed('1', { title: 'x', url: 'https://x/' });
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const move = fake.move;
    fake.move = async (...args) => {
      await gate;
      await move(...args);
    };
    session = new EditSession(api(fake), () => 'en');
    await session.load();
    const other = session.roots[1];
    if (other === undefined) throw new Error('no Other root');
    session.requestSort(other);
    const sorting = session.confirmSort();
    expect(session.busy).toBe(true);

    // A second sort, a rename, a delete and a new folder all do nothing.
    expect(session.requestSort(other)).toBe(false);
    session.pendingSort = { folder: other, moves: [] };
    await session.confirmSort();
    expect(session.busy).toBe(true);
    const row = session.roots[0]?.children?.find((n) => n.id === x);
    if (row === undefined) throw new Error('no row');
    session.startRename(row);
    session.requestDelete(row, true);
    await session.newFolder('New');
    expect(session.renamingId).toBeUndefined();
    expect(session.pendingDelete).toBeUndefined();
    expect(fake.countCalls('create')).toBe(0);

    release();
    await sorting;
    expect(session.busy).toBe(false);
    expect(session.actionError).toBeUndefined();
    expect(fake.childTitles('2')).toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('EditSession — duplicates', () => {
  it('scans only while the panel or the dialog shows the result', async () => {
    fake.seed('1', { title: 'x', url: 'https://dup.example/' });
    fake.seed('2', { title: 'y', url: 'https://dup.example/' });
    await session.load();
    expect(session.duplicateGroups).toEqual([]);
    session.showDuplicates = true;
    expect(session.duplicateGroups).toHaveLength(1);
  });
});
