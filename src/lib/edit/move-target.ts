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
