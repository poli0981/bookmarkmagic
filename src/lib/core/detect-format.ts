/**
 * Format sniffing — docs/04 intro.
 *
 * Purpose: decide which reader to run from the CONTENT, never the extension —
 *   Chrome's profile `Bookmarks` file has no extension at all.
 * Inputs: decoded file text, BOM already stripped by `parse-file.ts`.
 * Guarantees: `sniffFormat` never parses JSON. Text that opens like JSON is
 *   reported as `json` and parsed exactly once by the caller, then routed by
 *   shape (`jsonFormatOf`); a JSON title that happens to contain the Netscape
 *   doctype string is therefore never mistaken for HTML.
 */
import { BmParseError, type FileFormat } from './model';
import { looksLikeBmJson } from './parse/bm-json';
import { looksLikeChromeBookmarks } from './parse/chrome-json';
import { matchCsvHeader } from './parse/csv';
import { looksLikeFirefoxBackup } from './parse/firefox-json';

/** The doctype sits in the first line of every real export; 512 bytes is generous. */
const DOCTYPE_PROBE_BYTES = 512;

export type TextKind = 'json' | 'netscape-html' | 'csv';
export type JsonFormat = Extract<FileFormat, 'bm-json' | 'chrome-json' | 'firefox-json'>;

/**
 * Delegate to the parser's own header matcher rather than substring-matching
 * the raw line: header fields may be quoted, and a sniffer stricter than the
 * parser would reject files the parser handles fine.
 */
function looksLikeCsvHeader(text: string): boolean {
  const firstBreak = text.search(/\r\n|\r|\n/);
  return matchCsvHeader(firstBreak === -1 ? text : text.slice(0, firstBreak)) !== null;
}

/**
 * The Netscape doctype, as the first thing in the file after whitespace and
 * comments. Anchored: every exporter writes it first, and the old probe — the
 * marker anywhere in the first 512 bytes — fired on a CSV title just as well.
 */
function startsWithDoctype(text: string): boolean {
  let rest = text.slice(0, DOCTYPE_PROBE_BYTES).trimStart();
  while (rest.startsWith('<!--')) {
    const end = rest.indexOf('-->');
    if (end === -1) return false;
    rest = rest.slice(end + 3).trimStart();
  }
  return /^<!DOCTYPE\s+NETSCAPE-Bookmark-file-1/i.test(rest);
}

/**
 * Identify what kind of text this is.
 *
 * @throws {BmParseError} `UNKNOWN_FORMAT` when the content matches nothing.
 */
export function sniffFormat(text: string): TextKind {
  const start = text.trimStart();
  if (start.startsWith('{') || start.startsWith('[')) return 'json';

  if (startsWithDoctype(text)) return 'netscape-html';
  if (looksLikeCsvHeader(text)) return 'csv';

  // A <DL> with no doctype is still Netscape HTML in practice; the parser
  // decides whether it is usable.
  if (/<\s*dl[\s>]/i.test(text)) return 'netscape-html';

  throw new BmParseError(
    'UNKNOWN_FORMAT',
    'not Netscape HTML, CSV, BookmarkMagic JSON, a Chrome Bookmarks file or a Firefox backup',
  );
}

/** Which JSON dialect a parsed document is, by shape — or undefined. */
export function jsonFormatOf(doc: unknown): JsonFormat | undefined {
  if (looksLikeBmJson(doc)) return 'bm-json';
  if (looksLikeChromeBookmarks(doc)) return 'chrome-json';
  if (looksLikeFirefoxBackup(doc)) return 'firefox-json';
  return undefined;
}
