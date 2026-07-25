/**
 * folder_path encoding for CSV — docs/04 §3.
 *
 * Purpose: `/` separates folders, so a literal `/` inside a folder NAME must
 *   be escaped, and the escape character with it.
 * Inputs / guarantees: `splitPath(joinPath(x))` deep-equals `x` for any
 *   segment content, including backslashes and slashes.
 */

/**
 * A single empty segment cannot be written as `''` — that is indistinguishable
 * from "no path at all", so a folder with an empty title would be dissolved by
 * an export/import cycle. A lone backslash is unreachable from normal escaping
 * (every literal `\` is doubled), so it is free to use as the marker.
 */
const EMPTY_SEGMENT = '\\';

/** Join folder titles into a single path field, escaping `\` then `/`. */
export function joinPath(segments: readonly string[]): string {
  if (segments.length === 1 && segments[0] === '') return EMPTY_SEGMENT;
  return segments.map((s) => s.replace(/\\/g, '\\\\').replace(/\//g, '\\/')).join('/');
}

/** Split a path field back into folder titles, honouring `\\` and `\/`. */
export function splitPath(path: string): string[] {
  if (path === '') return [];
  if (path === EMPTY_SEGMENT) return [''];

  const segments: string[] = [];
  let current = '';
  let escaped = false;

  for (const ch of path) {
    if (escaped) {
      // Only `\` and `/` are meaningful escapes; anything else keeps the
      // backslash so unknown sequences survive a round trip unchanged.
      current += ch === '\\' || ch === '/' ? ch : `\\${ch}`;
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      continue;
    }
    if (ch === '/') {
      segments.push(current);
      current = '';
      continue;
    }
    current += ch;
  }

  if (escaped) current += '\\'; // trailing lone backslash
  segments.push(current);
  return segments;
}
