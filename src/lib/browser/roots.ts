/**
 * Which live folders are the browser's permanent roots — docs/02 §4.
 *
 * Purpose: find the import's destinations — the bar, Other, Mobile, and on
 *   Firefox the Bookmarks Menu — in whatever browser this runs in.
 * Guarantees: this device's roots only (a signed-in Chrome account's own roots
 *   are listed but never written to or emptied); policy-managed roots never;
 *   and on Firefox the Menu is never mistaken for the bar.
 */
import { browser } from 'wxt/browser';
import { getRootChildren } from './bookmarks';
import { BmEnvError } from './errors';
import type { LiveNode, ToNodesOptions } from './live-tree';

export interface BookmarkRoots {
  /** Bookmarks Bar. */
  toolbarId: string;
  /** Other Bookmarks. */
  otherId: string;
  /** Mobile Bookmarks, when the profile has one. */
  mobileId: string | undefined;
  /** Firefox's Bookmarks Menu. No Chromium browser has one. */
  menuId: string | undefined;
  /** The same roots as nodes, children included — Merge matches inside them. */
  toolbar: LiveNode;
  other: LiveNode;
  mobile: LiveNode | undefined;
  menu: LiveNode | undefined;
  /** Writable top-level folders, in tree order, excluding managed ones. */
  writable: LiveNode[];
  /**
   * The roots Replace backs up and empties: exactly the destinations above.
   * Never an account-storage root this import does not write back into —
   * deleting one would sync the deletion to every device, and the restore
   * would land its bookmarks in local storage.
   */
  replaceable: LiveNode[];
  /** Every top-level folder, managed ones included — what "already in this browser" means. */
  all: LiveNode[];
}

/** Chromium's stable ids for the three permanent folders. */
const CHROMIUM_IDS = { 'bookmarks-bar': '1', other: '2', mobile: '3' } as const;

/** Firefox's permanent folders — Places GUIDs, the same in every profile. */
const FIREFOX_IDS = {
  'bookmarks-bar': 'toolbar_____',
  other: 'unfiled_____',
  mobile: 'mobile______',
} as const;
const FIREFOX_MENU_ID = 'menu________';

/**
 * Desktop Chrome leaves an EMPTY Mobile root out of `getTree()`, so a restore
 * into a fresh profile found no Mobile root and nested those bookmarks under
 * Other. The node still exists, and accepts writes; ask for it by id. (Firefox
 * always lists its Mobile root, and rejects the id "3" — caught here.)
 */
async function hiddenMobileRoot(): Promise<LiveNode | undefined> {
  try {
    const [node] = (await browser.bookmarks.get(CHROMIUM_IDS.mobile)) as LiveNode[];
    const usable =
      node !== undefined &&
      node.url === undefined &&
      node.unmodifiable === undefined &&
      node.syncing !== true &&
      (node.folderType === undefined || node.folderType === 'mobile');
    return usable ? { ...node, children: node.children ?? [] } : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Resolve the destination roots.
 *
 * By `folderType` first — Chrome 134+ can list a signed-in account's own bar,
 * Other and Mobile beside this device's, and the old by-id-then-by-position
 * rule mixed the two sets up. Then the stable Chromium ids, then Firefox's
 * GUIDs, and position last. The Bookmarks Menu is never a candidate for a
 * position: Firefox lists it first, and until v1.3.0 the position fallback
 * took it for the bar — Replace would have emptied the Menu and the toolbar
 * and restored the bar's bookmarks into the Menu. Nodes carrying
 * `unmodifiable` (the enterprise "Managed bookmarks" folder) are excluded
 * everywhere — writing to or removing them rejects.
 */
export async function getRoots(): Promise<BookmarkRoots> {
  const children = await getRootChildren();
  const writable = children.filter((node) => node.unmodifiable === undefined);
  const local = writable.filter((node) => node.syncing !== true);
  const typed = local.some((node) => node.folderType !== undefined);
  const menu = local.find((node) => node.id === FIREFOX_MENU_ID);
  const positional = local.filter((node) => node !== menu);

  const pick = (type: keyof typeof CHROMIUM_IDS): LiveNode | undefined =>
    local.find((node) => node.folderType === type) ??
    local.find((node) => node.id === CHROMIUM_IDS[type]) ??
    local.find((node) => node.id === FIREFOX_IDS[type]);
  const toolbar = pick('bookmarks-bar') ?? (typed ? undefined : positional[0]);
  const other = pick('other') ?? (typed ? undefined : positional.find((n) => n !== toolbar));
  const mobile =
    pick('mobile') ??
    (typed ? undefined : positional.find((n) => n !== toolbar && n !== other)) ??
    (await hiddenMobileRoot());

  if (toolbar === undefined || other === undefined) {
    // Not a BmBrowserError: nothing refused anything. Every root this profile
    // has is policy-managed, so there is nowhere an extension may write, and
    // "the browser refused a bookmark operation" would be actively misleading.
    throw new BmEnvError('NO_WRITABLE_ROOTS', `${children.length} root(s), none writable`);
  }

  const replaceable = [toolbar, other];
  if (mobile !== undefined) replaceable.push(mobile);
  if (menu !== undefined) replaceable.push(menu);
  return {
    toolbarId: toolbar.id,
    otherId: other.id,
    mobileId: mobile?.id,
    menuId: menu?.id,
    toolbar,
    other,
    mobile,
    menu,
    writable,
    replaceable,
    all: children,
  };
}

/** The marker ids for a whole-tree conversion — what an export or backup passes. */
export function rootMarkersOf(roots: BookmarkRoots): ToNodesOptions {
  return {
    toolbarId: roots.toolbarId,
    otherId: roots.otherId,
    ...(roots.mobileId !== undefined && { mobileId: roots.mobileId }),
    ...(roots.menuId !== undefined && { menuId: roots.menuId }),
  };
}
