/**
 * Import planning — docs/03 §1 steps 6-7, docs/02 §4.
 *
 * Purpose: turn a parsed file plus the user's choices into the exact set of
 *   writes, with the counts the UI reports. Nothing here touches the browser;
 *   root ids are resolved by the caller and passed in.
 * Inputs: parsed roots, merge mode, dedupe flag, an index of the current
 *   browser tree, and the resolved destination root ids.
 * Guarantees: pure; the returned plan is independent of the input tree.
 */
import { dedupeAgainst, type UrlIndex } from './dedupe';
import {
  type BookmarkNode,
  type ImportPlan,
  isFolder,
  type MergeMode,
  type PlanSegment,
  walkTree,
} from './model';

export interface BuildPlanOptions {
  /** Parsed file tree. */
  roots: readonly BookmarkNode[];
  mode: MergeMode;
  dedupe: boolean;
  /** Normalized URLs already in the browser. Ignored for `replace` — see below. */
  browserIndex: UrlIndex;
  /** Resolved via `browser/bookmarks.ts`, never hardcoded to "1"/"2". */
  toolbarRootId: string;
  otherRootId: string;
  /** Full localized wrapper title for new-folder mode, e.g. "Imported 2026-07-25 14:05". */
  newFolderTitle: string;
}

const EMPTY_INDEX: UrlIndex = new Set<string>();

/** Split top-level nodes into the toolbar-bound and everything-else halves. */
function partitionByToolbar(nodes: readonly BookmarkNode[]): {
  toolbar: BookmarkNode[];
  other: BookmarkNode[];
} {
  const toolbar: BookmarkNode[] = [];
  const other: BookmarkNode[] = [];
  for (const node of nodes) {
    // A `toolbar: true` folder REPRESENTS the bar, so its children go into the
    // bar — writing the folder itself would produce "Bookmarks bar/Bookmarks
    // bar". A bookmark carrying the flag (malformed, but possible) is written
    // to the bar directly.
    if (node.toolbar === true && isFolder(node)) toolbar.push(...(node.children ?? []));
    else if (node.toolbar === true) toolbar.push(node);
    else other.push(node);
  }
  return { toolbar, other };
}

function countNodes(segments: readonly PlanSegment[]): { toCreate: number; bookmarkCount: number } {
  let toCreate = 0;
  let bookmarkCount = 0;
  for (const segment of segments) {
    for (const { node } of walkTree(segment.nodes)) {
      toCreate++;
      if (!isFolder(node)) bookmarkCount++;
    }
  }
  return { toCreate, bookmarkCount };
}

/**
 * Build the write plan.
 *
 * Replace mode deliberately plans against an EMPTY browser index: the tree is
 * deleted before the write, so nothing can already exist. Using the live index
 * would skip every bookmark of a user restoring their own backup and leave
 * them with nothing (docs/05 §3).
 */
export function buildImportPlan(options: BuildPlanOptions): ImportPlan {
  const { mode, dedupe, roots, toolbarRootId, otherRootId, newFolderTitle } = options;
  const index = mode === 'replace' ? EMPTY_INDEX : options.browserIndex;

  const filtered = dedupe
    ? dedupeAgainst(roots, index)
    : { nodes: roots.map(cloneNode), skippedExisting: 0, skippedInFile: 0 };

  const segments: PlanSegment[] =
    mode === 'new-folder'
      ? [{ rootId: otherRootId, nodes: [{ title: newFolderTitle, children: filtered.nodes }] }]
      : buildSplitSegments(filtered.nodes, toolbarRootId, otherRootId);

  return {
    mode,
    dedupe,
    segments,
    stats: {
      ...countNodes(segments),
      skippedExisting: filtered.skippedExisting,
      skippedInFile: filtered.skippedInFile,
    },
  };
}

function buildSplitSegments(
  nodes: readonly BookmarkNode[],
  toolbarRootId: string,
  otherRootId: string,
): PlanSegment[] {
  const { toolbar, other } = partitionByToolbar(nodes);
  const segments: PlanSegment[] = [];
  // A segment with no nodes is omitted, not emitted empty (docs/02 §4).
  if (toolbar.length > 0) segments.push({ rootId: toolbarRootId, nodes: toolbar });
  if (other.length > 0) segments.push({ rootId: otherRootId, nodes: other });
  return segments;
}

/** Deep copy, so a plan never aliases the parsed tree the preview still shows. */
function cloneNode(node: BookmarkNode): BookmarkNode {
  return node.children === undefined
    ? { ...node }
    : { ...node, children: node.children.map(cloneNode) };
}
