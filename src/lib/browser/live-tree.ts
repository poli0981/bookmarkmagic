/**
 * The live bookmark tree as the browser reports it — docs/02 §4.
 *
 * Purpose: the pure half of the bookmarks adapter — the node shape, Firefox's
 *   separators, the counts, and the conversion into the file model. No
 *   browser call lives here, so every line is tested directly.
 * Guarantees: separators are recognised by `type` alone. Firefox gives them
 *   `url: "data:"`, so every "has a url, so it is a bookmark" test in the code
 *   would otherwise count, export, dedupe and open them as bookmarks.
 */
import type { BookmarkNode } from '../core/model';
import { millisToSeconds } from '../core/timestamps';

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
  /**
   * Chrome 134+: which permanent folder a root is ('bookmarks-bar', 'other',
   * 'mobile', 'managed'), and whether it is in the signed-in account's storage
   * rather than this device's. Both exist from the 136 floor up; Firefox has
   * neither.
   */
  folderType?: string;
  syncing?: boolean;
  /** Firefox: 'bookmark', 'folder' or 'separator'. Chromium does not send it. */
  type?: string;
  children?: LiveNode[];
}

/** A Firefox separator. By `type`, never by url: a separator's url is "data:". */
export function isSeparator(node: { type?: string }): boolean {
  return node.type === 'separator';
}

/**
 * The forest without its separators — for everything that reads bookmarks as
 * bookmarks (the dedupe index, Merge's folder matching). Untouched branches
 * are returned as they are.
 */
export function withoutSeparators(nodes: readonly LiveNode[]): LiveNode[] {
  const out: LiveNode[] = [];
  for (const node of nodes) {
    if (isSeparator(node)) continue;
    out.push(
      node.children === undefined ? node : { ...node, children: withoutSeparators(node.children) },
    );
  }
  return out;
}

export interface LiveCounts {
  bookmarks: number;
  folders: number;
  /** Firefox only; always 0 in a Chromium browser. */
  separators: number;
}

/**
 * Count what a forest holds, separators apart. Iterative: Other Bookmarks can
 * hold 100k children, and the live tree has no depth cap.
 */
export function countLive(nodes: readonly LiveNode[]): LiveCounts {
  const counts: LiveCounts = { bookmarks: 0, folders: 0, separators: 0 };
  const stack: LiveNode[] = [];
  for (const node of nodes) stack.push(node);
  while (stack.length > 0) {
    const node = stack.pop();
    if (node === undefined) break;
    if (isSeparator(node)) counts.separators++;
    else if (node.url === undefined) counts.folders++;
    else counts.bookmarks++;
    for (const child of node.children ?? []) stack.push(child);
  }
  return counts;
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
  /**
   * Ids of Other and Mobile Bookmarks, and of Firefox's Bookmarks Menu,
   * marked `root: 'other'`/`'mobile'`/`'menu'` for the same reason: without
   * them a restore nested each one level too deep.
   */
  otherId?: string;
  mobileId?: string;
  menuId?: string;
}

function markerOf(id: string, options: ToNodesOptions): Pick<BookmarkNode, 'toolbar' | 'root'> {
  if (id === options.toolbarId) return { toolbar: true };
  if (id === options.otherId) return { root: 'other' };
  if (id === options.mobileId) return { root: 'mobile' };
  if (id === options.menuId) return { root: 'menu' };
  return {};
}

/**
 * Convert the live tree into the pure file model (ms → s, ids dropped).
 * Separators are left out: no format BookmarkMagic writes can hold one
 * (docs/04).
 */
export function toBookmarkNodes(
  nodes: readonly LiveNode[],
  options: ToNodesOptions = {},
): BookmarkNode[] {
  const out: BookmarkNode[] = [];
  for (const node of nodes) {
    if (isSeparator(node)) continue;
    const addDate = millisToSeconds(node.dateAdded);
    const isFolderNode = node.url === undefined;
    // dateGroupModified is a FOLDER field — Chrome does not set it on
    // bookmarks, and our HTML serializer only emits LAST_MODIFIED on <H3>.
    const lastModified = isFolderNode ? millisToSeconds(node.dateGroupModified) : undefined;
    out.push({
      title: node.title,
      ...(node.url !== undefined && { url: node.url }),
      ...(addDate !== undefined && { addDate }),
      ...(lastModified !== undefined && { lastModified }),
      ...(isFolderNode && markerOf(node.id, options)),
      ...(isFolderNode && { children: toBookmarkNodes(node.children ?? [], options) }),
    });
  }
  return out;
}

/**
 * How a browser counts `bookmarks.move`'s index for a move inside one folder
 * (docs/05 §10). Chromium counts as if the node were still in place; Firefox
 * counts after removing it, because Places stores the final position. Moving
 * `a` after `c` in `[a, b, c]` is index 3 in Chrome and 2 in Firefox — and
 * sending Chrome's number to Firefox made every rightward drag land one place
 * too far and Alt+↓ move two places.
 */
export type MoveIndexRule = 'chromium' | 'firefox';

/** Where a node goes: a folder, and optionally a place in it counted both ways (`planDrop`). */
export interface MoveDestination {
  parentId?: string;
  /** `api` counted before the node's removal (Chromium's rule), `local` after it. */
  position?: { api: number; local: number };
}

/** The index to send under a browser's rule. */
export function moveIndexFor(
  position: { api: number; local: number },
  rule: MoveIndexRule,
): number {
  return rule === 'firefox' ? position.local : position.api;
}

/** Flatten a live tree, parents before children. Used by dedupe and #edit. */
export function flattenLive(nodes: readonly LiveNode[], into: LiveNode[] = []): LiveNode[] {
  for (const node of nodes) {
    into.push(node);
    if (node.children !== undefined) flattenLive(node.children, into);
  }
  return into;
}
