/**
 * CSV serializer — docs/04 §3.
 *
 * Purpose: a spreadsheet-friendly flattened projection of the tree.
 * Inputs: a tree, plus the delimiter chosen in Settings.
 * Guarantees: RFC 4180-style quoting, CRLF records, and a UTF-8 BOM so Excel
 *   detects the encoding on double-click.
 *
 * Deviations from RFC 4180 are deliberate and documented (docs/04 §3): the
 * header row is required, `;` is offered as a delimiter for locales whose
 * Excel list separator is not a comma, and the BOM is an Excel accommodation.
 */
import { joinPath } from '../csv-path';
import { type BookmarkNode, isFolder } from '../model';
import { CSV_COLUMNS } from '../parse/csv';

export const CSV_BOM = '﻿';
const CRLF = '\r\n';

export type CsvDelimiter = ',' | ';';

export interface CsvOptions {
  delimiter?: CsvDelimiter;
  /** Excel wants the BOM; other consumers may not. Default true (docs/04 §3). */
  bom?: boolean;
}

/** Quote when the field contains the delimiter, a quote, CR or LF. */
function quote(value: string, delimiter: string): string {
  const needsQuotes =
    value.includes(delimiter) ||
    value.includes('"') ||
    value.includes('\r') ||
    value.includes('\n');
  if (!needsQuotes) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

function collectRows(nodes: readonly BookmarkNode[], trail: string[], rows: string[][]): void {
  for (const node of nodes) {
    if (isFolder(node)) {
      // Empty folders produce no row and are therefore lost — docs/04 §3.
      collectRows(node.children ?? [], [...trail, node.title], rows);
      continue;
    }
    rows.push([
      joinPath(trail),
      node.title,
      node.url as string,
      node.addDate === undefined ? '' : String(node.addDate),
    ]);
  }
}

/** Serialize a tree to CSV. */
export function serializeCsv(roots: readonly BookmarkNode[], options: CsvOptions = {}): string {
  const delimiter = options.delimiter ?? ',';
  const rows: string[][] = [];
  collectRows(roots, [], rows);

  const lines = [
    CSV_COLUMNS.join(delimiter),
    ...rows.map((row) => row.map((field) => quote(field, delimiter)).join(delimiter)),
  ];

  const prefix = options.bom === false ? '' : CSV_BOM;
  return `${prefix}${lines.join(CRLF)}${CRLF}`;
}
