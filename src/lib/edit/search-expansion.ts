/**
 * Track which folders a *search* opened, separately from the ones the user
 * opened — docs/03 §3.
 *
 * Purpose: let the tree collapse back when the search box is cleared, without
 *   closing anything the user opened by hand.
 * Inputs: the current expanded set, the ids a search wants open, and the ids
 *   this module opened last time.
 * Guarantees: pure, and never returns a new Set when nothing changed, so the
 *   `$effect` driving it does not thrash.
 *
 * Why the search merges into `expanded` at all: a render-time union of the two
 * sets made the disclosure button and ArrowLeft dead on every search-expanded
 * folder, because `toggle()` had nothing it could write to. The merge is
 * deliberate; what was missing was the un-merge, so one character typed into
 * the search box permanently expanded most of a large tree — and clearing the
 * box then rendered every one of those rows at once, with no virtualization.
 */

export interface MergeResult {
  expanded: ReadonlySet<string>;
  /** Ids this module opened, to be closed again when the search clears. */
  opened: ReadonlySet<string>;
}

/**
 * Open everything the search needs, remembering what was not already open.
 *
 * @param expanded ids currently expanded
 * @param wanted ids the search needs expanded
 * @param opened ids a previous merge opened and has not yet collapsed
 */
export function mergeSearchExpansion(
  expanded: ReadonlySet<string>,
  wanted: ReadonlySet<string>,
  opened: ReadonlySet<string>,
): MergeResult {
  const missing = [...wanted].filter((id) => !expanded.has(id));
  // Identity is preserved when there is nothing to do — the caller stores these
  // in `$state`, and reassigning an equal Set would re-run every dependent.
  if (missing.length === 0) return { expanded, opened };
  return {
    expanded: new Set([...expanded, ...missing]),
    opened: new Set([...opened, ...missing]),
  };
}

/**
 * Close only what the search opened.
 *
 * A folder the user expanded themselves stays open even if the search also
 * needed it — `forget` removes it from the search-owned set the moment they
 * touch it, so ownership is decided at the point of interaction rather than
 * guessed at collapse time.
 */
export function collapseSearchExpansion(
  expanded: ReadonlySet<string>,
  opened: ReadonlySet<string>,
): ReadonlySet<string> {
  if (opened.size === 0) return expanded;
  const next = new Set(expanded);
  for (const id of opened) next.delete(id);
  return next;
}

/** The user toggled this folder, so the search no longer owns it. */
export function forgetSearchExpansion(
  opened: ReadonlySet<string>,
  id: string,
): ReadonlySet<string> {
  if (!opened.has(id)) return opened;
  const next = new Set(opened);
  next.delete(id);
  return next;
}
