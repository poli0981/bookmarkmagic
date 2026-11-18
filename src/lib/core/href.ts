/**
 * What a bookmark address is worth importing — docs/04 §1.2, docs/05 §1.
 *
 * Purpose: one verdict for every reader, decided BEFORE anything is written.
 * Inputs: an address exactly as it appeared in the file.
 * Guarantees: pure, never throws. Addresses that pass are stored verbatim —
 *   `javascript:` and `data:` included (docs/09 T3: the user's data, not ours to
 *   censor; they are never rendered as links).
 */

import { type BookmarkNode, computeStats, isFolder, type ParseResult } from './model';

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

/** Bookmarks under `nodes` whose address is longer than `max`, removed. */
function withoutLongUrls(
  nodes: readonly BookmarkNode[],
  max: number,
  dropped: { count: number },
): BookmarkNode[] {
  const out: BookmarkNode[] = [];
  for (const node of nodes) {
    if (!isFolder(node)) {
      if ((node.url ?? '').length > max) dropped.count++;
      else out.push(node);
      continue;
    }
    out.push({ ...node, children: withoutLongUrls(node.children ?? [], max, dropped) });
  }
  return out;
}

/**
 * Drop the bookmarks a browser would refuse for their length — docs/04 §1.2.
 *
 * Firefox refuses an address longer than 65 536 characters, and refuses it in
 * the middle of a write, possibly after a Replace has cleared the tree. The
 * browser layer passes its limit; Chromium has none and passes `undefined`,
 * which returns the result untouched. Applied once after parsing, so every
 * format meets one rule, and before the preview, so its counts include it.
 */
export function capUrlLength(result: ParseResult, max: number | undefined): ParseResult {
  if (max === undefined) return result;
  const dropped = { count: 0 };
  const roots = withoutLongUrls(result.roots, max, dropped);
  if (dropped.count === 0) return result;
  return {
    roots,
    stats: computeStats(roots),
    warnings: [...result.warnings, { code: 'URL_TOO_LONG', count: dropped.count }],
  };
}
