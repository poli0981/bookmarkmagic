// @ts-check
/**
 * Span rewriting: every change is a [start, end) → value replacement, so the
 * bytes between spans are provably untouched. Rebuilding the file from a parsed
 * model would quietly normalize them, and the byte-level shape is often the bug.
 */

/** @typedef {{ start: number, end: number, value: string }} Span */

/**
 * Apply replacements right to left by character span.
 *
 * Overlaps are dropped, outermost first. Two patterns can legitimately claim
 * the same bytes — an <A> title containing `x="http://…"` matches both the
 * title rule and the generic attribute sweep — and applying both would splice
 * already-rewritten text using an `end` measured against the original. The
 * widest span sanitizes the most.
 *
 * @param {string} text
 * @param {Span[]} spans
 */
export function replaceSpans(text, spans) {
  const ordered = [...spans].sort((a, b) => a.start - b.start || b.end - a.end);
  const out = [];
  let cursor = 0;
  for (const span of ordered) {
    if (span.start < cursor) continue;
    out.push(text.slice(cursor, span.start), span.value);
    cursor = span.end;
  }
  out.push(text.slice(cursor));
  // Joined once rather than spliced per span: splicing is O(spans × file),
  // which took minutes on a large export.
  return out.join('');
}

/**
 * Spans for one capture group of a global regex; `map` receives the captured
 * text. The `d` flag gives exact per-group offsets — searching the match for
 * the captured substring lands on the wrong copy whenever the capture also
 * appears earlier in the match (a title equal to part of its own URL).
 *
 * @param {string} text
 * @param {RegExp} re
 * @param {(captured: string) => string} map
 * @param {number} [group]
 * @returns {Span[]}
 */
export function spansFrom(text, re, map, group = 1) {
  const indexed = new RegExp(re.source, re.flags.includes('d') ? re.flags : `${re.flags}d`);
  /** @type {Span[]} */
  const spans = [];
  for (const m of text.matchAll(indexed)) {
    const captured = m[group] ?? '';
    const at = m.indices?.[group];
    if (captured === '' || at === undefined) continue;
    spans.push({ start: at[0], end: at[1], value: map(captured) });
  }
  return spans;
}

/**
 * The inside of an opening tag, tolerating `>` within quoted attribute values.
 * `data:text/html,<h1>hi</h1>` is a legal HREF in the T1/T3 fixtures, and a
 * naive `[^>]*` stopped inside it, leaving that bookmark's title unsanitized.
 */
export const TAG_INNARDS = '(?:"[^"]*"|\'[^\']*\'|[^>"\'])*';

/** The four entities Netscape exporters write inside attribute values. */
const ATTR_ENTITY = /&(amp|lt|gt|quot);/gi;
/** @type {Record<string, string>} */
const ATTR_DECODE = { amp: '&', lt: '<', gt: '>', quot: '"' };

/**
 * Decode an HTML attribute value, map it, then re-encode it the way the source
 * file encoded it.
 *
 * Decoding is ONE pass. Chained `.replace()` calls (`&amp;` first, then `&lt;`)
 * turned `&amp;lt;` into `<` — a double unescape (CodeQL js/double-escaping).
 * Netscape exports write `&amp;` inside HREF but not all of them do, and
 * emitting a bare `&` where the source had `&amp;` would silently repair the
 * file being reported.
 *
 * @param {(value: string) => string} map
 * @returns {(captured: string) => string}
 */
export function attrRewriter(map) {
  return (captured) => {
    const decoded = captured.replace(
      ATTR_ENTITY,
      (_m, name) => ATTR_DECODE[name.toLowerCase()] ?? _m,
    );
    const mapped = map(decoded);
    const escapesAmp = /&amp;/i.test(captured) || !captured.includes('&');
    return escapesAmp ? mapped.replace(/&/g, '&amp;') : mapped;
  };
}

/**
 * `name = value`, where the value is double-quoted, single-quoted or bare.
 * Group 2/3/4 is the value, whichever quoting was used — matching only `"…"`
 * left `HREF='https://…'` completely untouched.
 */
export const ANY_ATTR = /\b([a-z_][a-z0-9_-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'<>=`]+))/dgi;

/**
 * Spans for every attribute whose (lower-cased) name matches, at any quoting.
 *
 * @param {string} text
 * @param {RegExp} nameRe
 * @param {(value: string) => string} map
 * @returns {Span[]}
 */
export function attrSpans(text, nameRe, map) {
  /** @type {Span[]} */
  const spans = [];
  for (const m of text.matchAll(ANY_ATTR)) {
    if (!nameRe.test((m[1] ?? '').toLowerCase())) continue;
    const at = m.indices?.[2] ?? m.indices?.[3] ?? m.indices?.[4];
    const value = m[2] ?? m[3] ?? m[4] ?? '';
    if (at === undefined || value === '') continue;
    spans.push({ start: at[0], end: at[1], value: map(value) });
  }
  return spans;
}
