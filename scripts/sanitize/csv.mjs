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
function readFields(text, delimiter) {
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

/**
 * @param {string} text
 * @param {Mapper} mapUrl
 * @param {Mapper} mapTitle
 */
export function sanitizeCsv(text, mapUrl, mapTitle) {
  const delimiter = (text.split('\n', 1)[0] ?? '').includes(';') ? ';' : ',';
  const fields = readFields(text, delimiter);

  // Column names per docs/04 §3 — `folder_path`, not `folder`.
  const header = fields.filter((f) => f.row === 0).map((f) => text.slice(f.start, f.end).trim());
  /** @param {string} name */
  const at = (name) => header.findIndex((h) => h.toLowerCase().replace(/^﻿/, '') === name);
  const [folderCol, titleCol, urlCol] = [at('folder_path'), at('title'), at('url')];

  /** @type {Span[]} */
  const spans = [];
  for (const f of fields) {
    if (f.row === 0 || f.start === f.end) continue;
    const value = text.slice(f.start, f.end).replace(/""/g, '"');
    let mapped;
    if (f.col === urlCol) mapped = mapUrl(value);
    else if (f.col === titleCol) mapped = mapTitle(value);
    else if (f.col === folderCol) mapped = mapFolderPath(value, mapTitle);
    else continue;
    spans.push({ start: f.start, end: f.end, value: mapped.replace(/"/g, '""') });
  }
  return replaceSpans(text, spans);
}
