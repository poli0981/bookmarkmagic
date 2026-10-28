/**
 * Which slice of the flattened tree is mounted — docs/05 §9.
 *
 * Purpose: bound the DOM to a window of rows that always holds the focused
 *   one. 1.1.0's first cut grew a prefix from row 0 instead, so End or a
 *   type-ahead jump to row 20 000 mounted all 20 000 rows: a 3.9 s freeze,
 *   then ~200 ms per arrow key (v1.1.0 review).
 * Guarantees: pure; a mounted range always lies inside `[0, total]` and holds
 *   the focus whenever one is given.
 */

/** Rows mounted at a time, and the step of "Show earlier" / "Show more". */
export const WINDOW = 500;

export interface RowWindow {
  /** First row the window would like to start at. */
  start: number;
  /** How many rows it holds. */
  size: number;
}

export interface MountedRange {
  /** First mounted row. */
  from: number;
  /** One past the last mounted row. */
  to: number;
}

export const INITIAL_WINDOW: RowWindow = { start: 0, size: WINDOW };

/** The rows a window actually mounts once fitted to `total`. */
export function mounted(win: RowWindow, total: number): MountedRange {
  const from = Math.max(0, Math.min(win.start, total - win.size));
  return { from, to: Math.min(total, from + win.size) };
}

/**
 * The window that shows row `focus`: `win` itself when the row is already
 * mounted, else a fresh window centred on it. `focus` −1 means no focus.
 */
export function follow(win: RowWindow, focus: number, total: number): RowWindow {
  if (focus < 0 || focus >= total) return win;
  const { from, to } = mounted(win, total);
  if (focus >= from && focus < to) return win;
  return { start: Math.max(0, focus - WINDOW / 2), size: WINDOW };
}

/** Mount up to `WINDOW` more rows above the current ones. */
export function showEarlier(win: RowWindow, total: number): RowWindow {
  const { from, to } = mounted(win, total);
  const start = Math.max(0, from - WINDOW);
  return { start, size: to - start };
}

/** Mount up to `WINDOW` more rows below the current ones. */
export function showLater(win: RowWindow, total: number): RowWindow {
  const { from, to } = mounted(win, total);
  return { start: from, size: Math.min(total, to + WINDOW) - from };
}
