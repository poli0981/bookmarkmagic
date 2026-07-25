/**
 * Live-tree patching — docs/03 §3 "Live sync".
 *
 * Purpose: apply `chrome.bookmarks` events to the in-memory tree so external
 *   changes (another window, a sync push, or our own import) appear without a
 *   reload.
 * Inputs: the current roots plus one event payload.
 * Guarantees: pure and immutable — every patch returns a new array, with
 *   untouched branches shared by reference so Svelte only re-renders the path
 *   that actually changed. Unknown ids are no-ops rather than throws: events
 *   for nodes outside our view (or already removed) arrive routinely.
 */

export interface EditNode {
  id: string;
  parentId?: string;
  index?: number;
  title: string;
  url?: string;
  dateAdded?: number;
  unmodifiable?: string;
  children?: EditNode[];
}

const isFolder = (node: EditNode): boolean => node.url === undefined;

/** Map over a node's children, returning the original array when nothing changed. */
function mapChildren(
  node: EditNode,
  fn: (children: EditNode[]) => EditNode[] | undefined,
): EditNode {
  const children = node.children;
  if (children === undefined) return node;
  const next = fn(children);
  return next === undefined ? node : { ...node, children: next };
}

/** Insert `node` under `parentId` at `index` (or append when out of range). */
export function insertNode(
  roots: readonly EditNode[],
  parentId: string,
  index: number | undefined,
  node: EditNode,
): EditNode[] {
  let inserted = false;

  const walk = (nodes: readonly EditNode[]): EditNode[] | undefined => {
    let changed = false;
    const out = nodes.map((current) => {
      if (current.id === parentId && isFolder(current)) {
        const children = [...(current.children ?? [])];
        const at =
          index === undefined || index < 0 || index > children.length ? children.length : index;
        children.splice(at, 0, node);
        inserted = true;
        changed = true;
        return { ...current, children };
      }
      const patched = mapChildren(current, walk);
      if (patched !== current) changed = true;
      return patched;
    });
    return changed ? out : undefined;
  };

  const next = walk(roots);
  // A parent we do not hold (e.g. a hidden root) simply drops the event.
  return inserted && next !== undefined ? next : [...roots];
}

/** Remove a node and its subtree. */
export function removeNode(roots: readonly EditNode[], id: string): EditNode[] {
  let removed = false;

  const walk = (nodes: readonly EditNode[]): EditNode[] | undefined => {
    if (nodes.some((node) => node.id === id)) {
      removed = true;
      return nodes.filter((node) => node.id !== id);
    }
    let changed = false;
    const out = nodes.map((node) => {
      const patched = mapChildren(node, walk);
      if (patched !== node) changed = true;
      return patched;
    });
    return changed ? out : undefined;
  };

  const next = walk(roots);
  return removed && next !== undefined ? next : [...roots];
}

/** Apply a title/url change in place (immutably). */
export function changeNode(
  roots: readonly EditNode[],
  id: string,
  changes: { title?: string; url?: string },
): EditNode[] {
  const walk = (nodes: readonly EditNode[]): EditNode[] | undefined => {
    let changed = false;
    const out = nodes.map((node) => {
      if (node.id === id) {
        changed = true;
        return {
          ...node,
          ...(changes.title !== undefined && { title: changes.title }),
          ...(changes.url !== undefined && { url: changes.url }),
        };
      }
      const patched = mapChildren(node, walk);
      if (patched !== node) changed = true;
      return patched;
    });
    return changed ? out : undefined;
  };

  return walk(roots) ?? [...roots];
}

/** Find a node anywhere in the tree. */
export function findNode(roots: readonly EditNode[], id: string): EditNode | undefined {
  for (const node of roots) {
    if (node.id === id) return node;
    const found = findNode(node.children ?? [], id);
    if (found !== undefined) return found;
  }
  return undefined;
}

/**
 * Move a node to a new parent and index.
 *
 * Removal happens first, so a move WITHIN the same parent uses indices that
 * already account for the node being gone — which is what `onMoved` reports.
 */
export function moveNode(
  roots: readonly EditNode[],
  id: string,
  parentId: string,
  index: number | undefined,
): EditNode[] {
  const node = findNode(roots, id);
  if (node === undefined) return [...roots];
  // Moving a folder into itself would detach the subtree from the tree.
  if (findNode(node.children ?? [], parentId) !== undefined || parentId === id) return [...roots];

  const without = removeNode(roots, id);
  return insertNode(without, parentId, index, { ...node, parentId });
}
