import { describe, expect, it, vi } from 'vitest';
import { BmAborted } from '@/lib/browser/errors';
import { type WriteProgress, writeTree } from '@/lib/browser/write-queue';
import type { BookmarkNode, ImportPlan } from '@/lib/core/model';
import { FakeBookmarks } from '../../helpers/fake-bookmarks';

/** Build a plan whose stats match its segments, the way buildImportPlan does. */
function planOf(segments: ImportPlan['segments']): ImportPlan {
  const count = (nodes: readonly BookmarkNode[]): number =>
    nodes.reduce((n, node) => n + 1 + count(node.children ?? []), 0);
  const toCreate = segments.reduce((n, s) => n + count(s.nodes), 0);
  return {
    mode: 'merge',
    dedupe: false,
    segments,
    stats: { toCreate, bookmarkCount: 0, skippedExisting: 0, skippedInFile: 0 },
  };
}

const TREE: BookmarkNode[] = [
  {
    title: 'Folder',
    children: [
      { title: 'a', url: 'https://a.example/' },
      { title: 'Nested', children: [{ title: 'b', url: 'https://b.example/' }] },
    ],
  },
  { title: 'c', url: 'https://c.example/' },
];

describe('writeTree — ordering', () => {
  it('creates parents before children and siblings in order', async () => {
    const fake = new FakeBookmarks();
    await writeTree(planOf([{ rootId: '2', nodes: TREE }]), { create: fake.create });

    expect(fake.calls).toEqual([
      'create:2:Folder',
      'create:100:a',
      'create:100:Nested',
      'create:102:b',
      'create:2:c',
    ]);
  });

  it('writes each segment under its own root', async () => {
    const fake = new FakeBookmarks();
    await writeTree(
      planOf([
        { rootId: '1', nodes: [{ title: 'bar item', url: 'https://bar.example/' }] },
        { rootId: '2', nodes: [{ title: 'other item', url: 'https://other.example/' }] },
      ]),
      { create: fake.create },
    );

    expect(fake.childTitles('1')).toEqual(['bar item']);
    expect(fake.childTitles('2')).toEqual(['other item']);
  });

  it('appends rather than prepending — no explicit index is passed', async () => {
    const fake = new FakeBookmarks();
    fake.seed('2', { title: 'existing', url: 'https://existing.example/' });
    await writeTree(
      planOf([{ rootId: '2', nodes: [{ title: 'new', url: 'https://new.example/' }] }]),
      {
        create: fake.create,
      },
    );
    expect(fake.childTitles('2')).toEqual(['existing', 'new']);
  });
});

describe('writeTree — progress', () => {
  const wideTree = (n: number): BookmarkNode[] =>
    Array.from({ length: n }, (_, i) => ({ title: `b${i}`, url: `https://e${i}.example/` }));

  it('reports every 50 creates and once at the end', async () => {
    const fake = new FakeBookmarks();
    const events: WriteProgress[] = [];
    await writeTree(planOf([{ rootId: '2', nodes: wideTree(120) }]), {
      create: fake.create,
      onProgress: (p) => events.push({ ...p }),
    });

    expect(events.map((e) => e.done)).toEqual([50, 100, 120]);
    expect(events.every((e) => e.total === 120)).toBe(true);
  });

  it('still emits a final event when the total is under the cadence', async () => {
    const fake = new FakeBookmarks();
    const events: WriteProgress[] = [];
    await writeTree(planOf([{ rootId: '2', nodes: wideTree(3) }]), {
      create: fake.create,
      onProgress: (p) => events.push({ ...p }),
    });
    expect(events.at(-1)).toMatchObject({ done: 3, total: 3 });
  });

  it('emits one event even for an empty plan', async () => {
    const fake = new FakeBookmarks();
    const events: WriteProgress[] = [];
    await writeTree(planOf([]), { create: fake.create, onProgress: (p) => events.push({ ...p }) });
    expect(events).toEqual([{ done: 0, total: 0, currentPath: '' }]);
  });

  it('carries the folder path of the node being written', async () => {
    const fake = new FakeBookmarks();
    const events: WriteProgress[] = [];
    const deep: BookmarkNode[] = [
      { title: 'L1', children: [{ title: 'L2', children: wideTree(50) }] },
    ];
    await writeTree(planOf([{ rootId: '2', nodes: deep }]), {
      create: fake.create,
      onProgress: (p) => events.push({ ...p }),
    });
    expect(events[0]?.currentPath).toBe('L1 / L2');
  });

  it('counts progress across segments with one shared denominator', async () => {
    const fake = new FakeBookmarks();
    const events: WriteProgress[] = [];
    await writeTree(
      planOf([
        { rootId: '1', nodes: wideTree(30) },
        { rootId: '2', nodes: wideTree(30) },
      ]),
      { create: fake.create, onProgress: (p) => events.push({ ...p }) },
    );
    // 60 total, so the 50th create reports across the segment boundary.
    expect(events.map((e) => e.done)).toEqual([50, 60]);
    expect(events[0]?.total).toBe(60);
  });
});

describe('writeTree — abort', () => {
  it('throws BmAborted carrying the exact created count and stops calling', async () => {
    const fake = new FakeBookmarks();
    const controller = new AbortController();
    const nodes = Array.from({ length: 20 }, (_, i) => ({
      title: `b${i}`,
      url: `https://e${i}.example/`,
    }));

    const create: typeof fake.create = async (details) => {
      const node = await fake.create(details);
      if (fake.countCalls('create') === 5) controller.abort();
      return node;
    };

    await expect(
      writeTree(planOf([{ rootId: '2', nodes }]), { signal: controller.signal, create }),
    ).rejects.toBeInstanceOf(BmAborted);

    expect(fake.countCalls('create')).toBe(5);
    expect(fake.childTitles('2')).toEqual(['b0', 'b1', 'b2', 'b3', 'b4']);
  });

  it('reports done === the number actually written', async () => {
    const fake = new FakeBookmarks();
    const controller = new AbortController();
    const create: typeof fake.create = async (details) => {
      const node = await fake.create(details);
      if (fake.countCalls('create') === 3) controller.abort();
      return node;
    };
    try {
      await writeTree(
        planOf([
          {
            rootId: '2',
            nodes: Array.from({ length: 9 }, (_, i) => ({
              title: `b${i}`,
              url: `https://e${i}.example/`,
            })),
          },
        ]),
        { signal: controller.signal, create },
      );
      expect.unreachable('should have aborted');
    } catch (err) {
      expect((err as BmAborted).done).toBe(3);
    }
  });

  it('aborts before the first create when the signal is already set', async () => {
    const fake = new FakeBookmarks();
    const controller = new AbortController();
    controller.abort();
    await expect(
      writeTree(planOf([{ rootId: '2', nodes: [{ title: 'a', url: 'https://a.example/' }] }]), {
        signal: controller.signal,
        create: fake.create,
      }),
    ).rejects.toBeInstanceOf(BmAborted);
    expect(fake.countCalls('create')).toBe(0);
  });
});

describe('writeTree — API failure', () => {
  it('propagates a create failure with the earlier successes already written', async () => {
    const fake = new FakeBookmarks({ failOnCreate: 4 });
    const nodes = Array.from({ length: 6 }, (_, i) => ({
      title: `b${i}`,
      url: `https://e${i}.example/`,
    }));

    await expect(
      writeTree(planOf([{ rootId: '2', nodes }]), { create: fake.create }),
    ).rejects.toThrow(/injected failure/);

    expect(fake.childTitles('2')).toEqual(['b0', 'b1', 'b2']);
  });
});

describe('writeTree — responsiveness', () => {
  it('yields to the event loop periodically on a large import', async () => {
    const fake = new FakeBookmarks();
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    const before = setTimeoutSpy.mock.calls.length;

    await writeTree(
      planOf([
        {
          rootId: '2',
          nodes: Array.from({ length: 450 }, (_, i) => ({
            title: `b${i}`,
            url: `https://e${i}.example/`,
          })),
        },
      ]),
      { create: fake.create },
    );

    // 450 creates → yields at 200 and 400. jsdom exposes no scheduler.yield,
    // so the fallback path must actually run (and actually be awaited).
    expect(setTimeoutSpy.mock.calls.length - before).toBeGreaterThanOrEqual(2);
    setTimeoutSpy.mockRestore();
  });
});
