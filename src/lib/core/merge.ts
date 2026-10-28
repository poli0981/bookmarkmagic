/**
 * Merge planning — docs/05 §5, docs/03 §1 step 7.
 *
 * Purpose: for the nodes bound for one live folder, find the folders that
 *   already exist there and write into them, instead of creating a second
 *   "Dev" next to the first one — which is what Merge did in 1.0.x.
 * Inputs: the nodes for one destination root; that root as read from
 *   `getTree()`, children included.
 * Guarantees: pure. A file folder matches a live CHILD folder of the folder its
 *   parent matched, by exact, case-sensitive title; the first such child wins,
 *   and policy-managed folders never match. Matched folders are never created,
 *   moved or renamed; new items are appended to them (no index). Replace plans
 *   through here too, against roots it has just emptied, so nothing matches.
 */
import { type BookmarkNode, isFolder, type PlanSegment } from './model';

/** The live-tree fields matching needs. `browser/bookmarks.ts`' `LiveNode` satisfies it. */
export interface LiveFolderLike {
  id: string;
  title: string;
  url?: string;
  /** Set by Chrome on policy-managed nodes, which reject writes. */
  unmodifiable?: string;
  children?: readonly LiveFolderLike[];
}

export interface FolderPlan {
  /** One segment per live folder that receives new items, in first-use order. */
  segments: PlanSegment[];
  /** File folders that matched a live folder and were not created. */
  reusedFolders: number;
}

/** First writable child folder per title. */
function foldersByTitle(parent: LiveFolderLike): Map<string, LiveFolderLike> {
  const byTitle = new Map<string, LiveFolderLike>();
  for (const child of parent.children ?? []) {
    if (child.url !== undefined || child.unmodifiable !== undefined) continue;
    if (!byTitle.has(child.title)) byTitle.set(child.title, child);
  }
  return byTitle;
}

/**
 * Plan writing `nodes` into `destination`.
 *
 * Recursion follows the FILE tree, which the parsers cap at 200 levels; the
 * live tree is only ever read one matched folder at a time.
 */
export function planIntoFolder(
  nodes: readonly BookmarkNode[],
  destination: LiveFolderLike,
): FolderPlan {
  const segments = new Map<string, PlanSegment>();
  let reusedFolders = 0;

  const emit = (parent: LiveFolderLike, trail: readonly string[], node: BookmarkNode): void => {
    let segment = segments.get(parent.id);
    if (segment === undefined) {
      segment = { parentId: parent.id, nodes: [], ...(trail.length > 0 && { trail: [...trail] }) };
      segments.set(parent.id, segment);
    }
    segment.nodes.push(node);
  };

  const visit = (
    list: readonly BookmarkNode[],
    parent: LiveFolderLike,
    trail: readonly string[],
  ): void => {
    let folders: Map<string, LiveFolderLike> | undefined;
    for (const node of list) {
      if (isFolder(node)) {
        folders ??= foldersByTitle(parent);
        const match = folders.get(node.title);
        if (match !== undefined) {
          reusedFolders++;
          visit(node.children ?? [], match, [...trail, node.title]);
          continue;
        }
      }
      emit(parent, trail, node);
    }
  };

  visit(nodes, destination, []);
  return { segments: [...segments.values()], reusedFolders };
}
