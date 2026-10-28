/**
 * What a bookmark address is worth importing — docs/04 §1.2, docs/05 §1.
 *
 * Purpose: one verdict for every reader, decided BEFORE anything is written.
 * Inputs: an address exactly as it appeared in the file.
 * Guarantees: pure, never throws. Addresses that pass are stored verbatim —
 *   `javascript:` and `data:` included (docs/09 T3: the user's data, not ours to
 *   censor; they are never rendered as links).
 */

export type HrefVerdict = 'ok' | 'missing' | 'invalid' | 'place-query';

/**
 * Classify an address.
 *
 * - `missing` — absent or blank: nothing to bookmark.
 * - `invalid` — `chrome.bookmarks.create` rejects anything it cannot parse
 *   ("Invalid URL."), and it rejects it in the MIDDLE of a write — after a
 *   Replace has already cleared the tree. Every reader skips these up front, so
 *   the preview counts them and the write never meets one. `URL.canParse` in an
 *   extension page runs the same Chromium URL library the bookmarks API does.
 * - `place-query` — a Firefox smart bookmark (`place:sort=8…`). It parses, but
 *   in Chrome it is a dead link. Browser-written formats skip it; our own
 *   formats keep it, because a backup must restore what the browser held.
 */
export function classifyHref(raw: string | null | undefined): HrefVerdict {
  if (raw === null || raw === undefined) return 'missing';
  const trimmed = raw.trim();
  if (trimmed === '') return 'missing';
  if (!URL.canParse(trimmed)) return 'invalid';
  if (/^place:/i.test(trimmed)) return 'place-query';
  return 'ok';
}
