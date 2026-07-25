/**
 * Format sniffing — docs/04 intro.
 *
 * Purpose: decide which parser to run from the CONTENT, never the extension.
 * Inputs: decoded file text.
 * Guarantees: never throws for a recognised format; throws `UNKNOWN_FORMAT`
 *   when nothing matches.
 *
 * A leading BOM is stripped before sniffing. The UTF-8 decode at the read
 * boundary normally removes it, but a caller that decodes with
 * `ignoreBOM: true` would otherwise fail the `{` and header probes.
 */
import { BmParseError, type FileFormat } from './model';
import { BM_JSON_FORMAT } from './parse/bm-json';
import { matchCsvHeader } from './parse/csv';

const DOCTYPE_PROBE_BYTES = 512;

export function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

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
 * Identify the format of a bookmark file.
 *
 * @throws {BmParseError} `UNKNOWN_FORMAT` when the content matches nothing.
 */
export function detectFormat(rawText: string): FileFormat {
  const text = stripBom(rawText);

  if (/NETSCAPE-Bookmark-file-1/i.test(text.slice(0, DOCTYPE_PROBE_BYTES))) return 'netscape-html';

  const trimmed = text.trimStart();
  if (trimmed.startsWith('{')) {
    try {
      const doc: unknown = JSON.parse(trimmed);
      if (
        typeof doc === 'object' &&
        doc !== null &&
        (doc as { format?: unknown }).format === BM_JSON_FORMAT
      ) {
        return 'bm-json';
      }
    } catch {
      // Not valid JSON — fall through to the CSV probe.
    }
  }

  if (looksLikeCsvHeader(text)) return 'csv';

  // A <DL> with no doctype is still Netscape HTML in practice; the parser
  // decides whether it is usable.
  if (/<\s*dl[\s>]/i.test(text)) return 'netscape-html';

  throw new BmParseError('UNKNOWN_FORMAT', 'not Netscape HTML, BM JSON or CSV');
}
