/**
 * Import planning — docs/03 §1 step 7, docs/02 §4.
 *
 * Purpose: turn a parsed file plus the user's choices into the exact set of
 *   writes, with the counts the UI reports. Nothing here touches the browser;
 *   the destination roots are read by the caller and passed in.
 * Inputs: parsed roots, merge mode, the dedupe preference, an index of the
 *   current browser tree, and the live destination roots.
 * Guarantees: pure; the returned plan never aliases the parsed tree the
 *   preview still shows; every segment's `parentId` is a live id.
 */
import { dedupeAgainst, type UrlIndex } from './dedupe';
import { type LiveFolderLike, planIntoFolder } from './merge';
import {
  type BookmarkNode,
  type ImportPlan,
  isFolder,
  type MergeMode,
  type PlanSegment,
  walkTree,
} from './model';
import { routeTopLevel } from './route';

export interface PlanDestinations {
  toolbar: LiveFolderLike;
  other: LiveFolderLike;
  /** Absent when the profile has none; Mobile-marked folders then land under Other. */
  mobile?: LiveFolderLike;
}

export interface BuildPlanOptions {
  /** Parsed file tree. */
  roots: readonly BookmarkNode[];
  mode: MergeMode;
  /** The user's preference. Replace overrides it — see `buildImportPlan`. */
  dedupe: boolean;
  /** Normalized URLs already in the browser. Unused when dedupe is off. */
  browserIndex: UrlIndex;
  /** The live roots, children included — Merge matches folders inside them. */
  destinations: PlanDestinations;
  /** Full localized wrapper title for new-folder mode, e.g. "Imported 2026-07-25 14:05". */
  newFolderTitle: string;
}

function countNodes(
  segments: readonly PlanSegment[],
): Pick<ImportPlan['stats'], 'toCreate' | 'bookmarkCount' | 'folderCount' | 'writeDepth'> {
  let toCreate = 0;
  let bookmarkCount = 0;
  let writeDepth = 0;
  for (const segment of segments) {
    // A segment writes under its root or under a reused folder `trail` deep.
    const base = segment.trail?.length ?? 0;
    for (const { node, depth } of walkTree(segment.nodes)) {
      toCreate++;
      if (!isFolder(node)) bookmarkCount++;
      if (base + depth > writeDepth) writeDepth = base + depth;
    }
  }
  return { toCreate, bookmarkCount, folderCount: toCreate - bookmarkCount, writeDepth };
}

/** A root as Replace will find it: emptied, so nothing in it can match. */
function emptied(root: LiveFolderLike): LiveFolderLike {
  return { id: root.id, title: root.title, children: [] };
}

function planSplit(
  nodes: readonly BookmarkNode[],
  destinations: PlanDestinations,
  mode: 'merge' | 'replace',
): { segments: PlanSegment[]; reusedFolders: number } {
  const routed = routeTopLevel(nodes, { hasMobileRoot: destinations.mobile !== undefined });
  const targets: [BookmarkNode[], LiveFolderLike | undefined][] = [
    [routed.toolbar, destinations.toolbar],
    [routed.other, destinations.other],
    [routed.mobile, destinations.mobile],
  ];
  const segments: PlanSegment[] = [];
  let reusedFolders = 0;
  for (const [list, root] of targets) {
    // A root with nothing bound for it gets no segment (docs/02 §4).
    if (root === undefined || list.length === 0) continue;
    const part = planIntoFolder(list, mode === 'replace' ? emptied(root) : root);
    for (const segment of part.segments) segments.push(segment);
    reusedFolders += part.reusedFolders;
  }
  return { segments, reusedFolders };
}

/**
 * Build the write plan.
 *
 * Replace never dedupes. It restores a file exactly, in-file repeats included,
 * into a tree it has just deleted — so neither "already in this browser" nor
 * "repeated in the file" is a reason to drop anything, and a checked box left
 * over from another mode must not silently thin out someone's backup.
 */
export function buildImportPlan(options: BuildPlanOptions): ImportPlan {
  const { mode, roots, destinations, newFolderTitle } = options;
  const dedupe = options.dedupe && mode !== 'replace';

  const filtered = dedupe
    ? dedupeAgainst(roots, options.browserIndex)
    : { nodes: roots.map(cloneNode), skippedExisting: 0, skippedInFile: 0 };

  const { segments, reusedFolders } =
    mode === 'new-folder'
      ? {
          segments: [
            {
              parentId: destinations.other.id,
              nodes: [{ title: newFolderTitle, children: filtered.nodes }],
            },
          ],
          reusedFolders: 0,
        }
      : planSplit(filtered.nodes, destinations, mode);

  return {
    mode,
    dedupe,
    segments,
    stats: {
      ...countNodes(segments),
      reusedFolders,
      skippedExisting: filtered.skippedExisting,
      skippedInFile: filtered.skippedInFile,
    },
  };
}

/** Deep copy, so a plan never aliases the parsed tree the preview still shows. */
function cloneNode(node: BookmarkNode): BookmarkNode {
  return node.children === undefined
    ? { ...node }
    : { ...node, children: node.children.map(cloneNode) };
}
