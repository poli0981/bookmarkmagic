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

const DEFAULT_PORTS: Record<string, string> = {
  'http:': '80',
  'https:': '443',
  'ftp:': '21',
  'ws:': '80',
  'wss:': '443',
};

/**
 * Build the comparison key for a URL.
 *
 * Unparseable input (`javascript:`, `about:`, plain junk) falls back to the
 * trimmed original, so such bookmarks still dedupe against each other exactly
 * rather than collapsing together.
 */
export function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return trimmed;
  }

  // The URL parser already lowercases protocol and hostname.
  if (url.port !== '' && DEFAULT_PORTS[url.protocol] === url.port) url.port = '';

  // A bare origin is the same link with or without the trailing slash.
  // Drop the slash off the serialized URL rather than rebuilding from
  // protocol+host: rebuilding silently discards userinfo, which would collapse
  // https://alice@host/ and https://bob@host/ into one key and drop one of them
  // on import.
  if (url.pathname === '/' && url.search === '' && url.hash === '') {
    return url.toString().slice(0, -1);
  }

  // Query and fragment are kept verbatim — `?q=` and `#section` are meaningful.
  return url.toString();
}
