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

/** A top-level folder that stands for a browser root other than the bar (docs/04 §1.1, §2). */
export type RootMarker = 'other' | 'mobile';

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
  /**
   * Folders only: this folder IS the browser's Other or Mobile bookmarks root,
   * so an import unwraps it into that root instead of nesting a copy of it
   * (docs/03 §1). `toolbar` wins when both are set. Routing reads it on
   * top-level folders only; deeper, it is carried as data.
   */
  root?: RootMarker;
  children?: BookmarkNode[];
}

export interface TreeStats {
  bookmarks: number;
  folders: number;
  maxDepth: number;
}

/**
 * Non-fatal anomalies. Tolerated input never throws — it warns (docs/04 §1.2).
 * A runtime list, so `dictionaries.test.ts` can require a message for each.
 */
export const PARSE_WARNING_CODES = [
  'NO_BOOKMARKS',
  'DESCRIPTIONS_DROPPED',
  'FAVICONS_IGNORED',
  'INVALID_DATE',
  'MISSING_URL',
  'NEWER_VERSION',
  'EMPTY_TITLE',
  'INVALID_URL',
  'PLACE_QUERIES_SKIPPED',
  'EXTRA_ROOTS_SKIPPED',
  'UNREADABLE_ENTRIES',
] as const;

export type ParseWarningCode = (typeof PARSE_WARNING_CODES)[number];

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

/** What a file was read as — decided by content, never the extension (docs/04 intro). */
export type FileFormat = 'netscape-html' | 'bm-json' | 'csv' | 'chrome-json' | 'firefox-json';

export type MergeMode = 'new-folder' | 'merge' | 'replace';

export interface PlanSegment {
  /**
   * Live folder to write these nodes under: a browser root, or — in Merge — a
   * folder that already exists. Always an id read from `getTree()`, never one
   * hardcoded or created by this plan (docs/02 §4).
   */
  parentId: string;
  /** Created in order and appended; each node's own children nest inside it. */
  nodes: BookmarkNode[];
  /** Titles from the destination root down to `parentId`, for the progress line. */
  trail?: string[];
}

export interface ImportPlan {
  mode: MergeMode;
  /** The EFFECTIVE setting: always false for Replace, whatever the checkbox said. */
  dedupe: boolean;
  segments: PlanSegment[];
  stats: {
    /** Total nodes across ALL segments — folders included. Drives the progress bar. */
    toCreate: number;
    /** Bookmarks only. Drives the "Import n bookmarks" button label. */
    bookmarkCount: number;
    /** Folders to create, the new-folder wrapper included. */
    folderCount: number;
    /** Existing folders Merge writes into instead of creating a copy. */
    reusedFolders: number;
    /** Deepest level a created node will sit at, counted below its browser root. */
    writeDepth: number;
    /** Dropped because the URL already exists in the browser. */
    skippedExisting: number;
    /** Dropped because the URL repeats within the file. */
    skippedInFile: number;
  };
}

/** Closed code set — extend `docs/02 §7` before extending this list. */
export const BM_PARSE_ERROR_CODES = [
  'NOT_NETSCAPE',
  'NOT_BM_JSON',
  'MALFORMED_JSON',
  'INVALID_NODE',
  'BAD_CSV_HEADER',
  'CSV_ROW_MISMATCH',
  'CSV_UNCLOSED_QUOTE',
  'UNKNOWN_FORMAT',
  'FILE_TOO_LARGE',
  'TOO_MANY_NODES',
  'TOO_DEEP',
] as const;

export type BmParseErrorCode = (typeof BM_PARSE_ERROR_CODES)[number];

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

/** True when the node is a folder (no url). */
export function isFolder(node: BookmarkNode): boolean {
  return node.url === undefined;
}

/** True when the node is a bookmark — and narrows `url` to a string for the caller. */
export function isBookmark(node: BookmarkNode): node is BookmarkNode & { url: string } {
  return node.url !== undefined;
}

/**
 * Walk a tree depth-first, parents before children, siblings in order.
 *
 * Iterative, with an explicit stack: the recursive `yield*` version cost
 * O(depth) per node, and the live browser tree it also walks has no depth cap,
 * so recursion could overflow on a pathological profile (docs/05 §1).
 */
export function* walkTree(
  nodes: readonly BookmarkNode[],
  depth = 1,
): Generator<{ node: BookmarkNode; depth: number }> {
  const stack: { list: readonly BookmarkNode[]; index: number; depth: number }[] = [
    { list: nodes, index: 0, depth },
  ];
  while (stack.length > 0) {
    // SAFETY: the loop condition guarantees a top frame.
    const frame = stack[stack.length - 1] as (typeof stack)[number];
    const node = frame.list[frame.index];
    if (node === undefined) {
      stack.pop();
      continue;
    }
    frame.index++;
    yield { node, depth: frame.depth };
    if (node.children !== undefined && node.children.length > 0) {
      stack.push({ list: node.children, index: 0, depth: frame.depth + 1 });
    }
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
