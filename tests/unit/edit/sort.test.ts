import { describe, expect, it, vi } from 'vitest';
import type { EditNode } from '@/lib/edit/patch-tree';
import { applySort, planSort, sortedOrder } from '@/lib/edit/sort';
import { makeRng } from '../../helpers/tree';

const b = (id: string, title: string, url = `https://${id}.example/`): EditNode => ({
  id,
  title,
  url,
});
const f = (id: string, title: string): EditNode => ({ id, title, children: [] });

/** Apply moves the way `chrome.bookmarks.move` does within one parent. */
function apply(children: readonly EditNode[], moves: { id: string; index: number }[]): string[] {
  const order = children.map((n) => n.id);
  for (const move of moves) {
    const from = order.indexOf(move.id);
    order.splice(from, 1);
    // Chrome counts a same-parent target index BEFORE removal when moving right.
    const at = move.index > from ? move.index - 1 : move.index;
    order.splice(at, 0, move.id);
  }
  return order;
}

describe('sortedOrder', () => {
  it('puts folders first, then sorts naturally, ignoring case and accents', () => {
    const order = sortedOrder(
      [b('1', 'item 10'), f('2', 'Zeta'), b('3', 'Item 2'), b('4', 'éclair'), f('5', 'alpha')],
      'en',
    );
    expect(order.map((n) => n.title)).toEqual(['alpha', 'Zeta', 'éclair', 'Item 2', 'item 10']);
  });

  it('keeps ties in their current order, and sorts untitled bookmarks by address', () => {
    const order = sortedOrder(
      [b('1', 'Same'), b('2', '', 'https://a.example/'), b('3', 'same')],
      'en',
    );
    expect(order.map((n) => n.id)).toEqual(['2', '1', '3']);
  });
});

describe('planSort', () => {
  it('moves nothing when the folder is already sorted', () => {
    expect(planSort([f('1', 'A'), b('2', 'a'), b('3', 'b')], 'en')).toEqual([]);
  });

  it('moves only what is out of place', () => {
    const moves = planSort([b('1', 'a'), b('2', 'c'), b('3', 'b')], 'en');
    expect(moves).toEqual([{ id: '3', index: 1 }]);
  });

  it('produces a sorted folder when applied with Chrome’s index rules — 300 random folders', () => {
    const rng = makeRng(7);
    for (let round = 0; round < 300; round++) {
      const children = Array.from({ length: 1 + Math.floor(rng() * 12) }, (_, i) =>
        rng() < 0.3
          ? f(`n${i}`, `F${Math.floor(rng() * 5)}`)
          : b(`n${i}`, `T${Math.floor(rng() * 20)}`),
      );
      const expected = sortedOrder(children, 'en').map((n) => n.id);
      expect(apply(children, planSort(children, 'en'))).toEqual(expected);
    }
  });
});

describe('applySort', () => {
  const moves = Array.from({ length: 60 }, (_, i) => ({ id: `n${i}`, index: i }));

  it('applies every move in order and pauses every 25', async () => {
    const seen: string[] = [];
    const pause = vi.fn(async () => {});
    const outcome = await applySort(
      moves,
      async () => {},
      (step) => seen.push(step.id),
      pause,
    );
    expect(outcome).toEqual({ done: 60, total: 60 });
    expect(seen).toEqual(moves.map((m) => m.id));
    expect(pause).toHaveBeenCalledTimes(2);
  });

  it('stops at the first refusal, says how far it got, and never throws', async () => {
    const refusal = new Error("Can't modify the root bookmark folders.");
    const onMoved = vi.fn();
    const outcome = await applySort(
      moves,
      async (step) => {
        if (step.id === 'n3') throw refusal;
      },
      onMoved,
      async () => {},
    );
    expect(outcome).toEqual({ done: 3, total: 60, error: refusal });
    expect(onMoved).toHaveBeenCalledTimes(3);
  });
});
