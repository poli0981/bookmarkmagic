/**
 * Tree search — docs/05 §8.
 *
 * Purpose: filter the edit tree to matches plus their ancestors, so a hit deep
 *   in the tree is reachable without losing its context.
 * Inputs: any tree of `{ id, title, url?, children? }`; a query string.
 * Guarantees: pure; case-insensitive substring over `title + ' ' + url`.
 *   O(n) per keystroke, which is fine at our 100k cap — no fuzzy matching in
 *   v1 (zero-dependency rule).
 */

export interface SearchableNode {
  id: string;
  title: string;
  url?: string;
  children?: SearchableNode[];
}

export interface SearchResult {
  /** Ids that matched the query themselves. */
  matched: Set<string>;
  /** Matches plus every ancestor of a match — the set to render. */
  visible: Set<string>;
  /** Ancestors of matches, which must be auto-expanded to reveal the hits. */
  expand: Set<string>;
}

function matches(node: SearchableNode, needle: string): boolean {
  // One haystack, not two fields tested separately — docs/05 §8 defines it as
  // `title + ' ' + url`, so a query spanning the boundary still matches.
  const haystack = `${node.title} ${node.url ?? ''}`.toLowerCase();
  return haystack.includes(needle);
}

/**
 * Find nodes matching `query`.
 *
 * An empty or whitespace-only query returns empty sets, which callers read as
 * "no filter active" — distinct from "no results", where `matched` is empty
 * but the query is not.
 */
export function searchTree(roots: readonly SearchableNode[], query: string): SearchResult {
  const needle = query.trim().toLowerCase();
  if (needle === '') return { matched: new Set(), visible: new Set(), expand: new Set() };

  const matched = new Set<string>();
  const visible = new Set<string>();
  const expand = new Set<string>();

  const walk = (nodes: readonly SearchableNode[], ancestors: readonly string[]): boolean => {
    let anyHere = false;
    for (const node of nodes) {
      const self = matches(node, needle);
      const trail = [...ancestors, node.id];
      const below = walk(node.children ?? [], trail);

      if (self) {
        matched.add(node.id);
        // A matching folder shows its contents, so the user can act on them.
        for (const id of subtree(node)) visible.add(id);
      }
      if (self || below) {
        visible.add(node.id);
        for (const id of ancestors) {
          visible.add(id);
          expand.add(id);
        }
        // A folder that only matched via a descendant must open to show it.
        if (below) expand.add(node.id);
        anyHere = true;
      }
    }
    return anyHere;
  };

  walk(roots, []);
  return { matched, visible, expand };
}

function subtree(node: SearchableNode): string[] {
  const ids: string[] = [];
  const walk = (current: SearchableNode): void => {
    ids.push(current.id);
    for (const child of current.children ?? []) walk(child);
  };
  walk(node);
  return ids;
}
