/**
 * Helpers every parser shares — docs/05 §1.
 *
 * Purpose: one implementation of the rules all five readers must agree on —
 *   how warnings aggregate, how the node and depth caps are counted, and what a
 *   bookmark's title becomes — so a fix lands in every format at once.
 * Inputs / guarantees: pure; throws `BmParseError` only.
 */
import { MAX_DEPTH, MAX_NODES } from '../limits';
import { BmParseError, type ParseWarning, type ParseWarningCode } from '../model';

/** One warning per code, counting occurrences (docs/04 §1.2). */
export class WarningBag {
  private readonly counts = new Map<ParseWarningCode, number>();
  private readonly details = new Map<ParseWarningCode, string>();

  /** A zero increment is a no-op — never emit a warning with count 0. */
  add(code: ParseWarningCode, times = 1): void {
    if (times <= 0) return;
    this.counts.set(code, (this.counts.get(code) ?? 0) + times);
  }

  /** Record a one-off warning that carries a detail line (the last one wins). */
  note(code: ParseWarningCode, detail: string): void {
    this.details.set(code, detail);
    this.add(code);
  }

  toArray(): ParseWarning[] {
    return [...this.counts].map(([code, count]) => {
      const detail = this.details.get(code);
      return detail === undefined ? { code, count } : { code, count, detail };
    });
  }
}

/** Strip one leading U+FEFF (the read layer usually has already). */
export function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/** The node and depth caps (docs/09 T2), counted the same way in every reader. */
export class NodeBudget {
  private nodes = 0;

  /** Count one node. @throws {BmParseError} `TOO_MANY_NODES` past MAX_NODES. */
  count(where?: string): void {
    this.nodes++;
    if (this.nodes > MAX_NODES) {
      throw new BmParseError('TOO_MANY_NODES', `more than ${MAX_NODES} nodes${at(where)}`);
    }
  }

  /** @throws {BmParseError} `TOO_DEEP` past MAX_DEPTH. */
  depth(depth: number, where?: string): void {
    if (depth > MAX_DEPTH) {
      throw new BmParseError('TOO_DEEP', `nesting deeper than ${MAX_DEPTH} levels${at(where)}`);
    }
  }
}

function at(where: string | undefined): string {
  return where === undefined ? '' : ` at ${where}`;
}

/**
 * A bookmark's title, kept exactly as written — empty included.
 *
 * It used to fall back to the address when empty, which turned a favicon-only
 * Bookmarks Bar (titles cleared on purpose, a common setup) into a row of full
 * URLs after an export/import cycle. Chrome itself shows the address for an
 * untitled bookmark wherever a title is needed, so the empty title is the
 * lossless choice; the warning just says how many there were.
 */
export function bookmarkTitle(title: string, warnings: WarningBag): string {
  if (title.trim() === '') warnings.add('EMPTY_TITLE');
  return title;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * `JSON.parse`, with the failure mapped to the parser error taxonomy.
 *
 * @throws {BmParseError} `MALFORMED_JSON`.
 */
export function parseJsonText(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new BmParseError('MALFORMED_JSON', err instanceof Error ? err.message : 'invalid JSON');
  }
}

/**
 * Display titles for browser roots a file names only by an internal key —
 * Firefox's `toolbar`/`unfiled`/`mobile`. Passed in by the caller so `core/`
 * stays free of UI strings (docs/07 §1); a missing title falls back to the
 * file's own key, never to English.
 */
export interface RootTitles {
  toolbar?: string;
  other?: string;
  mobile?: string;
}
