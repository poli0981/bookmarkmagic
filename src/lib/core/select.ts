/**
 * Export scope selection — docs/03 §2 step 2, docs/06 §3.2.
 *
 * Purpose: the tri-state folder picker's model, and the filter that turns a
 *   selection into the subtree to serialize.
 * Inputs: any tree of `{ id, children? }` — generic so `core/` stays free of
 *   browser types (layer rule 1) while still operating on the live tree.
 * Guarantees: pure; selections are returned as new Sets, never mutated.
 *
 * The selection holds the *topmost* explicitly-chosen ids. A node is included
 * when it, or any ancestor, is in the set — so checking "Bookmarks bar" needs
 * one entry rather than one per descendant.
 */

export interface TreeLike {
  id: string;
  children?: TreeLike[];
}

export type CheckState = 'checked' | 'indeterminate' | 'unchecked';

function collectIds(node: TreeLike, into: Set<string>): void {
  into.add(node.id);
  for (const child of node.children ?? []) collectIds(child, into);
}

/** Every id at or below `node`, including its own. */
export function subtreeIds(node: TreeLike): Set<string> {
  const ids = new Set<string>();
  collectIds(node, ids);
  return ids;
}

/** Path of nodes from a root down to `targetId`, inclusive. Empty if absent. */
export function pathTo(roots: readonly TreeLike[], targetId: string): TreeLike[] {
  const walk = (nodes: readonly TreeLike[], trail: TreeLike[]): TreeLike[] | undefined => {
    for (const node of nodes) {
      const next = [...trail, node];
      if (node.id === targetId) return next;
      const found = walk(node.children ?? [], next);
      if (found !== undefined) return found;
    }
    return undefined;
  };
  return walk(roots, []) ?? [];
}

/** Checked when selected outright or covered by a selected ancestor. */
export function checkStateOf(
  roots: readonly TreeLike[],
  node: TreeLike,
  selection: ReadonlySet<string>,
): CheckState {
  const path = pathTo(roots, node.id);
  if (path.some((ancestor) => selection.has(ancestor.id))) return 'checked';

  for (const id of subtreeIds(node)) {
    if (id !== node.id && selection.has(id)) return 'indeterminate';
  }
  return 'unchecked';
}

/**
 * Check or uncheck a node.
 *
 * Unchecking something covered by a selected ANCESTOR is the interesting case:
 * the ancestor is expanded into its siblings-at-each-level so the rest of it
 * stays selected, and only the target is dropped. Without that, unticking one
 * folder inside a checked parent would silently do nothing.
 */
export function toggleSelection(
  roots: readonly TreeLike[],
  node: TreeLike,
  checked: boolean,
  selection: ReadonlySet<string>,
): Set<string> {
  const next = new Set(selection);
  const covered = subtreeIds(node);

  if (checked) {
    // Drop anything now redundant, then add the single covering id.
    for (const id of covered) next.delete(id);
    next.add(node.id);
    return collapseRedundant(roots, next);
  }

  const path = pathTo(roots, node.id);
  const selectedAncestor = path.find(
    (ancestor) => ancestor.id !== node.id && next.has(ancestor.id),
  );

  if (selectedAncestor !== undefined) {
    // Push the ancestor's selection down one level at a time until the target
    // is expressible on its own, then remove it.
    next.delete(selectedAncestor.id);
    let cursor = selectedAncestor;
    while (cursor.id !== node.id) {
      const nextOnPath = path[path.indexOf(cursor) + 1];
      if (nextOnPath === undefined) break;
      for (const sibling of cursor.children ?? []) {
        if (sibling.id !== nextOnPath.id) next.add(sibling.id);
      }
      cursor = nextOnPath;
    }
  }

  for (const id of covered) next.delete(id);
  return next;
}

/** Replace a fully-selected set of siblings with their parent, recursively. */
function collapseRedundant(roots: readonly TreeLike[], selection: Set<string>): Set<string> {
  const visit = (node: TreeLike): boolean => {
    if (selection.has(node.id)) return true;
    const children = node.children ?? [];
    if (children.length === 0) return false;
    const all = children.map(visit).every(Boolean);
    if (all) {
      for (const child of children) selection.delete(child.id);
      selection.add(node.id);
    }
    return all;
  };
  for (const root of roots) visit(root);
  return selection;
}

/**
 * Keep only the selected parts of a tree.
 *
 * A selected node brings its whole subtree. An unselected folder survives only
 * as a path to something selected beneath it, so exported files keep their
 * folder structure instead of flattening.
 */
export function filterBySelection<T extends { id: string; children?: T[] }>(
  nodes: readonly T[],
  selection: ReadonlySet<string>,
): T[] {
  const out: T[] = [];
  for (const node of nodes) {
    if (selection.has(node.id)) {
      out.push(node);
      continue;
    }
    if (node.children === undefined) continue;
    const children = filterBySelection(node.children, selection);
    if (children.length > 0) out.push({ ...node, children });
  }
  return out;
}
