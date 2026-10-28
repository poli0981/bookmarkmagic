/**
 * Preview diff — docs/05 §5.
 *
 * Purpose: tell the user, before anything is written, which bookmarks in the
 *   file they already have.
 * Inputs: a parsed tree and an index of the current browser tree.
 * Guarantees: pure; path-insensitive, matching the question users actually
 *   ask ("do I already have this link?").
 */
import type { UrlIndex } from './dedupe';
import { type BookmarkNode, isFolder } from './model';
import { normalizeUrl } from './normalize-url';

export type NodeStatus = 'new' | 'exists';

export interface DiffResult {
  /** Distinct-per-node counts: a URL appearing 3x in the file counts 3 times. */
  newCount: number;
  existsCount: number;
  /** Per-node badge source for the preview tree. */
  status: WeakMap<BookmarkNode, NodeStatus>;
}

export function diffAgainstBrowser(roots: readonly BookmarkNode[], index: UrlIndex): DiffResult {
  const status = new WeakMap<BookmarkNode, NodeStatus>();
  let newCount = 0;
  let existsCount = 0;

  const walk = (nodes: readonly BookmarkNode[]): void => {
    for (const node of nodes) {
      if (isFolder(node)) {
        walk(node.children ?? []);
        continue;
      }
      const exists = index.has(normalizeUrl(node.url as string));
      status.set(node, exists ? 'exists' : 'new');
      if (exists) existsCount++;
      else newCount++;
    }
  };

  walk(roots);
  return { newCount, existsCount, status };
}
