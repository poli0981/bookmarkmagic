// @ts-check
/**
 * CSV (docs/04 §3): a minimal RFC 4180 reader that records the span of each
 * field's *content* (inside the quotes, when quoted). Replacements never
 * contain a delimiter, quote or newline, so the original quoting survives —
 * which matters, because CSV quoting is itself a common bug.
 */
import { replaceSpans } from './spans.mjs';

/** @typedef {import('./spans.mjs').Span} Span */
/** @typedef {import('./mappers.mjs').Mapper} Mapper */
/** @typedef {{ row: number, col: number, start: number, end: number }} Field */

/**
 * @param {string} text
 * @param {string} delimiter
 * @returns {Field[]}
 */
export function readFields(text, delimiter) {
  /** @type {Field[]} */
  const fields = [];
  let row = 0;
  let col = 0;
  let i = 0;
  while (i < text.length) {
    const quoted = text[i] === '"';
    if (quoted) i++;
    const start = i;
    while (i < text.length) {
      const ch = text[i];
      if (quoted) {
        if (ch === '"' && text[i + 1] === '"') i += 2;
        else if (ch === '"') break;
        else i++;
      } else if (ch === delimiter || ch === '\n' || ch === '\r') {
        break;
      } else {
        i++;
      }
    }
    fields.push({ row, col, start, end: i });
    if (quoted && text[i] === '"') i++;
    if (text[i] === delimiter) {
      col++;
      i++;
    } else {
      if (text[i] === '\r') i++;
      if (text[i] === '\n') i++;
      row++;
      col = 0;
    }
  }
  return fields;
}

/**
 * Map each path segment separately so `\/` and `\\` escapes keep their meaning.
 * A segment that contained a literal slash or backslash keeps one, so the
 * escape branch of the CSV path parser — a real reason someone files a report —
 * is still exercised by the sample.
 *
 * @param {string} path
 * @param {Mapper} mapTitle
 */
function mapFolderPath(path, mapTitle) {
  const segments = [];
  let current = '';
  for (let i = 0; i < path.length; i++) {
    const ch = path[i];
    if (ch === '\\' && (path[i + 1] === '/' || path[i + 1] === '\\')) {
      current += path[i + 1];
      i++;
    } else if (ch === '/') {
      segments.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  segments.push(current);
  return segments
    .map((s) => {
      if (s === '') return '';
      const kept = `${s.includes('/') ? '/' : ''}${s.includes('\\') ? '\\' : ''}`;
      return `${mapTitle(s)}${kept}`.replace(/\\/g, '\\\\').replace(/\//g, '\\/');
    })
    .join('/');
}

/** @param {string} text */
export function csvDelimiter(text) {
  return (text.split('\n', 1)[0] ?? '').includes(';') ? ';' : ',';
}

/**
 * Default-deny: every field is rewritten except a date (digits only). The
 * old rules rewrote only the folder, title and url columns — and a title with
 * an unquoted comma, the very row that makes the extension report
 * CSV_ROW_MISMATCH, shifts every later field one column right, so the url
 * landed in `add_date` and was copied out verbatim. A row of the wrong width is
 * judged by value shape instead of by column.
 *
 * @param {string} text
 * @param {Mapper} mapUrl
 * @param {Mapper} mapTitle
 */
export function sanitizeCsv(text, mapUrl, mapTitle) {
  const fields = readFields(text, csvDelimiter(text));

  // Column names per docs/04 §3 — `folder_path`, not `folder`.
  const header = fields.filter((f) => f.row === 0).map((f) => text.slice(f.start, f.end).trim());
  /** @param {string} name */
  const at = (name) => header.findIndex((h) => h.toLowerCase().replace(/^\uFEFF/, '') === name);
  const [folderCol, titleCol, urlCol, dateCol] = [
    at('folder_path'),
    at('title'),
    at('url'),
    at('add_date'),
  ];
  /** @type {Map<number, number>} */
  const width = new Map();
  for (const f of fields) width.set(f.row, (width.get(f.row) ?? 0) + 1);

  /** @type {Span[]} */
  const spans = [];
  for (const f of fields) {
    if (f.row === 0 || f.start === f.end) continue;
    const value = text.slice(f.start, f.end).replace(/""/g, '"');
    const aligned = width.get(f.row) === header.length;
    // A number says nothing about anyone, and dates are what parsers branch on.
    // trim() first: `^\s*\d*\s*$` let two `\s*` compete for the same blanks,
    // which backtracks quadratically on a long run of them (S8786).
    if (/^\d*$/.test(value.trim()) && (f.col === dateCol || !aligned)) continue;
    let mapped;
    if (f.col === folderCol) mapped = mapFolderPath(value, mapTitle);
    else if (aligned && f.col === urlCol) mapped = mapUrl(value);
    else if (aligned && f.col === titleCol) mapped = mapTitle(value);
    else mapped = /^[a-z][a-z0-9+.-]*:/i.test(value) ? mapUrl(value) : mapTitle(value);
    spans.push({ start: f.start, end: f.end, value: mapped.replace(/"/g, '""') });
  }
  return replaceSpans(text, spans);
}

/**
 * Every field below the header, unescaped — what the leak check reads.
 *
 * @param {string} text
 * @returns {string[]}
 */
export function csvValues(text) {
  return readFields(text, csvDelimiter(text))
    .filter((f) => f.row > 0)
    .map((f) => text.slice(f.start, f.end).replace(/""/g, '"'));
}
