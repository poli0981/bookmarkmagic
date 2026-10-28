// @ts-check
/**
 * JSON bookmark files — BookmarkMagic JSON, Chrome's profile `Bookmarks` file,
 * and Firefox's `bookmarks-YYYY-MM-DD.json` backup.
 *
 * Default-deny: every string VALUE is replaced unless its key is on the short
 * structural list below. The old rewriter was default-allow — it rewrote only
 * `"url"` and `"title"`, so Chrome's titles (under `"name"`), Firefox's `uri`,
 * `iconUri` and keywords, Chrome's `meta_info` and the base64 `sync_metadata`
 * blob all went through untouched, and the host check could not see a title.
 *
 * Values are rewritten by span over the raw text (a small tokenizer tracks
 * which key each string belongs to), so indentation, key order, escapes and
 * line endings stay byte-for-byte as the browser wrote them.
 */
import { isAddressLike, makeGuidMapper } from './mappers.mjs';
import { replaceSpans } from './spans.mjs';

/** @typedef {import('./spans.mjs').Span} Span */
/** @typedef {import('./mappers.mjs').Mapper} Mapper */

/**
 * Keys whose string values are structure, not content, and are kept verbatim:
 * format markers, type tags, root identifiers, numeric ids and every timestamp
 * (Chrome stores dates as decimal strings). Nothing a person typed lives here.
 */
const STRUCTURAL = new Set([
  'format',
  'generator',
  'exportedAt',
  'version',
  'type',
  'root',
  'id',
  'date_added',
  'date_modified',
  'date_last_used',
  'charset',
  'source',
]);

/** Keys whose value is an address, mapped even when it does not parse. */
const ADDRESS = new Set(['url', 'uri', 'iconuri']);

/**
 * @typedef {{ kind: 'object' | 'array', key: string | null, expectKey: boolean, current: string | null }} Frame
 * @typedef {{ start: number, end: number, raw: string, key: string | null, parentKey: string | null }} StringToken
 */

/**
 * Every string VALUE in a JSON text, with the key it sits under and the key of
 * the object that holds it (`annos[].value` → key "value", parentKey "annos").
 * The input has already passed `JSON.parse`, so it is well-formed.
 *
 * @param {string} text
 * @returns {StringToken[]}
 */
export function stringValues(text) {
  /** @type {Frame[]} */
  const stack = [];
  /** @type {StringToken[]} */
  const out = [];
  // The key a new child sits under. Array elements inherit the array's key, so
  // every object inside `"annos": [...]` reports "annos" as its parent.
  const keyFor = () => {
    const top = stack.at(-1);
    return (top?.kind === 'object' ? top.current : top?.key) ?? null;
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '{' || ch === '[') {
      stack.push({
        kind: ch === '{' ? 'object' : 'array',
        key: keyFor(),
        expectKey: ch === '{',
        current: null,
      });
    } else if (ch === '}' || ch === ']') {
      stack.pop();
    } else if (ch === ',') {
      const top = stack.at(-1);
      if (top?.kind === 'object') top.expectKey = true;
    } else if (ch === ':') {
      const top = stack.at(-1);
      if (top !== undefined) top.expectKey = false;
    } else if (ch === '"') {
      let j = i + 1;
      while (j < text.length && text[j] !== '"') j += text[j] === '\\' ? 2 : 1;
      const raw = text.slice(i + 1, j);
      const top = stack.at(-1);
      if (top?.kind === 'object' && top.expectKey) {
        top.current = JSON.parse(`"${raw}"`);
      } else {
        const holder = top?.kind === 'object' ? top : stack.at(-2);
        out.push({ start: i + 1, end: j, raw, key: keyFor(), parentKey: holder?.key ?? null });
      }
      i = j;
    }
  }
  return out;
}

/**
 * @param {string} text
 * @param {Mapper} mapUrl
 * @param {Mapper} mapTitle
 */
export function sanitizeJson(text, mapUrl, mapTitle) {
  const mapGuid = makeGuidMapper();
  let keywords = 0;
  /** @type {Span[]} */
  const spans = [];
  for (const token of stringValues(text)) {
    const key = token.key ?? '';
    const lower = key.toLowerCase();
    if (STRUCTURAL.has(key)) continue;
    // An anno's `name` is a schema id (bookmarkProperties/description); its
    // `value` is what the person wrote.
    if (token.parentKey === 'annos' && key === 'name') continue;

    const value = /** @type {string} */ (JSON.parse(`"${token.raw}"`));
    let mapped;
    if (lower === 'guid') mapped = mapGuid(value);
    else if (lower === 'checksum' || lower === 'checksum_sha256') mapped = '0'.repeat(value.length);
    else if (lower === 'sync_metadata') mapped = '';
    else if (lower === 'keyword') mapped = value === '' ? '' : `kw${++keywords}`;
    else if (lower === 'tags')
      mapped =
        value === ''
          ? ''
          : value
              .split(',')
              .map((_, i) => `tag${i + 1}`)
              .join(',');
    else if (ADDRESS.has(lower) || isAddressLike(value)) mapped = mapUrl(value);
    else mapped = mapTitle(value);

    spans.push({ start: token.start, end: token.end, value: JSON.stringify(mapped).slice(1, -1) });
  }
  return replaceSpans(text, spans);
}
