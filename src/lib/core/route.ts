/**
 * Top-level routing — docs/03 §1 step 7, docs/02 §4.
 *
 * Purpose: decide which browser root each top-level node of a file lands in.
 * Inputs: the (deduped) top-level nodes; whether the profile has a Mobile root,
 *   and whether it has a Bookmarks Menu (Firefox).
 * Guarantees: pure. Markers are read on TOP-LEVEL nodes only — deeper they are
 *   carried as data. A marked folder IS that root, so it is unwrapped: its
 *   children go into the root and the folder itself is never written, which is
 *   what used to produce "Other bookmarks/Other bookmarks" on every restore.
 */
import { type BookmarkNode, isFolder } from './model';

export interface RoutedNodes {
  toolbar: BookmarkNode[];
  other: BookmarkNode[];
  mobile: BookmarkNode[];
  /** Firefox's Bookmarks Menu; always empty without one. */
  menu: BookmarkNode[];
  /** Marked folders that were unwrapped rather than written. */
  unwrapped: number;
}

/** `push(...list)` throws on a list of ~100k — the size of a real Other Bookmarks. */
function append(target: BookmarkNode[], list: readonly BookmarkNode[] | undefined): void {
  for (const node of list ?? []) target.push(node);
}

/**
 * Route top-level nodes:
 *  - `toolbar` folder → its children into the bar (a `toolbar` bookmark, which
 *    is malformed but possible, goes to the bar as itself);
 *  - `root: 'other'` folder → its children into Other, in its place in the order;
 *  - `root: 'mobile'` folder → its children into Mobile; a profile with no
 *    Mobile root keeps it as an ordinary folder under Other instead;
 *  - `root: 'menu'` folder → its children into the Bookmarks Menu; a browser
 *    with none (every Chromium one) keeps it as an ordinary folder under Other;
 *  - everything else → the Bookmarks Menu where there is one — what Firefox's
 *    own import does with the loose entries its own export writes — else Other.
 */
export function routeTopLevel(
  nodes: readonly BookmarkNode[],
  options: { hasMobileRoot: boolean; hasMenuRoot?: boolean },
): RoutedNodes {
  const routed: RoutedNodes = { toolbar: [], other: [], mobile: [], menu: [], unwrapped: 0 };
  const loose = options.hasMenuRoot === true ? routed.menu : routed.other;
  for (const node of nodes) {
    if (node.toolbar === true) {
      if (isFolder(node)) {
        append(routed.toolbar, node.children);
        routed.unwrapped++;
      } else {
        routed.toolbar.push(node);
      }
    } else if (isFolder(node) && node.root === 'other') {
      append(routed.other, node.children);
      routed.unwrapped++;
    } else if (isFolder(node) && node.root === 'mobile' && options.hasMobileRoot) {
      append(routed.mobile, node.children);
      routed.unwrapped++;
    } else if (isFolder(node) && node.root === 'menu' && options.hasMenuRoot === true) {
      append(routed.menu, node.children);
      routed.unwrapped++;
    } else if (isFolder(node) && (node.root === 'menu' || node.root === 'mobile')) {
      // A root this browser does not have stays a folder, under Other.
      routed.other.push(node);
    } else {
      loose.push(node);
    }
  }
  return routed;
}
