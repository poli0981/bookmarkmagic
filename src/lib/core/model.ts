/**
 * Core data model — the shapes every parser, serializer and planner speaks.
 *
 * Purpose: one definition of a bookmark tree, independent of any browser API.
 * Inputs: none (types + error classes only).
 * Guarantees: `BookmarkNode` is the FILE model and carries no ids. Anything
 *   touching the live browser tree uses `chrome.bookmarks.BookmarkTreeNode`,
 *   which already has `id`/`parentId`/`index` (docs/02 §4).
 *
 * Note `exactOptionalPropertyTypes` is on (docs/10 §2): build nodes by
 * OMITTING absent keys, never by assigning `undefined`.
 */

export interface BookmarkNode {
  title: string;
  /** Absent ⇒ this node is a folder. */
  url?: string;
  /** Epoch SECONDS. `chrome.bookmarks` uses milliseconds — convert at the adapter. */
  addDate?: number;
  /** Epoch SECONDS. */
  lastModified?: number;
  /** Netscape `PERSONAL_TOOLBAR_FOLDER`. Routing hint only — never stored by Chrome. */
  toolbar?: boolean;
  children?: BookmarkNode[];
}

export interface TreeStats {
  bookmarks: number;
  folders: number;
  maxDepth: number;
}

/** Non-fatal anomalies. Tolerated input never throws — it warns (docs/04 §1.2). */
export type ParseWarningCode =
  | 'NO_BOOKMARKS'
  | 'DESCRIPTIONS_DROPPED'
  | 'FAVICONS_IGNORED'
  | 'INVALID_DATE'
  | 'MISSING_URL'
  | 'NEWER_VERSION'
  | 'EMPTY_TITLE';

export interface ParseWarning {
  code: ParseWarningCode;
  /** How many nodes this warning aggregates. One warning per code, not per node. */
  count: number;
  detail?: string;
}

export interface ParseResult {
  /** Top-level nodes from the file. */
  roots: BookmarkNode[];
  stats: TreeStats;
  warnings: ParseWarning[];
}

export type FileFormat = 'netscape-html' | 'bm-json' | 'csv';

export type MergeMode = 'new-folder' | 'merge' | 'replace';

export interface PlanSegment {
  /** Chrome folder id to write this subtree under. Always resolved via getTree(). */
  rootId: string;
  nodes: BookmarkNode[];
}

export interface ImportPlan {
  mode: MergeMode;
  dedupe: boolean;
  segments: PlanSegment[];
  stats: {
    /** Total nodes across ALL segments — folders included. Drives the progress bar. */
    toCreate: number;
    /** Bookmarks only. Drives the "Import n bookmarks" button label. */
    bookmarkCount: number;
    /** Dropped because the URL already exists in the browser. */
    skippedExisting: number;
    /** Dropped because the URL repeats within the file. */
    skippedInFile: number;
  };
}

/** Closed code set — extend `docs/02 §7` before extending this union. */
export type BmParseErrorCode =
  | 'NOT_NETSCAPE'
  | 'NOT_BM_JSON'
  | 'MALFORMED_JSON'
  | 'INVALID_NODE'
  | 'BAD_CSV_HEADER'
  | 'CSV_ROW_MISMATCH'
  | 'UNKNOWN_FORMAT'
  | 'FILE_TOO_LARGE'
  | 'TOO_MANY_NODES'
  | 'TOO_DEEP';

/**
 * The only error type `core/` throws. Carries a stable machine code plus a
 * short human detail; the UI localizes by code and shows `detail` in the
 * copyable technical block (docs/02 §7).
 */
export class BmParseError extends Error {
  readonly code: BmParseErrorCode;
  readonly line: number | undefined;
  readonly detail: string | undefined;

  constructor(code: BmParseErrorCode, detail?: string, line?: number) {
    super(detail === undefined ? code : `${code}: ${detail}`);
    this.name = 'BmParseError';
    this.code = code;
    this.line = line;
    this.detail = detail;
  }
}

/** True when the node is a folder (no url). Narrows for callers. */
export function isFolder(node: BookmarkNode): boolean {
  return node.url === undefined;
}

/** Walk a tree depth-first, parents before children, siblings in order. */
export function* walkTree(
  nodes: readonly BookmarkNode[],
  depth = 1,
): Generator<{ node: BookmarkNode; depth: number }> {
  for (const node of nodes) {
    yield { node, depth };
    if (node.children !== undefined) yield* walkTree(node.children, depth + 1);
  }
}

/** Count bookmarks, folders and maximum depth in one pass. */
export function computeStats(roots: readonly BookmarkNode[]): TreeStats {
  let bookmarks = 0;
  let folders = 0;
  let maxDepth = 0;
  for (const { node, depth } of walkTree(roots)) {
    if (isFolder(node)) folders++;
    else bookmarks++;
    if (depth > maxDepth) maxDepth = depth;
  }
  return { bookmarks, folders, maxDepth };
}
