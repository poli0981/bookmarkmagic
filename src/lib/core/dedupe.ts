/**
 * Duplicate handling — docs/05 §3.
 *
 * Purpose: drop bookmarks the user already has, and collapse repeats within
 *   one file, keeping the two causes countable separately.
 * Inputs: a parsed tree plus an index built from the current browser tree.
 * Guarantees: pure; folders are preserved even when every child is dropped.
 */
import { type BookmarkNode, isFolder } from './model';
import { normalizeUrl } from './normalize-url';

export type UrlIndex = ReadonlySet<string>;

/** Build the comparison index from a tree (normally the live browser tree). */
export function buildUrlIndex(roots: readonly BookmarkNode[]): Set<string> {
  const index = new Set<string>();
  const walk = (nodes: readonly BookmarkNode[]): void => {
    for (const node of nodes) {
      if (node.url !== undefined) index.add(normalizeUrl(node.url));
      if (node.children !== undefined) walk(node.children);
    }
  };
  walk(roots);
  return index;
}

export interface DedupeResult {
  nodes: BookmarkNode[];
  /** Dropped because the URL is already in the browser. */
  skippedExisting: number;
  /** Dropped because the URL repeats within this file. */
  skippedInFile: number;
}

/**
 * Filter an import tree against the browser index.
 *
 * Pass an EMPTY index for Replace mode: the browser tree is deleted before the
 * write, so nothing can already exist, and using the live index would skip
 * every bookmark of a user restoring their own backup (docs/05 §3).
 *
 * Folders that become empty are KEPT — the user's folder structure is the
 * point, and the report states how many bookmarks were skipped.
 */
export function dedupeAgainst(roots: readonly BookmarkNode[], index: UrlIndex): DedupeResult {
  const seenInFile = new Set<string>();
  let skippedExisting = 0;
  let skippedInFile = 0;

  const copy = (nodes: readonly BookmarkNode[]): BookmarkNode[] => {
    const out: BookmarkNode[] = [];
    for (const node of nodes) {
      if (isFolder(node)) {
        out.push({ ...node, children: copy(node.children ?? []) });
        continue;
      }
      const key = normalizeUrl(node.url as string);
      if (index.has(key)) {
        skippedExisting++;
        continue;
      }
      if (seenInFile.has(key)) {
        skippedInFile++;
        continue;
      }
      seenInFile.add(key);
      out.push({ ...node });
    }
    return out;
  };

  return { nodes: copy(roots), skippedExisting, skippedInFile };
}

export interface DuplicateGroup<T> {
  key: string;
  nodes: T[];
}

/**
 * Group nodes sharing a normalized URL, largest group first. Used by the
 * #edit duplicate panel over the LIVE tree, so `T` carries an `id` there.
 */
export function findDuplicateGroups<T extends { url?: string }>(
  nodes: readonly T[],
): DuplicateGroup<T>[] {
  const groups = new Map<string, T[]>();
  for (const node of nodes) {
    if (node.url === undefined) continue;
    const key = normalizeUrl(node.url);
    const bucket = groups.get(key);
    if (bucket === undefined) groups.set(key, [node]);
    else bucket.push(node);
  }
  return [...groups]
    .filter(([, bucket]) => bucket.length > 1)
    .map(([key, bucket]) => ({ key, nodes: bucket }))
    .sort((a, b) => b.nodes.length - a.nodes.length);
}
