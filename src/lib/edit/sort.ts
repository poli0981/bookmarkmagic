/**
 * Sort a folder A→Z — docs/03 §3, docs/06 §3.3.
 *
 * Purpose: the moves that put one folder's children in name order, planned
 *   before anything is touched so the confirmation can say how many.
 * Inputs: the folder's children as the tree holds them, and a UI locale.
 * Guarantees: pure. Folders first, then bookmarks, each by `Intl.Collator`
 *   (numeric, so "Item 2" precedes "Item 10"; accents and case ignored); ties
 *   keep their current order. Only children that are out of place move, and
 *   the indices are valid for `chrome.bookmarks.move` applied in order.
 */
import type { EditNode } from './patch-tree';

export interface SortMove {
  id: string;
  /** Target index within the same parent, valid at the moment the move runs. */
  index: number;
}

/** What a child sorts by: an untitled bookmark by its address, as Chrome shows it. */
function sortKey(node: EditNode): string {
  return node.title.trim() === '' && node.url !== undefined ? node.url : node.title;
}

/** The children in sorted order, without moving anything. */
export function sortedOrder(children: readonly EditNode[], locale: string): EditNode[] {
  const collator = new Intl.Collator(locale, { numeric: true, sensitivity: 'base' });
  return children
    .map((node, position) => ({ node, position }))
    .sort((a, b) => {
      const aFolder = a.node.url === undefined;
      const bFolder = b.node.url === undefined;
      if (aFolder !== bFolder) return aFolder ? -1 : 1;
      return collator.compare(sortKey(a.node), sortKey(b.node)) || a.position - b.position;
    })
    .map(({ node }) => node);
}

/**
 * The moves, left to right: each fills the next position with the child that
 * belongs there. Every move takes a child from further right, so moving it to
 * `index` lands it exactly there — the case where `chrome.bookmarks.move`'s
 * same-parent indices need no adjustment.
 */
export function planSort(children: readonly EditNode[], locale: string): SortMove[] {
  const target = sortedOrder(children, locale);
  const current = [...children];
  const moves: SortMove[] = [];
  for (const [index, wanted] of target.entries()) {
    if (current[index]?.id === wanted.id) continue;
    const from = current.findIndex((node) => node.id === wanted.id);
    current.splice(from, 1);
    current.splice(index, 0, wanted);
    moves.push({ id: wanted.id, index });
  }
  return moves;
}

export interface SortOutcome {
  /** How many moves the browser accepted. */
  done: number;
  total: number;
  /** The refusal that stopped it, if one did. */
  error?: unknown;
}

const YIELD_EVERY = 25;

/**
 * Apply the moves in order, one awaited move at a time, pausing now and then
 * so the tab stays responsive. Never throws — like `deleteEach`, it stops at
 * the first refusal and says how far it got, because sorting has no undo.
 */
export async function applySort(
  moves: readonly SortMove[],
  move: (step: SortMove) => Promise<void>,
  onMoved: (step: SortMove) => void,
  pause: () => Promise<void>,
): Promise<SortOutcome> {
  let done = 0;
  for (const step of moves) {
    try {
      await move(step);
    } catch (error) {
      return { done, total: moves.length, error };
    }
    onMoved(step);
    done++;
    if (done % YIELD_EVERY === 0) await pause();
  }
  return { done, total: moves.length };
}
