/**
 * `chrome.bookmarks` adapter — docs/02 §3 rule 3, docs/03 §2.
 *
 * Purpose: the single audited surface where the extension talks to the
 *   bookmarks API. Components never call `chrome.*` directly.
 * Inputs / guarantees: raw rejections are mapped to `BmBrowserError`. The
 *   pure half — the node shape, separators, counts and the conversion into the
 *   `BookmarkNode` file model — is `live-tree.ts`; which folders are the roots
 *   is `roots.ts`. Firefox's API differs from Chromium's in ways this file
 *   absorbs (docs/02 §4): its move index (below) and its missing events.
 */
import { browser } from 'wxt/browser';
import { BmAborted, BmBrowserError, BmPartialWrite } from './errors';
import { type LiveNode, type MoveDestination, type MoveIndexRule, moveIndexFor } from './live-tree';

// The node shape and the move-index rule live with the pure helpers
// (live-tree.ts); re-exported so the adapter stays the one import for code
// that talks to the browser.
export type { LiveNode, MoveDestination } from './live-tree';

async function guard<T>(operation: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (cause) {
    throw new BmBrowserError(operation, cause);
  }
}

/** Fetch the whole tree. Returns the synthetic root's children (the real roots). */
export async function getRootChildren(): Promise<LiveNode[]> {
  const tree = await guard('bookmarks.getTree', () => browser.bookmarks.getTree());
  return (tree[0]?.children ?? []) as LiveNode[];
}

/** The current children of one folder — what a bulk command re-plans from. */
export async function getChildren(id: string): Promise<LiveNode[]> {
  return (await guard('bookmarks.getChildren', () =>
    browser.bookmarks.getChildren(id),
  )) as LiveNode[];
}

export async function create(details: {
  parentId: string;
  title: string;
  url?: string;
  index?: number;
}): Promise<LiveNode> {
  const created = await guard('bookmarks.create', () => browser.bookmarks.create(details));
  return created as LiveNode;
}

export async function update(id: string, changes: { title?: string; url?: string }): Promise<void> {
  await guard('bookmarks.update', () => browser.bookmarks.update(id, changes));
}

const MOVE_INDEX_RULE: MoveIndexRule = import.meta.env.FIREFOX ? 'firefox' : 'chromium';

/**
 * The longest address this browser accepts in a bookmark, or `undefined` for
 * none. Firefox refuses anything over 65 536 characters (Places'
 * `MAX_URL_LENGTH`) — mid-write, so the import drops such addresses up front
 * (docs/04 §1.2); Chromium has no limit an import can reach.
 */
export const MAX_URL_LENGTH: number | undefined = import.meta.env.FIREFOX ? 65_536 : undefined;

/**
 * Move a node. Resolves to the index the browser says the node now has, which
 * the caller compares with `position.local` — a disagreement means the tree on
 * screen no longer matches the browser's, and it is re-read (docs/03 §3).
 */
export async function move(
  id: string,
  destination: MoveDestination,
  rule: MoveIndexRule = MOVE_INDEX_RULE,
): Promise<number | undefined> {
  const { parentId, position } = destination;
  const details = {
    ...(parentId !== undefined && { parentId }),
    ...(position !== undefined && { index: moveIndexFor(position, rule) }),
  };
  const moved = await guard('bookmarks.move', () => browser.bookmarks.move(id, details));
  return (moved as { index?: number } | undefined)?.index;
}

/** Remove a single bookmark. Folders need `removeTree`. */
export async function remove(id: string): Promise<void> {
  await guard('bookmarks.remove', () => browser.bookmarks.remove(id));
}

export async function removeTree(id: string): Promise<void> {
  await guard('bookmarks.removeTree', () => browser.bookmarks.removeTree(id));
}

/** Events the #edit tree subscribes to — docs/03 §3 "Live sync". */
export interface BookmarkEvents {
  onCreated: (id: string, node: LiveNode) => void;
  onRemoved: (id: string) => void;
  onChanged: (id: string, changes: { title?: string; url?: string }) => void;
  onMoved: (id: string, info: { parentId: string; index: number }) => void;
  /** A folder's children were reordered wholesale (Chrome's own "Sort by name"). */
  onChildrenReordered?: (id: string) => void;
  /** Chrome's own importer is running; it sends no per-node events meanwhile. */
  onImportBegan?: () => void;
  onImportEnded?: () => void;
}

type Listenable<T extends unknown[]> = {
  addListener: (fn: (...args: T) => void) => void;
  removeListener: (fn: (...args: T) => void) => void;
};

/**
 * Subscribe to bookmark changes; returns an unsubscribe function.
 *
 * Listeners attach on tab enter and detach on leave (docs/03 §3). Each handler
 * is isolated: an exception in one used to escape into Chrome's event
 * dispatch, and the tree silently stopped following the browser.
 */
export function subscribe(
  handlers: BookmarkEvents,
  onError?: (error: unknown) => void,
): () => void {
  // SAFETY: every name looked up below is a `chrome.bookmarks` event object;
  // the record type only erases their argument lists so one loop wires them.
  const api = browser.bookmarks as unknown as Record<string, Listenable<unknown[]> | undefined>;
  const safe =
    <T extends unknown[]>(fn: ((...args: T) => void) | undefined) =>
    (...args: T): void => {
      try {
        fn?.(...args);
      } catch (error) {
        onError?.(error);
      }
    };

  const wired: [string, (...args: never[]) => void][] = [
    ['onCreated', safe(handlers.onCreated)],
    ['onRemoved', safe(handlers.onRemoved)],
    ['onChanged', safe(handlers.onChanged)],
    ['onMoved', safe(handlers.onMoved)],
    ['onChildrenReordered', safe(handlers.onChildrenReordered)],
    ['onImportBegan', safe(handlers.onImportBegan)],
    ['onImportEnded', safe(handlers.onImportEnded)],
  ];
  // Not every Chromium build has every event (Firefox lacks the import pair).
  // SAFETY: each listener is registered on the event whose arguments it was
  // typed for in `BookmarkEvents`; the cast only matches the erased record.
  const erased = wired as unknown as [string, (...args: unknown[]) => void][];
  for (const [name, fn] of erased) api[name]?.addListener(fn);

  return () => {
    for (const [name, fn] of erased) api[name]?.removeListener(fn);
  };
}

/**
 * Delete the CHILDREN of the given roots, never the roots themselves (the API
 * forbids that anyway). Managed nodes are skipped — docs/05 §6.
 *
 * @throws {BmAborted} on cancellation, carrying how many were already removed.
 * @throws {BmPartialWrite} when a removal rejects, carrying the same count.
 *   This is the one path that destroys data, so "how much is gone" is the
 *   single most useful thing the failure can say.
 */
export async function clearRoots(
  roots: readonly LiveNode[],
  signal?: AbortSignal,
): Promise<number> {
  let removed = 0;
  for (const root of roots) {
    if (root.unmodifiable !== undefined) continue;
    for (const child of root.children ?? []) {
      if (child.unmodifiable !== undefined) continue;
      // Checked per node so a cancel arriving mid-deletion stops promptly
      // rather than running the whole tree to completion.
      if (signal?.aborted === true) throw new BmAborted(removed);
      try {
        await removeTree(child.id);
      } catch (cause) {
        throw new BmPartialWrite('clearing', removed, cause);
      }
      removed++;
    }
  }
  return removed;
}
