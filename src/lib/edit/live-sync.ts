/**
 * Live sync, batched — docs/03 §3 "Live sync".
 *
 * Purpose: apply `chrome.bookmarks` events to the #edit tree without patching
 *   the whole tree once per event. An import running in another tab sends one
 *   `onCreated` per node — thousands a minute — and 1.0.x rebuilt the tree (and
 *   rescanned it for duplicates) for every one of them.
 * Guarantees: events queued in one frame are applied together, in arrival
 *   order. Past `limit` queued events the queue is dropped and the tree is
 *   re-read once instead (`onBurst`) — cheaper than thousands of patches, and
 *   exact. Pure apart from the injected scheduler.
 */
import { changeNode, type EditNode, insertNode, moveNode, removeNode } from './patch-tree';

export type LiveEvent =
  | { kind: 'created'; parentId: string; index: number | undefined; node: EditNode }
  | { kind: 'removed'; id: string }
  | { kind: 'changed'; id: string; changes: { title?: string; url?: string } }
  | { kind: 'moved'; id: string; parentId: string; index: number };

/** Every id in a tree, iteratively (the live tree has no depth cap). */
function idsOf(roots: readonly EditNode[]): Set<string> {
  const ids = new Set<string>();
  const stack = [...roots];
  for (let node = stack.pop(); node !== undefined; node = stack.pop()) {
    ids.add(node.id);
    for (const child of node.children ?? []) stack.push(child);
  }
  return ids;
}

/**
 * Apply a batch of events in order.
 *
 * A "created" for an id the tree already holds is dropped. Events queued
 * before a re-read land after it, and inserting again put a second copy of the
 * same bookmark in the view — which the duplicate finder then offered to
 * delete as a "duplicate" of itself, removing the only copy.
 */
export function applyEvents(roots: EditNode[], events: readonly LiveEvent[]): EditNode[] {
  let next = roots;
  let ids: Set<string> | undefined;
  for (const event of events) {
    switch (event.kind) {
      case 'created':
        ids ??= idsOf(next);
        if (ids.has(event.node.id)) break;
        next = insertNode(next, event.parentId, event.index, event.node);
        ids.add(event.node.id);
        break;
      case 'removed':
        next = removeNode(next, event.id);
        ids = undefined;
        break;
      case 'changed':
        next = changeNode(next, event.id, event.changes);
        break;
      case 'moved':
        next = moveNode(next, event.id, event.parentId, event.index);
        break;
    }
  }
  return next;
}

/** Runs `run` soon; returns a cancel function. Defaults to the next animation frame. */
type Schedule = (run: () => void) => () => void;

const nextFrame: Schedule = (run) => {
  const handle = requestAnimationFrame(run);
  return () => cancelAnimationFrame(handle);
};

export interface BatcherOptions {
  onFlush: (events: LiveEvent[]) => void;
  /** Too many events to patch: re-read the tree instead. */
  onBurst: () => void;
  limit?: number;
  schedule?: Schedule;
}

export interface Batcher {
  push: (event: LiveEvent) => void;
  /** Drop anything queued and re-read the tree (Chrome's own import ended, a folder was reordered). */
  resync: () => void;
  dispose: () => void;
}

export function createBatcher(options: BatcherOptions): Batcher {
  const limit = options.limit ?? 500;
  const schedule = options.schedule ?? nextFrame;
  let queue: LiveEvent[] = [];
  let overflowed = false;
  let cancel: (() => void) | undefined;

  const flush = (): void => {
    cancel = undefined;
    const events = queue;
    const burst = overflowed;
    queue = [];
    overflowed = false;
    if (burst) options.onBurst();
    else if (events.length > 0) options.onFlush(events);
  };

  const arm = (): void => {
    cancel ??= schedule(flush);
  };

  return {
    push(event) {
      if (!overflowed) {
        queue.push(event);
        if (queue.length > limit) {
          overflowed = true;
          queue = [];
        }
      }
      arm();
    },
    resync() {
      overflowed = true;
      queue = [];
      arm();
    },
    dispose() {
      cancel?.();
      cancel = undefined;
      queue = [];
    },
  };
}
