/**
 * CSV parser — docs/04 §3, docs/05 §7.
 *
 * Purpose: read the spreadsheet-friendly flattened projection back into a tree.
 * Inputs: decoded file text; a leading BOM and an Excel `sep=` line are tolerated.
 * Guarantees: hand-rolled RFC 4180-style state machine — `""` unescaping,
 *   CRLF/LF tolerance, delimiter sniffed from the header row.
 *
 * CSV is lossy by construction (docs/04 §3): no empty folders, no
 * `lastModified`, no folder `addDate`, no `toolbar`, and sibling folders that
 * share a name merge into one. A parsed CSV node always has
 * `toolbar === undefined`, so the first path segment is an ordinary folder.
 */
import { CSV_COLUMNS, CSV_DELIMITERS, type CsvDelimiter, restoreFormula } from '../csv-dialect';
import { splitPath } from '../csv-path';
import { classifyHref } from '../href';
import { MAX_DEPTH, MAX_NODES } from '../limits';
import { BmParseError, type BookmarkNode, computeStats, type ParseResult } from '../model';
import { normalizeEpochSeconds } from '../timestamps';
import { bookmarkTitle, stripBom, WarningBag } from './shared';

/** Mutable reader state; one per `parseCsvRows` call. */
interface RowReader {
  rows: string[][];
  row: string[];
  field: string;
  /** Physical line (1-based) the reader is on — counts newlines inside quotes too. */
  line: number;
}

function endField(r: RowReader): void {
  r.row.push(r.field);
  r.field = '';
}

function endRow(r: RowReader): void {
  endField(r);
  r.rows.push(r.row);
  r.row = [];
}

/**
 * Consume a quoted field starting just after its opening quote; returns the
 * index after the closing quote.
 *
 * @throws {BmParseError} `CSV_UNCLOSED_QUOTE` when the text ends inside the
 *   quotes. Before, one stray quote silently became a single field holding the
 *   rest of the file — 5 000 bookmarks gone behind one INVALID_DATE warning.
 */
function readQuoted(text: string, start: number, r: RowReader): number {
  const openedOn = r.line;
  let i = start;
  while (i < text.length) {
    const ch = text[i] as string;
    if (ch === '"' && text[i + 1] === '"') {
      r.field += '"';
      i += 2;
    } else if (ch === '"') {
      return i + 1;
    } else {
      if (ch === '\n') r.line++;
      r.field += ch;
      i++;
    }
  }
  throw new BmParseError(
    'CSV_UNCLOSED_QUOTE',
    `a quote opened on line ${openedOn} never closes`,
    openedOn,
  );
}

/** Split CSV text into rows of fields. Quotes may contain the delimiter and newlines. */
export function parseCsvRows(text: string, delimiter: string): string[][] {
  const r: RowReader = { rows: [], row: [], field: '', line: 1 };
  let i = 0;
  while (i < text.length) {
    const ch = text[i] as string;
    if (ch === '"' && r.field === '') {
      i = readQuoted(text, i + 1, r);
    } else if (ch === delimiter) {
      endField(r);
      i++;
    } else if (ch === '\r' || ch === '\n') {
      // CRLF, LF or a lone CR all terminate the record.
      endRow(r);
      r.line++;
      i += ch === '\r' && text[i + 1] === '\n' ? 2 : 1;
    } else {
      r.field += ch;
      i++;
    }
  }
  // A trailing newline produces no extra record; anything else is a final row.
  if (r.field !== '' || r.row.length > 0) endRow(r);
  return r.rows;
}

/**
 * Return the delimiter whose header row yields exactly the expected columns,
 * or null. Shared with `detect-format.ts` so sniffing and parsing can never
 * disagree about what counts as a CSV header — fields may be quoted, so this
 * goes through the row parser rather than matching raw text.
 */
export function matchCsvHeader(headerLine: string): CsvDelimiter | null {
  for (const candidate of CSV_DELIMITERS) {
    let header: string[] | undefined;
    try {
      [header] = parseCsvRows(headerLine, candidate);
    } catch {
      return null; // an unclosed quote on the header line is not our header
    }
    if (header !== undefined && header.length === CSV_COLUMNS.length) {
      const normalized = header.map((h) => h.trim().toLowerCase());
      if (CSV_COLUMNS.every((col, i) => normalized[i] === col)) return candidate;
    }
  }
  return null;
}

/** Excel writes `sep=;` as a first line to pick its delimiter. It is not data. */
function dropSepLine(body: string): string {
  return /^sep=.\r?\n/i.test(body) ? body.slice(body.indexOf('\n') + 1) : body;
}

/** Folder lookup by title, per sibling list — a linear `find` made big folders quadratic. */
type FolderIndex = WeakMap<BookmarkNode[], Map<string, BookmarkNode>>;

/**
 * Insert a bookmark at `segments`, creating intermediate folders as needed.
 * Returns how many folders were created, so synthesized folders count against
 * MAX_NODES too — counting only rows would let a small file build a huge tree.
 */
function insertAt(
  roots: BookmarkNode[],
  segments: string[],
  leaf: BookmarkNode,
  index: FolderIndex,
): number {
  let level = roots;
  let created = 0;
  for (const segment of segments) {
    let byTitle = index.get(level);
    if (byTitle === undefined) {
      byTitle = new Map();
      index.set(level, byTitle);
    }
    let folder = byTitle.get(segment);
    if (folder === undefined) {
      folder = { title: segment, children: [] };
      level.push(folder);
      byTitle.set(segment, folder);
      created++;
    }
    // SAFETY: every folder we create or match here was created with children.
    level = folder.children as BookmarkNode[];
  }
  level.push(leaf);
  return created;
}

/** A row that carries nothing — blank, whitespace-only, or spreadsheet padding (`,,,`). */
function isEmptyRow(row: readonly string[]): boolean {
  return row.every((field) => field.trim() === '');
}

/**
 * Parse a CSV export.
 *
 * @throws {BmParseError} `BAD_CSV_HEADER`, `CSV_ROW_MISMATCH`,
 *   `CSV_UNCLOSED_QUOTE`, `TOO_MANY_NODES` or `TOO_DEEP`.
 */
export function parseCsv(text: string): ParseResult {
  const body = dropSepLine(stripBom(text));
  const firstBreak = body.search(/\r\n|\r|\n/);
  const delimiter = matchCsvHeader(firstBreak === -1 ? body : body.slice(0, firstBreak));
  if (delimiter === null) {
    throw new BmParseError(
      'BAD_CSV_HEADER',
      `expected header "${CSV_COLUMNS.join(',')}" (or ";"-separated)`,
      1,
    );
  }

  const rows = parseCsvRows(body, delimiter);
  const warnings = new WarningBag();
  const roots: BookmarkNode[] = [];
  const index: FolderIndex = new WeakMap();
  /** Bookmarks plus every folder synthesized from a path — the real node count. */
  let nodes = 0;

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r] as string[];
    if (isEmptyRow(row)) continue;
    if (row.length !== CSV_COLUMNS.length) {
      throw new BmParseError(
        'CSV_ROW_MISMATCH',
        `record ${r + 1} has ${row.length} fields, expected ${CSV_COLUMNS.length}`,
        r + 1,
      );
    }

    const [pathField = '', titleField = '', url = '', addDateField = ''] = row;
    const verdict = classifyHref(url);
    if (verdict === 'missing' || verdict === 'invalid') {
      // `place:` is kept: CSV is one of our own restore formats (docs/05 §1).
      warnings.add(verdict === 'missing' ? 'MISSING_URL' : 'INVALID_URL');
      continue;
    }

    const segments = splitPath(restoreFormula(pathField));
    if (segments.length + 1 > MAX_DEPTH) {
      throw new BmParseError('TOO_DEEP', `nesting deeper than ${MAX_DEPTH} levels`, r + 1);
    }
    const parsed = normalizeEpochSeconds(addDateField);
    if (parsed.invalid) warnings.add('INVALID_DATE');

    nodes +=
      1 +
      insertAt(
        roots,
        segments,
        {
          title: bookmarkTitle(restoreFormula(titleField), warnings),
          url,
          ...(parsed.seconds !== undefined && { addDate: parsed.seconds }),
        },
        index,
      );
    if (nodes > MAX_NODES) {
      throw new BmParseError('TOO_MANY_NODES', `more than ${MAX_NODES} nodes`, r + 1);
    }
  }

  if (roots.length === 0) warnings.add('NO_BOOKMARKS');
  return { roots, stats: computeStats(roots), warnings: warnings.toArray() };
}
