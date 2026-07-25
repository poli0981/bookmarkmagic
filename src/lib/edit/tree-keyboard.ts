/**
 * WAI-ARIA tree keyboard navigation — docs/06 §5.
 *
 * Purpose: decide what a keypress does to the focused row, given the tree's
 *   flattened visible order. Pure, so the whole keyboard contract is testable
 *   without mounting a component.
 * Guarantees: no DOM access; the caller applies the returned action.
 */
import type { EditNode } from './patch-tree';

export interface VisibleRow {
  node: EditNode;
  depth: number;
  parentId: string | undefined;
  expandable: boolean;
  expanded: boolean;
}

export type TreeAction =
  | { kind: 'focus'; id: string }
  | { kind: 'expand'; id: string }
  | { kind: 'collapse'; id: string }
  | { kind: 'activate'; id: string }
  | { kind: 'rename'; id: string }
  | { kind: 'delete'; id: string }
  | { kind: 'none' };

const NONE: TreeAction = { kind: 'none' };

/** Flatten the tree into the rows actually on screen, in visual order. */
export function visibleRows(
  roots: readonly EditNode[],
  expanded: ReadonlySet<string>,
  visible?: ReadonlySet<string>,
): VisibleRow[] {
  const rows: VisibleRow[] = [];
  const walk = (nodes: readonly EditNode[], depth: number, parentId: string | undefined): void => {
    for (const node of nodes) {
      if (visible !== undefined && !visible.has(node.id)) continue;
      const children = node.children ?? [];
      const isOpen = expanded.has(node.id);
      rows.push({
        node,
        depth,
        parentId,
        expandable: node.url === undefined && children.length > 0,
        expanded: isOpen,
      });
      if (isOpen) walk(children, depth + 1, node.id);
    }
  };
  walk(roots, 1, undefined);
  return rows;
}

/**
 * Resolve a keypress against the visible rows.
 *
 * Follows the WAI-ARIA tree pattern: → opens a closed folder or steps into an
 * open one; ← closes an open folder or steps out to the parent. Type-ahead
 * jumps to the next row starting with the typed letter, wrapping around.
 */
export function resolveKey(
  key: string,
  focusedId: string | undefined,
  rows: readonly VisibleRow[],
): TreeAction {
  if (rows.length === 0) return NONE;
  const index = rows.findIndex((row) => row.node.id === focusedId);
  const current = index === -1 ? undefined : rows[index];

  switch (key) {
    case 'ArrowDown':
      return focusAt(rows, index === -1 ? 0 : index + 1);
    case 'ArrowUp':
      return focusAt(rows, index === -1 ? rows.length - 1 : index - 1);
    case 'Home':
      return focusAt(rows, 0);
    case 'End':
      return focusAt(rows, rows.length - 1);
    case 'ArrowRight': {
      if (current === undefined) return NONE;
      if (current.expandable && !current.expanded) return { kind: 'expand', id: current.node.id };
      if (current.expanded) return focusAt(rows, index + 1);
      return NONE;
    }
    case 'ArrowLeft': {
      if (current === undefined) return NONE;
      if (current.expandable && current.expanded) return { kind: 'collapse', id: current.node.id };
      if (current.parentId !== undefined) return { kind: 'focus', id: current.parentId };
      return NONE;
    }
    case 'Enter':
      return current === undefined ? NONE : { kind: 'activate', id: current.node.id };
    case 'F2':
      return current === undefined ? NONE : { kind: 'rename', id: current.node.id };
    case 'Delete':
      return current === undefined ? NONE : { kind: 'delete', id: current.node.id };
    default:
      return key.length === 1 ? typeAhead(key, index, rows) : NONE;
  }
}

function focusAt(rows: readonly VisibleRow[], index: number): TreeAction {
  const row = rows[Math.max(0, Math.min(index, rows.length - 1))];
  return row === undefined ? NONE : { kind: 'focus', id: row.node.id };
}

/** Next row whose title starts with `letter`, searching forward and wrapping. */
function typeAhead(letter: string, from: number, rows: readonly VisibleRow[]): TreeAction {
  const needle = letter.toLowerCase();
  for (let step = 1; step <= rows.length; step++) {
    const row = rows[(Math.max(from, 0) + step) % rows.length];
    if (row?.node.title.toLowerCase().startsWith(needle) === true) {
      return { kind: 'focus', id: row.node.id };
    }
  }
  return NONE;
}
