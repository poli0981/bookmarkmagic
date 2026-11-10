/**
 * The #edit tab's live sync, wired — docs/03 §3 "Live sync", docs/05 §11.
 *
 * Purpose: subscribe an `EditSession` to the browser's bookmark events for as
 *   long as the tab is mounted. Out of EditTab so the component stays markup
 *   and wiring (docs/10 §1); the batching itself is `edit/live-sync.ts`.
 * Guarantees: one patch per frame, and a single re-read for a burst — an
 *   import in another tab sends an event per node. Listeners attach on enter
 *   and detach on leave: a tab left subscribed during an import would take one
 *   event per created node.
 */
import { subscribe } from '../browser/bookmarks';
import { toEditNode } from '../edit/edit-node';
import { type BatcherOptions, createBatcher } from '../edit/live-sync';
import type { EditSession } from './edit-session.svelte';

/**
 * @param schedule when a batch is flushed — the next frame by default; tests
 *   pass one they fire by hand.
 * @returns the teardown: unsubscribe, and drop anything still queued.
 */
export function connectLive(
  session: EditSession,
  schedule?: BatcherOptions['schedule'],
): () => void {
  const batcher = createBatcher({
    onFlush: session.applyLiveEvents,
    onBurst: () => void session.load(),
    ...(schedule === undefined ? {} : { schedule }),
  });
  let importing = false;
  const unsubscribe = subscribe({
    onCreated: (_id, node) => {
      if (importing || node.parentId === undefined) return;
      batcher.push({
        kind: 'created',
        parentId: node.parentId,
        index: node.index,
        node: toEditNode(node),
      });
    },
    onRemoved: (id) => batcher.push({ kind: 'removed', id }),
    onChanged: (id, changes) => batcher.push({ kind: 'changed', id, changes }),
    onMoved: (id, info) => batcher.push({ kind: 'moved', id, ...info }),
    onChildrenReordered: () => batcher.resync(),
    onImportBegan: () => {
      importing = true;
    },
    onImportEnded: () => {
      importing = false;
      batcher.resync();
    },
  });
  return () => {
    unsubscribe();
    batcher.dispose();
  };
}
