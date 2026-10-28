// @ts-check
/**
 * Format sniffing for the sanitizer — refuse anything not positively known.
 *
 * Returning `null` rather than guessing is load-bearing. Every sanitizer finds
 * what it must destroy *by format*, so a wrong guess destroys nothing and emits
 * the input verbatim — and the file would still be handed over as "sanitized".
 * The old `return 'csv'` fallback did exactly that for a truncated JSON export.
 *
 * The same goes for JSON: the old check accepted ANY object, and the JSON
 * rewriter only knew BookmarkMagic's `title`/`url` keys — so Chrome's profile
 * `Bookmarks` file, which keeps titles under `name`, "sanitized" with every
 * title intact and passed the host check. Each JSON dialect is now recognised
 * by shape, and anything else is refused.
 *
 * Re-implemented rather than imported from `src/lib/core/detect-format.ts`:
 * this script must run from a fresh clone with nothing installed.
 */

/** The docs/04 §3 CSV header, in order. A file is CSV only if it says so. */
const CSV_HEADER = ['folder_path', 'title', 'url', 'add_date'];

/** @typedef {'html' | 'json' | 'chrome-json' | 'firefox-json' | 'csv'} Kind */

/**
 * @param {unknown} doc
 * @returns {'json' | 'chrome-json' | 'firefox-json' | null}
 */
export function jsonDialect(doc) {
  if (typeof doc !== 'object' || doc === null || Array.isArray(doc)) return null;
  const record = /** @type {Record<string, unknown>} */ (doc);
  if (record.format === 'bookmarkmagic') return 'json';
  const roots = record.roots;
  if (
    typeof roots === 'object' &&
    roots !== null &&
    !Array.isArray(roots) &&
    ['bookmark_bar', 'other', 'synced'].some((key) => key in roots)
  ) {
    return 'chrome-json';
  }
  const isPlacesRoot = record.type === 'text/x-moz-place-container' || record.root === 'placesRoot';
  if (isPlacesRoot && Array.isArray(record.children)) return 'firefox-json';
  return null;
}

/**
 * Identify the format, or refuse with `null`.
 *
 * The people who run this tool are, by definition, the ones whose file did not
 * import — so a malformed or hand-trimmed file is the typical input here.
 *
 * @param {string} text
 * @returns {Kind | null}
 */
export function detectKind(text) {
  const body = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const trimmed = body.trimStart();
  // JSON first: a JSON title may legitimately contain the Netscape doctype
  // string, and nothing that starts with `{` is HTML or CSV.
  if (trimmed.startsWith('{')) {
    try {
      return jsonDialect(JSON.parse(trimmed));
    } catch {
      return null;
    }
  }
  if (/NETSCAPE-Bookmark-file-1/i.test(body.slice(0, 512))) return 'html';
  const firstLine = body.split(/\r?\n/, 1)[0] ?? '';
  for (const delimiter of [',', ';']) {
    const columns = firstLine
      .split(delimiter)
      .map((h) => h.trim().replace(/^"|"$/g, '').toLowerCase());
    if (columns.length === CSV_HEADER.length && CSV_HEADER.every((c, i) => columns[i] === c)) {
      return 'csv';
    }
  }
  if (/<\s*dl[\s>]/i.test(body)) return 'html';
  return null;
}
