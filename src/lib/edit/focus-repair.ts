/**
 * Where focus goes when its row leaves the screen — docs/06 §5.
 *
 * Purpose: keep `aria-activedescendant` on a rendered row. A move into a
 *   collapsed folder, "Collapse all", a search, or a delete in another tab can
 *   each take the focused row off screen; the tree then pointed at nothing,
 *   and the next ↓ jumped to the top (v1.1.0 review).
 * Inputs: the tree, or an index of it, and the set of ids on screen.
 * Guarantees: pure and iterative — the live tree has no depth cap.
 */
import type { EditNode } from './patch-tree';

/** Every node's parent id. Roots map to `undefined`. */
export function parentIndex(roots: readonly EditNode[]): Map<string, string | undefined> {
  const parents = new Map<string, string | undefined>();
  const stack: { node: EditNode; parent: string | undefined }[] = roots.map((node) => ({
    node,
    parent: undefined,
  }));
  for (let entry = stack.pop(); entry !== undefined; entry = stack.pop()) {
    parents.set(entry.node.id, entry.parent);
    for (const child of entry.node.children ?? [])
      stack.push({ node: child, parent: entry.node.id });
  }
  return parents;
}

/**
 * The closest folder above `id` that is on screen, or `undefined` when none is.
 *
 * @param parents an index that still holds `id` — for a node that was just
 *   deleted, the index from before the delete.
 */
export function nearestShownAncestor(
  id: string,
  parents: ReadonlyMap<string, string | undefined>,
  shown: ReadonlySet<string>,
): string | undefined {
  let up = parents.get(id);
  // Bounded by the index size, so even a corrupt index cannot hang the tab.
  for (let steps = 0; up !== undefined && steps < parents.size; steps++) {
    if (shown.has(up)) return up;
    up = parents.get(up);
  }
  return undefined;
}
