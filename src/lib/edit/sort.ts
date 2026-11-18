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

/** One run of children between separators, sorted: folders first, then by name. */
function sortRun(run: readonly { node: EditNode; position: number }[], collator: Intl.Collator) {
  return [...run]
    .sort((a, b) => {
      const aFolder = a.node.url === undefined;
      const bFolder = b.node.url === undefined;
      if (aFolder !== bFolder) return aFolder ? -1 : 1;
      return collator.compare(sortKey(a.node), sortKey(b.node)) || a.position - b.position;
    })
    .map(({ node }) => node);
}

/**
 * The children in sorted order, without moving anything.
 *
 * Firefox's separators split a folder into runs the user made on purpose, so
 * each run is sorted on its own and every separator keeps its place (docs/05
 * §10). Chromium has no separators: one run, as before.
 */
export function sortedOrder(children: readonly EditNode[], locale: string): EditNode[] {
  const collator = new Intl.Collator(locale, { numeric: true, sensitivity: 'base' });
  const out: EditNode[] = [];
  // A loop, not push(...spread): a folder can hold 100k children.
  const flush = (items: readonly { node: EditNode; position: number }[]): void => {
    for (const node of sortRun(items, collator)) out.push(node);
  };
  let run: { node: EditNode; position: number }[] = [];
  for (const [position, node] of children.entries()) {
    if (node.separator === true) {
      flush(run);
      out.push(node);
      run = [];
    } else {
      run.push({ node, position });
    }
  }
  flush(run);
  return out;
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
