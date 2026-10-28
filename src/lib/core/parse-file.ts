/**
 * Read any supported bookmark file — docs/03 §1 steps 3-4, docs/04 intro.
 *
 * Purpose: the one entry point the import pipeline calls. It sniffs the
 *   content, parses it exactly once and returns the format with the tree, so
 *   no caller can pick a reader by file extension or parse JSON twice.
 * Inputs: decoded file text; display titles for roots a file names only by
 *   key (Firefox).
 * Guarantees: throws `BmParseError` and nothing else. JSON that parses but is
 *   none of the three known dialects is `NOT_BM_JSON`; JSON that does not
 *   parse is `MALFORMED_JSON`.
 */
import { jsonFormatOf, sniffFormat } from './detect-format';
import { BmParseError, type FileFormat, type ParseResult } from './model';
import { readBmJson } from './parse/bm-json';
import { readChromeBookmarks } from './parse/chrome-json';
import { parseCsv } from './parse/csv';
import { readFirefoxJson } from './parse/firefox-json';
import { parseNetscapeHtml } from './parse/netscape-html';
import { parseJsonText, type RootTitles, stripBom } from './parse/shared';

export interface ParseFileOptions {
  rootTitles?: RootTitles;
}

export interface ParsedFile {
  format: FileFormat;
  result: ParseResult;
}

/** Route one parsed JSON document to the reader for its dialect. */
function readJson(doc: unknown, options: ParseFileOptions): ParsedFile {
  const format = jsonFormatOf(doc);
  switch (format) {
    case 'bm-json':
      return { format, result: readBmJson(doc) };
    case 'chrome-json':
      return { format, result: readChromeBookmarks(doc, options) };
    case 'firefox-json':
      return { format, result: readFirefoxJson(doc, options) };
    case undefined:
      throw new BmParseError(
        'NOT_BM_JSON',
        'valid JSON, but not a BookmarkMagic, Chrome or Firefox bookmark file',
      );
  }
}

/**
 * Sniff, parse and read a bookmark file.
 *
 * @throws {BmParseError} `UNKNOWN_FORMAT`, `MALFORMED_JSON`, `NOT_BM_JSON`, and
 *   everything the individual readers raise.
 */
export function parseBookmarkFile(rawText: string, options: ParseFileOptions = {}): ParsedFile {
  // Blob.text() already consumed a BOM; a caller decoding with ignoreBOM would
  // otherwise fail the `{` and header probes.
  const text = stripBom(rawText);
  const kind = sniffFormat(text);
  switch (kind) {
    case 'json':
      return readJson(parseJsonText(text), options);
    case 'netscape-html':
      return { format: kind, result: parseNetscapeHtml(text) };
    case 'csv':
      return { format: kind, result: parseCsv(text) };
  }
}
