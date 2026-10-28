// @ts-check
/**
 * Netscape HTML: rewrite addresses, titles, descriptions and user-authored
 * attributes by span, leaving every other byte exactly as the browser wrote it.
 */
import { isAddressLike } from './mappers.mjs';
import {
  ANY_ATTR,
  attrRewriter,
  attrSpans,
  replaceSpans,
  spansFrom,
  TAG_INNARDS,
} from './spans.mjs';

/** @typedef {import('./spans.mjs').Span} Span */
/** @typedef {import('./mappers.mjs').Mapper} Mapper */

/** 1×1 transparent PNG. Keeps ICON= present, which is what the parser reacts to. */
const BLANK_ICON =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

/** Attributes handled explicitly; the generic URL sweep must not touch them. */
const HANDLED_ATTRS = new Set(['href', 'icon']);

/**
 * Scrub any *other* attribute whose value is an address. Firefox alone writes
 * `ICON_URI`, and `FEEDURL` and friends exist in the wild; enumerating them was
 * already wrong once, so this sweeps by value shape. `file:` counts: an
 * `ICON_URI="file:///C:/Users/<name>/…"` has no host, and used to pass.
 *
 * @param {string} text
 * @param {Mapper} mapUrl
 * @returns {Span[]}
 */
function urlAttrSpans(text, mapUrl) {
  /** @type {Span[]} */
  const spans = [];
  const rewrite = attrRewriter(mapUrl);
  for (const m of text.matchAll(ANY_ATTR)) {
    const name = (m[1] ?? '').toLowerCase();
    const value = m[2] ?? m[3] ?? m[4] ?? '';
    if (HANDLED_ATTRS.has(name) || value === '' || !isAddressLike(value)) continue;
    const at = m.indices?.[2] ?? m.indices?.[3] ?? m.indices?.[4];
    if (at !== undefined) spans.push({ start: at[0], end: at[1], value: rewrite(value) });
  }
  return spans;
}

/** The next element that ends a description: `<DT>`, `<DD>`, `<DL>` or a close. */
const DESCRIPTION_END = /<\s*\/?\s*(?:dt|dd|dl)\b/gi;

/**
 * `<DD>` descriptions, found in one linear pass.
 *
 * The description runs to the next `<DT>/<DD>/<DL>` (or a closing one), not to
 * the end of the line — a wrapped description used to leak its second line —
 * and trailing whitespace stays outside the span, because the newline and
 * indentation before the next tag are byte-level shape this tool keeps.
 *
 * Replaces `/<dd>([\s\S]*?)(?=\s*<…>|\s*$)/`, which backtracked polynomially
 * (SonarCloud S8786) and matched only a bare `<dd>` — `<DD class=n>Private
 * note` passed through untouched.
 *
 * @param {string} text
 * @param {() => string} next
 * @returns {Span[]}
 */
function descriptionSpans(text, next) {
  /** @type {Span[]} */
  const spans = [];
  for (const open of text.matchAll(/<dd\b[^>]*>/gi)) {
    const start = (open.index ?? 0) + open[0].length;
    DESCRIPTION_END.lastIndex = start;
    const close = DESCRIPTION_END.exec(text);
    let end = close === null ? text.length : close.index;
    while (end > start && /\s/.test(text.charAt(end - 1))) end--;
    if (end > start) spans.push({ start, end, value: next() });
  }
  return spans;
}

/** A document heading that says nothing about its owner stays as it is. */
const GENERIC_HEADING = /^\s*bookmarks(?:\s+menu)?\s*$/i;

/**
 * @param {string} text
 * @param {Mapper} mapUrl
 * @param {Mapper} mapTitle
 */
export function sanitizeHtml(text, mapUrl, mapTitle) {
  let descriptions = 0;
  let keywords = 0;
  /** @param {string} heading */
  const mapHeading = (heading) => (GENERIC_HEADING.test(heading) ? heading : mapTitle(heading));
  const spans = [
    // HREF and ICON, at any quoting — attribute name case is left as found.
    ...attrSpans(text, /^href$/, attrRewriter(mapUrl)),
    ...attrSpans(text, /^icon$/, () => BLANK_ICON),
    ...urlAttrSpans(text, mapUrl),
    // Firefox keywords and tags are user-authored text, so they are personal
    // too. Tag count is preserved because it is the only part a parser sees.
    ...attrSpans(text, /^shortcuturl$/, () => `kw${++keywords}`),
    ...attrSpans(text, /^tags$/, (v) =>
      v
        .split(',')
        .map((_, i) => `tag${i + 1}`)
        .join(','),
    ),
    // Bookmark and folder titles. `[\s\S]*?`, not `[^<]*`: a title holding a
    // raw `<` made the whole match fail and stay in the output.
    ...spansFrom(text, new RegExp(`<a\\b${TAG_INNARDS}>([\\s\\S]*?)</a>`, 'gi'), mapTitle),
    ...spansFrom(text, new RegExp(`<h3\\b${TAG_INNARDS}>([\\s\\S]*?)</h3>`, 'gi'), mapTitle),
    // `<TITLE>` / `<H1>` — usually "Bookmarks", but an exporter can write the
    // owner's name there ("Jane Doe's bookmarks").
    ...spansFrom(text, /<title\b[^>]*>([^<]*)<\/title>/gi, mapHeading),
    ...spansFrom(text, /<h1\b[^>]*>([^<]*)<\/h1>/gi, mapHeading),
    ...descriptionSpans(text, () => `Description ${++descriptions}`),
  ];
  return replaceSpans(text, spans);
}
