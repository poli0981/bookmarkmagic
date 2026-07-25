/**
 * CSV parser — docs/04 §3, docs/05 §7.
 *
 * Purpose: read the spreadsheet-friendly flattened projection back into a tree.
 * Inputs: decoded file text; a leading BOM is tolerated.
 * Guarantees: hand-rolled RFC 4180-style state machine — `""` unescaping,
 *   CRLF/LF tolerance, delimiter sniffed from the header row.
 *
 * CSV is lossy by construction (docs/04 §3): no empty folders, no
 * `lastModified`, no folder `addDate`, and no `toolbar` — a parsed CSV node
 * always has `toolbar === undefined`, so the first path segment is an ordinary
 * folder title and never a root reference.
 */

import { splitPath } from '../csv-path';
import { MAX_DEPTH, MAX_NODES } from '../limits';
import {
  BmParseError,
  type BookmarkNode,
  computeStats,
  type ParseResult,
  type ParseWarning,
} from '../model';
import { normalizeEpochSeconds } from '../timestamps';

export const CSV_COLUMNS = ['folder_path', 'title', 'url', 'add_date'] as const;
const DELIMITERS = [',', ';'] as const;

/** Split CSV text into rows of fields. Quotes may contain the delimiter and newlines. */
export function parseCsvRows(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  const endField = (): void => {
    row.push(field);
    field = '';
  };
  const endRow = (): void => {
    endField();
    rows.push(row);
    row = [];
  };

  while (i < text.length) {
    const ch = text[i] as string;

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }

    if (ch === '"' && field === '') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === delimiter) {
      endField();
      i++;
      continue;
    }
    if (ch === '\r') {
      // CRLF or a lone CR both terminate the record.
      endRow();
      i += text[i + 1] === '\n' ? 2 : 1;
      continue;
    }
    if (ch === '\n') {
      endRow();
      i++;
      continue;
    }
    field += ch;
    i++;
  }

  // A trailing newline produces no extra record; anything else is a final row.
  if (field !== '' || row.length > 0) endRow();
  return rows;
}

/**
 * Return the delimiter whose header row yields exactly the expected columns,
 * or null. Shared with `detect-format.ts` so sniffing and parsing can never
 * disagree about what counts as a CSV header — note fields may be quoted, so
 * this must go through the row parser rather than match on the raw text.
 */
export function matchCsvHeader(headerLine: string): string | null {
  for (const candidate of DELIMITERS) {
    const [header] = parseCsvRows(headerLine, candidate);
    if (header !== undefined && header.length === CSV_COLUMNS.length) {
      const normalized = header.map((h) => h.trim().toLowerCase());
      if (CSV_COLUMNS.every((col, i) => normalized[i] === col)) return candidate;
    }
  }
  return null;
}

function sniffDelimiter(headerLine: string): string {
  const delimiter = matchCsvHeader(headerLine);
  if (delimiter === null) {
    throw new BmParseError(
      'BAD_CSV_HEADER',
      `expected header "${CSV_COLUMNS.join(',')}" (or ";"-separated)`,
      1,
    );
  }
  return delimiter;
}

/**
 * Insert a bookmark at `segments`, creating intermediate folders as needed.
 * Returns how many folders were created, so the caller can hold synthesized
 * folders against MAX_NODES too — counting only rows would let a small file
 * build an unbounded tree.
 */
function insertAt(roots: BookmarkNode[], segments: string[], leaf: BookmarkNode): number {
  let level = roots;
  let created = 0;
  for (const segment of segments) {
    let folder = level.find((n) => n.url === undefined && n.title === segment);
    if (folder === undefined) {
      folder = { title: segment, children: [] };
      level.push(folder);
      created++;
    }
    // SAFETY: every folder we create or match here was created with children.
    level = folder.children as BookmarkNode[];
  }
  level.push(leaf);
  return created;
}

/**
 * Parse a CSV export.
 *
 * @throws {BmParseError} `BAD_CSV_HEADER`, `CSV_ROW_MISMATCH`,
 *   `TOO_MANY_NODES` or `TOO_DEEP`.
 */
export function parseCsv(text: string): ParseResult {
  const body = text.replace(/^﻿/, '');
  const firstBreak = body.search(/\r\n|\r|\n/);
  const headerLine = firstBreak === -1 ? body : body.slice(0, firstBreak);
  const delimiter = sniffDelimiter(headerLine);

  const rows = parseCsvRows(body, delimiter);
  const warnings: ParseWarning[] = [];
  const roots: BookmarkNode[] = [];
  let invalidDates = 0;
  let missingUrls = 0;
  /** Bookmarks plus every folder synthesized from a path — the real node count. */
  let nodes = 0;

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r] as string[];
    if (row.length === 1 && row[0] === '') continue; // blank line

    if (row.length !== CSV_COLUMNS.length) {
      throw new BmParseError(
        'CSV_ROW_MISMATCH',
        `row has ${row.length} fields, expected ${CSV_COLUMNS.length}`,
        r + 1,
      );
    }

    const [pathField = '', title = '', url = '', addDateField = ''] = row;
    if (url.trim() === '') {
      missingUrls++;
      continue;
    }

    const segments = splitPath(pathField);
    if (segments.length + 1 > MAX_DEPTH) {
      throw new BmParseError('TOO_DEEP', `nesting deeper than ${MAX_DEPTH} levels`, r + 1);
    }

    const parsed = normalizeEpochSeconds(addDateField);
    if (parsed.invalid) invalidDates++;

    const createdFolders = insertAt(roots, segments, {
      title: title === '' ? url : title,
      url,
      ...(parsed.seconds !== undefined && { addDate: parsed.seconds }),
    });

    nodes += 1 + createdFolders;
    if (nodes > MAX_NODES) {
      throw new BmParseError('TOO_MANY_NODES', `more than ${MAX_NODES} nodes`, r + 1);
    }
  }

  if (missingUrls > 0) warnings.push({ code: 'MISSING_URL', count: missingUrls });
  if (invalidDates > 0) warnings.push({ code: 'INVALID_DATE', count: invalidDates });
  if (roots.length === 0) warnings.push({ code: 'NO_BOOKMARKS', count: 1 });

  return { roots, stats: computeStats(roots), warnings };
}
