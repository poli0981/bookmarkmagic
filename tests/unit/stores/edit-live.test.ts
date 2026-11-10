import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeBookmarks } from '../../helpers/fake-bookmarks';

/**
 * The #edit tab's live sync, wired to a real session — docs/03 §3, docs/05 §11.
 *
 * `wxt/browser` is mocked module-wide (fakeBrowser's bookmarks events are
 * "not implemented"): each event is an emitter the test fires by hand, and so
 * is the frame the batcher waits for.
 */
function emitter() {
  const listeners = new Set<(...args: never[]) => void>();
  return {
    addListener: (fn: (...args: never[]) => void) => listeners.add(fn),
    removeListener: (fn: (...args: never[]) => void) => listeners.delete(fn),
    fire: (...args: unknown[]) => {
      // SAFETY: the test fires each event with the arguments Chrome gives it.
      for (const fn of listeners) (fn as (...a: unknown[]) => void)(...args);
    },
    get size() {
      return listeners.size;
    },
  };
}

const events = {
  onCreated: emitter(),
  onRemoved: emitter(),
  onChanged: emitter(),
  onMoved: emitter(),
  onChildrenReordered: emitter(),
  onImportBegan: emitter(),
  onImportEnded: emitter(),
};

vi.mock('wxt/browser', () => ({ browser: { bookmarks: events } }));

const { connectLive } = await import('@/lib/stores/edit-live');
const { EditSession } = await import('@/lib/stores/edit-session.svelte');

/** A scheduler the test fires by hand — the batcher's "next frame". */
function manual() {
  let pending: (() => void) | undefined;
  return {
    schedule: (run: () => void) => {
      pending = run;
      return () => {
        pending = undefined;
      };
    },
    fire: () => {
      const run = pending;
      pending = undefined;
      run?.();
    },
  };
}

let fake: FakeBookmarks;
let session: InstanceType<typeof EditSession>;
let frame: ReturnType<typeof manual>;
let disconnect: () => void;

const barTitles = (): (string | undefined)[] =>
  (session.roots[0]?.children ?? []).map((node) => node.title);

beforeEach(async () => {
  fake = new FakeBookmarks();
  fake.seed('1', { title: 'a', url: 'https://a.example/' });
  session = new EditSession(
    {
      getRootChildren: async () => (await fake.getTree())[0]?.children ?? [],
      getChildren: async (id: string) => fake.children(id),
      create: fake.create,
      update: fake.update,
      move: fake.move,
      remove: fake.remove,
      removeTree: fake.removeTree,
    },
    () => 'en',
  );
  await session.load();
  frame = manual();
  disconnect = connectLive(session, frame.schedule);
});

describe('connectLive', () => {
  it('patches the tree with a frame’s worth of events at once', () => {
    const [a] = session.roots[0]?.children ?? [];
    events.onCreated.fire('90', {
      id: '90',
      parentId: '1',
      index: 1,
      title: 'b',
      url: 'https://b.example/',
    });
    events.onChanged.fire(a?.id, { title: 'A' });
    // Nothing yet: one patch per frame, not one per event.
    expect(barTitles()).toEqual(['a']);
    frame.fire();
    expect(barTitles()).toEqual(['A', 'b']);

    events.onMoved.fire('90', { parentId: '1', index: 0, oldParentId: '1', oldIndex: 1 });
    frame.fire();
    expect(barTitles()).toEqual(['b', 'A']);

    events.onRemoved.fire('90');
    frame.fire();
    expect(barTitles()).toEqual(['A']);
    disconnect();
  });

  it('ignores a created node with no parent — the synthetic root is not a row', () => {
    events.onCreated.fire('0', { id: '0', title: '' });
    frame.fire();
    expect(session.roots).toHaveLength(2);
    disconnect();
  });

  it('takes no per-node events during Chrome’s own import, then re-reads once', async () => {
    events.onImportBegan.fire();
    // What Chrome's importer wrote, which the tab must not patch node by node.
    fake.seed('1', { title: 'imported', url: 'https://i.example/' });
    events.onCreated.fire('91', {
      id: '91',
      parentId: '1',
      index: 1,
      title: 'imported',
      url: 'https://i.example/',
    });
    frame.fire();
    expect(barTitles()).toEqual(['a']);

    events.onImportEnded.fire();
    frame.fire();
    await vi.waitFor(() => expect(barTitles()).toEqual(['a', 'imported']));
    disconnect();
  });

  it('re-reads the tree when the browser reorders a folder wholesale', async () => {
    fake.seed('1', { title: 'z', url: 'https://z.example/' });
    events.onChildrenReordered.fire('1');
    frame.fire();
    await vi.waitFor(() => expect(barTitles()).toEqual(['a', 'z']));
    disconnect();
  });

  it('detaches every listener on teardown, and drops what was still queued', () => {
    expect(Object.values(events).every((event) => event.size === 1)).toBe(true);
    events.onRemoved.fire(session.roots[0]?.children?.[0]?.id);
    disconnect();
    frame.fire();
    expect(barTitles()).toEqual(['a']);
    expect(Object.values(events).every((event) => event.size === 0)).toBe(true);
  });
});
