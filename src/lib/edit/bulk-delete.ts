/**
 * Delete many nodes, one awaited call at a time, and report what happened —
 * docs/03 §3.
 *
 * Purpose: give the "keep the first of each" bulk delete an outcome the caller
 *   cannot forget to handle.
 * Inputs: the ids to remove, an injected remove, and a per-success callback for
 *   the optimistic local update.
 * Guarantees: **never throws.** It stops at the first rejection and returns how
 *   far it got.
 *
 * Not throwing is the point. This is the project's recurring defect shape —
 * mutate local state optimistically, await a `chrome.*` call that can reject,
 * never handle the rejection — and it lived here in its purest form: the loop
 * removed each node locally, awaited the browser, and on the first rejection
 * abandoned the rest, leaving the user with a partial delete measured against a
 * confirmation dialog that had promised an exact number.
 */

export interface BulkDeleteOutcome {
  /** How many the browser actually accepted. */
  deleted: number;
  /** How many were asked for. */
  total: number;
  /** The rejection that stopped it, if one did. */
  error?: unknown;
}

export async function deleteEach(
  ids: readonly string[],
  remove: (id: string) => Promise<void>,
  onDeleted: (id: string) => void,
): Promise<BulkDeleteOutcome> {
  let deleted = 0;
  for (const id of ids) {
    try {
      await remove(id);
    } catch (error) {
      return { deleted, total: ids.length, error };
    }
    // Only after the browser has confirmed it. Updating first would leave the
    // tree disagreeing with the browser for every id after a failure.
    onDeleted(id);
    deleted++;
  }
  return { deleted, total: ids.length };
}
