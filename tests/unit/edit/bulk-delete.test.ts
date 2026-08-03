import { describe, expect, it, vi } from 'vitest';
import { deleteEach } from '@/lib/edit/bulk-delete';

/**
 * Bulk delete — docs/03 §3.
 *
 * `deleteEach` exists to make the project's recurring defect shape impossible
 * here: mutate local state optimistically, await a `chrome.*` call that can
 * reject, never handle the rejection. It never throws, so the caller cannot
 * forget the failure case, and it reports how far it got — the confirmation
 * dialog promised an exact number and the action cannot be undone.
 */
describe('deleteEach', () => {
  it('deletes every id and reports a clean run', async () => {
    const removed: string[] = [];
    const outcome = await deleteEach(
      ['a', 'b', 'c'],
      async () => {},
      (id) => removed.push(id),
    );

    expect(outcome).toEqual({ deleted: 3, total: 3 });
    expect(removed).toEqual(['a', 'b', 'c']);
  });

  it('stops at the first rejection and says how many landed', async () => {
    const remove = vi.fn(async (id: string) => {
      if (id === 'c') throw new Error('nope');
    });
    const outcome = await deleteEach(['a', 'b', 'c', 'd'], remove, () => {});

    expect(outcome.deleted).toBe(2);
    expect(outcome.total).toBe(4);
    expect(outcome.error).toBeInstanceOf(Error);
    // 'd' is never attempted — one refusal usually means the rest will refuse
    // too, and hammering the API would just lengthen a frozen tab.
    expect(remove).toHaveBeenCalledTimes(3);
  });

  it('never throws, whatever the remove does', async () => {
    await expect(
      deleteEach(
        ['a'],
        () => Promise.reject(new Error('boom')),
        () => {},
      ),
    ).resolves.toMatchObject({ deleted: 0 });

    await expect(
      deleteEach(
        ['a'],
        () => Promise.reject('a string'),
        () => {},
      ),
    ).resolves.toMatchObject({ deleted: 0, error: 'a string' });
  });

  it('confirms locally only after the browser accepted', async () => {
    // The other order is the defect: updating first leaves the tree claiming a
    // node is gone that the browser still has, for every id after a failure.
    const confirmed: string[] = [];
    await deleteEach(
      ['a', 'b'],
      async (id) => {
        if (id === 'a') throw new Error('refused');
      },
      (id) => confirmed.push(id),
    );
    expect(confirmed).toEqual([]);
  });

  it('handles an empty list', async () => {
    expect(
      await deleteEach(
        [],
        async () => {},
        () => {},
      ),
    ).toEqual({ deleted: 0, total: 0 });
  });
});
