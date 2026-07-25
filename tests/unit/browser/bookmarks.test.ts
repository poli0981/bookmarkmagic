import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeBookmarks } from '../../helpers/fake-bookmarks';

/**
 * `wxt/browser` is mocked module-wide because fakeBrowser stubs bookmarks.*
 * with "not implemented" throws (docs/11 §4). The fake is swapped per test via
 * the `current` holder.
 */
let current = new FakeBookmarks();

vi.mock('wxt/browser', () => ({
  browser: {
    bookmarks: {
      getTree: () => current.getTree(),
      create: (details: Parameters<FakeBookmarks['create']>[0]) => current.create(details),
      removeTree: (id: string) => current.removeTree(id),
    },
  },
}));

const { clearRoots, flattenLive, getRoots, toBookmarkNodes } = await import(
  '@/lib/browser/bookmarks'
);

beforeEach(() => {
  current = new FakeBookmarks();
});

describe('toBookmarkNodes', () => {
  it('converts dateAdded from milliseconds to seconds', () => {
    // chrome.bookmarks reports ms; BookmarkNode.addDate is seconds (docs/05 §4).
    const [node] = toBookmarkNodes([
      { id: '10', title: 'a', url: 'https://a.example/', dateAdded: 1_751_500_000_499 },
    ]);
    expect(node?.addDate).toBe(1751500000);
  });

  it('drops ids and treats a missing url as a folder', () => {
    const [folder] = toBookmarkNodes([
      { id: '10', title: 'F', children: [{ id: '11', title: 'a', url: 'https://a.example/' }] },
    ]);
    expect(folder).toEqual({
      title: 'F',
      children: [{ title: 'a', url: 'https://a.example/' }],
    });
    expect(Object.hasOwn(folder ?? {}, 'id')).toBe(false);
  });

  it('omits absent dates rather than writing undefined', () => {
    const [node] = toBookmarkNodes([{ id: '10', title: 'a', url: 'https://a.example/' }]);
    expect(Object.hasOwn(node ?? {}, 'addDate')).toBe(false);
  });

  it('treats dateAdded of 0 as absent', () => {
    const [node] = toBookmarkNodes([
      { id: '10', title: 'a', url: 'https://a.example/', dateAdded: 0 },
    ]);
    expect(Object.hasOwn(node ?? {}, 'addDate')).toBe(false);
  });

  it('marks the toolbar root so a backup can restore the Bookmarks Bar', () => {
    // Without the marker, re-importing lands the whole toolbar under Other
    // Bookmarks — docs/03 §1 routes purely on this flag.
    const [bar, other] = toBookmarkNodes(
      [
        { id: '1', title: 'Bookmarks bar', children: [] },
        { id: '2', title: 'Other bookmarks', children: [] },
      ],
      { toolbarId: '1' },
    );
    expect(bar?.toolbar).toBe(true);
    expect(Object.hasOwn(other ?? {}, 'toolbar')).toBe(false);
  });

  it('omits the marker entirely when no toolbarId is given', () => {
    const [node] = toBookmarkNodes([{ id: '1', title: 'Bookmarks bar', children: [] }]);
    expect(Object.hasOwn(node ?? {}, 'toolbar')).toBe(false);
  });

  it('does not put dateGroupModified on bookmarks — it is a folder field', () => {
    const [bookmark, folder] = toBookmarkNodes([
      { id: '10', title: 'a', url: 'https://a.example/', dateGroupModified: 1_751_500_000_000 },
      { id: '11', title: 'F', children: [], dateGroupModified: 1_751_500_000_000 },
    ]);
    expect(Object.hasOwn(bookmark ?? {}, 'lastModified')).toBe(false);
    expect(folder?.lastModified).toBe(1751500000);
  });
});

describe('flattenLive', () => {
  it('returns parents before children, keeping ids', () => {
    const flat = flattenLive([
      { id: '1', title: 'F', children: [{ id: '2', title: 'a', url: 'https://a.example/' }] },
    ]);
    expect(flat.map((n) => n.id)).toEqual(['1', '2']);
  });
});

describe('getRoots', () => {
  it('resolves the toolbar and other roots', async () => {
    const roots = await getRoots();
    expect(roots.toolbarId).toBe('1');
    expect(roots.otherId).toBe('2');
    expect(roots.mobileId).toBe('3');
  });

  it('excludes a policy-managed root from the writable set', async () => {
    current.addManagedRoot();
    const roots = await getRoots();
    expect(roots.writable.map((r) => r.id)).toEqual(['1', '2', '3']);
    expect(roots.writable.some((r) => r.unmodifiable !== undefined)).toBe(false);
  });
});

describe('clearRoots', () => {
  it('removes the children of each root, never the roots themselves', async () => {
    current.seed('1', { title: 'bar item', url: 'https://bar.example/' });
    current.seed('2', { title: 'other item', url: 'https://other.example/' });

    const roots = await getRoots();
    const removed = await clearRoots(roots.writable);

    expect(removed).toBe(2);
    expect(current.calls.filter((c) => c.startsWith('removeTree'))).toHaveLength(2);
    // The roots are still there — only their children went.
    expect(current.childTitles('1')).toEqual([]);
    expect(current.childTitles('2')).toEqual([]);
  });

  it('never calls removeTree on a managed node, at root or child level', async () => {
    const managed = current.addManagedRoot();
    const roots = await getRoots();
    // Pass the managed root in explicitly — clearRoots must skip it itself
    // rather than relying on the caller having filtered.
    await clearRoots([...roots.writable, managed]);
    expect(current.calls.some((c) => c.includes('managed'))).toBe(false);
  });

  it('stops promptly when the abort signal fires mid-deletion', async () => {
    // The old code ran the whole deletion regardless, so a user who cancelled
    // was told "0 items created" after their tree had been wiped.
    for (let i = 0; i < 5; i++) {
      current.seed('2', { title: `b${i}`, url: `https://e${i}.example/` });
    }
    const controller = new AbortController();
    controller.abort();

    const roots = await getRoots();
    await expect(clearRoots(roots.writable, controller.signal)).rejects.toMatchObject({
      name: 'BmAborted',
    });
    expect(current.countCalls('removeTree')).toBe(0);
  });
});
