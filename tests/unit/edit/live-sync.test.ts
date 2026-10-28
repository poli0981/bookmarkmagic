import { describe, expect, it, vi } from 'vitest';
import { applyEvents, createBatcher, type LiveEvent } from '@/lib/edit/live-sync';
import type { EditNode } from '@/lib/edit/patch-tree';

/** A scheduler the test fires by hand. */
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
    get armed() {
      return pending !== undefined;
    },
  };
}

const ROOTS: EditNode[] = [{ id: '1', title: 'Bar', children: [] }];
const created = (id: string): LiveEvent => ({
  kind: 'created',
  parentId: '1',
  index: undefined,
  node: { id, title: id, url: `https://${id}.example/` },
});

describe('applyEvents', () => {
  it('applies a batch in arrival order', () => {
    const next = applyEvents(ROOTS, [
      created('a'),
      created('b'),
      { kind: 'changed', id: 'a', changes: { title: 'A' } },
      { kind: 'moved', id: 'b', parentId: '1', index: 0 },
      { kind: 'removed', id: 'a' },
    ]);
    expect(next[0]?.children?.map((n) => n.title)).toEqual(['b']);
  });
});

describe('createBatcher', () => {
  it('delivers everything pushed in one frame as one batch', () => {
    const clock = manual();
    const onFlush = vi.fn();
    const batcher = createBatcher({ onFlush, onBurst: vi.fn(), schedule: clock.schedule });
    batcher.push(created('a'));
    batcher.push(created('b'));
    expect(onFlush).not.toHaveBeenCalled();
    clock.fire();
    expect(onFlush).toHaveBeenCalledOnce();
    expect(onFlush.mock.calls[0]?.[0]).toHaveLength(2);
  });

  it('re-reads instead of patching once a burst passes the limit', () => {
    const clock = manual();
    const onFlush = vi.fn();
    const onBurst = vi.fn();
    const batcher = createBatcher({ onFlush, onBurst, limit: 3, schedule: clock.schedule });
    for (const id of ['a', 'b', 'c', 'd', 'e']) batcher.push(created(id));
    clock.fire();
    expect(onBurst).toHaveBeenCalledOnce();
    expect(onFlush).not.toHaveBeenCalled();
    // The next frame is ordinary again.
    batcher.push(created('f'));
    clock.fire();
    expect(onFlush).toHaveBeenCalledOnce();
  });

  it('resyncs on request, and disposal cancels whatever is pending', () => {
    const clock = manual();
    const onBurst = vi.fn();
    const batcher = createBatcher({ onFlush: vi.fn(), onBurst, schedule: clock.schedule });
    batcher.resync();
    clock.fire();
    expect(onBurst).toHaveBeenCalledOnce();
    batcher.push(created('a'));
    batcher.dispose();
    expect(clock.armed).toBe(false);
  });
});
