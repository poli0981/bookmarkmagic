/**
 * Move destinations — docs/03 §3 "Move", docs/06 §3.3.
 *
 * Purpose: the folder list behind "Move to…", and the rule for whether a drop
 *   is legal. Pure, so the DnD and keyboard paths share one definition of
 *   validity rather than drifting apart.
 */

import type { EditNode } from './patch-tree';
import { findNode } from './patch-tree';

export interface MoveTarget {
  id: string;
  /** Indented display path, e.g. "Bookmarks bar / Dev". */
  label: string;
  depth: number;
}

/**
 * Every folder a node may be moved into.
 *
 * Excludes the node itself, its own descendants (which would detach the
 * subtree), its current parent (a no-op), and anything policy-managed.
 */
export function moveTargets(
  roots: readonly EditNode[],
  moving: EditNode | undefined,
): MoveTarget[] {
  const targets: MoveTarget[] = [];
  const forbidden = new Set<string>();
  if (moving !== undefined) {
    forbidden.add(moving.id);
    const walk = (node: EditNode): void => {
      forbidden.add(node.id);
      for (const child of node.children ?? []) walk(child);
    };
    walk(moving);
  }

  const collect = (nodes: readonly EditNode[], trail: string[], depth: number): void => {
    for (const node of nodes) {
      if (node.url !== undefined) continue;
      if (node.unmodifiable !== undefined) continue;
      const label = [...trail, node.title];
      if (!forbidden.has(node.id) && node.id !== moving?.parentId) {
        targets.push({ id: node.id, label: label.join(' / '), depth });
      }
      collect(node.children ?? [], label, depth + 1);
    }
  };

  collect(roots, [], 1);
  return targets;
}

/** True when `movingId` may be dropped into `targetId`. */
export function canMoveInto(
  roots: readonly EditNode[],
  movingId: string,
  targetId: string,
): boolean {
  if (movingId === targetId) return false;
  const target = findNode(roots, targetId);
  if (target === undefined || target.url !== undefined) return false;
  if (target.unmodifiable !== undefined) return false;

  const moving = findNode(roots, movingId);
  if (moving === undefined) return false;
  // Dropping a folder inside itself would detach the whole subtree.
  return findNode(moving.children ?? [], targetId) === undefined;
}

/** Where on a row a drag is released: the upper edge, the middle, the lower edge. */
export type DropZone = 'before' | 'into' | 'after';

/**
 * The zone under the pointer, from how far down the row it is (0 = top edge,
 * 1 = bottom edge): the upper quarter is "before", the lower quarter "after",
 * and the middle "into" — for a folder; a bookmark splits at half.
 */
export function zoneFor(fraction: number, isFolder: boolean): DropZone {
  if (isFolder && fraction > 0.25 && fraction < 0.75) return 'into';
  return fraction < 0.5 ? 'before' : 'after';
}

export interface DropPlan {
  parentId: string;
  /**
   * Absent for a drop INTO a folder (appended). Otherwise the position twice:
   * `api` for `chrome.bookmarks.move`, which counts a same-parent move to the
   * right as if the node were still in place, and `local` counted after its
   * removal — what `onMoved` reports and `moveNode` takes.
   */
  position?: { api: number; local: number };
}

/**
 * Resolve a drop to a destination, or `undefined` when it is illegal or would
 * change nothing. Before/after a row means "beside it, in its folder", so the
 * permanent roots — whose parent is the synthetic root — take drops into only.
 */
export function planDrop(
  roots: readonly EditNode[],
  movingId: string,
  targetId: string,
  zone: DropZone,
): DropPlan | undefined {
  if (zone === 'into') {
    return canMoveInto(roots, movingId, targetId) ? { parentId: targetId } : undefined;
  }
  const target = findNode(roots, targetId);
  const moving = findNode(roots, movingId);
  const parentId = target?.parentId;
  if (target === undefined || moving === undefined || parentId === undefined) return undefined;
  if (movingId === targetId || !canMoveInto(roots, movingId, parentId)) return undefined;

  const siblings = findNode(roots, parentId)?.children ?? [];
  const at = siblings.findIndex((node) => node.id === targetId);
  const api = zone === 'before' ? at : at + 1;
  const from = moving.parentId === parentId ? siblings.findIndex((n) => n.id === movingId) : -1;
  // Dropping a node just before or just after itself is no move at all.
  if (from !== -1 && (api === from || api === from + 1)) return undefined;
  const local = from !== -1 && from < api ? api - 1 : api;
  return { parentId, position: { api, local } };
}
