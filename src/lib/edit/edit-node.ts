/**
 * Pure helpers over the `#edit` tree — docs/03 §3.
 *
 * Purpose: the tree logic that used to sit inline in `EditTab.svelte`, where it
 *   was untestable and pushed the component past the docs/10 §1 size limits.
 * Inputs: `EditNode` trees, plus `LiveNode`s straight from the bookmarks API.
 * Guarantees: pure — no `chrome.*`, no Svelte, no mutation of the input.
 */
import type { LiveNode } from '../browser/bookmarks';
import type { EditNode } from './patch-tree';

/**
 * Project a live bookmark node onto the editable model.
 *
 * Absent keys are omitted rather than set to `undefined`, per the
 * `exactOptionalPropertyTypes` rule in docs/10 §2. `children` is set only for
 * folders, which is what makes `url === undefined` a reliable folder test.
 */
export function toEditNode(node: LiveNode): EditNode {
  return {
    id: node.id,
    ...(node.parentId !== undefined && { parentId: node.parentId }),
    title: node.title,
    ...(node.url !== undefined && { url: node.url }),
    ...(node.url === undefined && { children: (node.children ?? []).map(toEditNode) }),
    ...(node.unmodifiable !== undefined && { unmodifiable: node.unmodifiable }),
  };
}

/** Depth-first list of every node in the forest, parents before children. */
export function flattenTree(nodes: readonly EditNode[], into: EditNode[] = []): EditNode[] {
  for (const node of nodes) {
    into.push(node);
    flattenTree(node.children ?? [], into);
  }
  return into;
}

/**
 * Whether a node may be renamed, moved or deleted.
 *
 * Permanent roots and policy-managed nodes reject every write, so the UI must
 * not offer the affordance at all — mutating optimistically and finding out on
 * rejection is exactly how the tree ends up disagreeing with the browser.
 */
export function isEditable(roots: readonly EditNode[], node: EditNode): boolean {
  if (node.unmodifiable !== undefined) return false;
  return !roots.some((root) => root.id === node.id);
}

/**
 * Where a new folder should be created, given what is focused.
 *
 * Into the focused FOLDER, or alongside the focused bookmark. Using the focused
 * node's parent unconditionally meant selecting a root resolved to the
 * synthetic root id `"0"`, which every `create` rejects.
 *
 * Returns `undefined` when there is nowhere writable to put it.
 */
export function resolveNewFolderParent(
  roots: readonly EditNode[],
  focused: EditNode | undefined,
): string | undefined {
  const writableRoot = roots.find((root) => root.unmodifiable === undefined)?.id;
  if (focused === undefined) return writableRoot;
  // A policy-managed folder rejects every create, so falling back is the only
  // way "New folder" does anything at all while one is selected.
  if (focused.unmodifiable !== undefined) return writableRoot;
  if (focused.url === undefined) return focused.id;
  return focused.parentId ?? writableRoot;
}

/** How many nodes sit inside `node`. Drives the delete confirmation's count. */
export function countDescendants(node: EditNode | undefined): number {
  if (node === undefined) return 0;
  return flattenTree(node.children ?? []).length;
}

/** Ids to delete so one copy of each duplicated link survives. */
export function extraCopyIds(groups: readonly { nodes: readonly EditNode[] }[]): string[] {
  return groups.flatMap((group) => group.nodes.slice(1).map((node) => node.id));
}
