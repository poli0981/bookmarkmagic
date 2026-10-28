/**
 * URL normalization — docs/05 §2.
 *
 * Purpose: produce a stable comparison KEY for dedupe and diff.
 * Inputs: a raw href exactly as it appeared in the file or browser tree.
 * Guarantees: never throws, never mutates stored data. The key is only ever
 *   used for comparison — the user's URL is stored verbatim.
 *
 * Explicitly NOT done: stripping `utm_*`, stripping `www.`, unifying
 * http/https. Too opinionated for a dedupe default; see the roadmap's
 * "aggressive dedupe" toggle.
 */

/**
 * Build the comparison key for a URL.
 *
 * Unparseable input (plain junk) falls back to the trimmed original, so such
 * bookmarks still dedupe against each other exactly rather than collapsing
 * together. The URL parser already lowercases the scheme and host and drops a
 * scheme's default port, so neither needs code here.
 */
export function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return trimmed;
  }

  // An empty query or fragment (`x/?`, `x/#`) is the same link without it.
  // Assigning '' removes the delimiter; reading `search`/`hash` cannot tell a
  // bare `?` from none, which made the slash-trim below cut the `?` instead.
  if (url.search === '') url.search = '';
  if (url.hash === '') url.hash = '';

  // A bare origin is the same link with or without the trailing slash.
  // Drop the slash off the serialized URL rather than rebuilding from
  // protocol+host: rebuilding silently discards userinfo, which would collapse
  // https://alice@host/ and https://bob@host/ into one key and drop one of them
  // on import.
  if (url.pathname === '/' && url.search === '' && url.hash === '') {
    return url.href.slice(0, -1);
  }

  // Query and fragment are kept verbatim — `?q=` and `#section` are meaningful.
  return url.href;
}
