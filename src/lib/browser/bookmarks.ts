/**
 * `chrome.bookmarks` adapter — docs/02 §3 rule 3, docs/03 §2.
 *
 * Purpose: the single audited surface where the extension talks to the
 *   bookmarks API. Components never call `chrome.*` directly.
 * Inputs / guarantees: raw rejections are mapped to `BmBrowserError`; the live
 *   tree is converted into the pure `BookmarkNode` file model here, including
 *   the millisecond→second conversion (`chrome.bookmarks` reports `dateAdded`
 *   in ms; `BookmarkNode.addDate` is seconds — docs/05 §4).
 */
import { browser } from 'wxt/browser';
import type { BookmarkNode } from '../core/model';
import { millisToSeconds } from '../core/timestamps';
import { BmAborted, BmBrowserError, BmEnvError, BmPartialWrite } from './errors';

/** The live-tree node. Unlike `BookmarkNode` it carries browser identity. */
export interface LiveNode {
  id: string;
  parentId?: string;
  index?: number;
  title: string;
  url?: string;
  dateAdded?: number;
  dateGroupModified?: number;
  /** Set by Chrome on policy-managed nodes; such nodes reject writes. */
  unmodifiable?: string;
  children?: LiveNode[];
}

export interface BookmarkRoots {
  /** Bookmarks Bar. */
  toolbarId: string;
  /** Other Bookmarks. */
  otherId: string;
  /** Mobile Bookmarks, when the profile has one. */
  mobileId: string | undefined;
  /** Writable top-level folders, in tree order, excluding managed ones. */
  writable: LiveNode[];
}

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

/**
 * Resolve the destination roots.
 *
 * Ids "1"/"2"/"3" are stable in Chromium but resolving through `getTree()`
 * keeps a future Firefox target working, where roots are named ids. Nodes
 * carrying `unmodifiable` (the enterprise/supervised "Managed bookmarks"
 * folder) are excluded everywhere — writing to or removing them rejects.
 */
export async function getRoots(): Promise<BookmarkRoots> {
  const children = await getRootChildren();
  const writable = children.filter((node) => node.unmodifiable === undefined);

  const byId = (id: string): LiveNode | undefined => writable.find((node) => node.id === id);
  const toolbar = byId('1') ?? writable[0];
  const other = byId('2') ?? writable.find((node) => node !== toolbar);
  const mobile = byId('3') ?? writable.find((node) => node !== toolbar && node !== other);

  if (toolbar === undefined || other === undefined) {
    // Not a BmBrowserError: nothing refused anything. Every root this profile
    // has is policy-managed, so there is nowhere an extension may write, and
    // "the browser refused a bookmark operation" would be actively misleading.
    throw new BmEnvError('NO_WRITABLE_ROOTS', `${children.length} root(s), none writable`);
  }

  return {
    toolbarId: toolbar.id,
    otherId: other.id,
    mobileId: mobile?.id,
    writable,
  };
}

export interface ToNodesOptions {
  /**
   * Id of the Bookmarks Bar. The matching node is marked `toolbar: true`.
   *
   * Without this the marker is lost, and re-importing the file (including the
   * Replace safety backup) lands the entire toolbar under Other Bookmarks —
   * `03 §1` routes purely on that flag.
   */
  toolbarId?: string;
}

/** Convert the live tree into the pure file model (ms → s, ids dropped). */
export function toBookmarkNodes(
  nodes: readonly LiveNode[],
  options: ToNodesOptions = {},
): BookmarkNode[] {
  return nodes.map((node) => {
    const addDate = millisToSeconds(node.dateAdded);
    const isFolderNode = node.url === undefined;
    // dateGroupModified is a FOLDER field — Chrome does not set it on
    // bookmarks, and our HTML serializer only emits LAST_MODIFIED on <H3>.
    const lastModified = isFolderNode ? millisToSeconds(node.dateGroupModified) : undefined;
    return {
      title: node.title,
      ...(!isFolderNode && { url: node.url as string }),
      ...(addDate !== undefined && { addDate }),
      ...(lastModified !== undefined && { lastModified }),
      ...(options.toolbarId !== undefined && node.id === options.toolbarId && { toolbar: true }),
      ...(isFolderNode && { children: toBookmarkNodes(node.children ?? [], options) }),
    };
  });
}

/** Flatten a live tree, parents before children. Used by dedupe and #edit. */
export function flattenLive(nodes: readonly LiveNode[], into: LiveNode[] = []): LiveNode[] {
  for (const node of nodes) {
    into.push(node);
    if (node.children !== undefined) flattenLive(node.children, into);
  }
  return into;
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

export async function move(
  id: string,
  destination: { parentId?: string; index?: number },
): Promise<void> {
  await guard('bookmarks.move', () => browser.bookmarks.move(id, destination));
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
}

type Listenable<T extends unknown[]> = {
  addListener: (fn: (...args: T) => void) => void;
  removeListener: (fn: (...args: T) => void) => void;
};

/**
 * Subscribe to bookmark changes; returns an unsubscribe function.
 *
 * Listeners attach on tab enter and detach on leave (docs/03 §3) — an #edit
 * tab left subscribed while an import runs would otherwise take one event per
 * created node.
 */
export function subscribe(handlers: BookmarkEvents): () => void {
  const api = browser.bookmarks as unknown as {
    onCreated: Listenable<[string, LiveNode]>;
    onRemoved: Listenable<[string, unknown]>;
    onChanged: Listenable<[string, { title?: string; url?: string }]>;
    onMoved: Listenable<[string, { parentId: string; index: number }]>;
  };

  const onCreated = (id: string, node: LiveNode): void => {
    handlers.onCreated(id, node);
  };
  const onRemoved = (id: string): void => {
    handlers.onRemoved(id);
  };
  const onChanged = (id: string, changes: { title?: string; url?: string }): void => {
    handlers.onChanged(id, changes);
  };
  const onMoved = (id: string, info: { parentId: string; index: number }): void => {
    handlers.onMoved(id, info);
  };

  api.onCreated.addListener(onCreated);
  api.onRemoved.addListener(onRemoved);
  api.onChanged.addListener(onChanged);
  api.onMoved.addListener(onMoved);

  return () => {
    api.onCreated.removeListener(onCreated);
    api.onRemoved.removeListener(onRemoved);
    api.onChanged.removeListener(onChanged);
    api.onMoved.removeListener(onMoved);
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
