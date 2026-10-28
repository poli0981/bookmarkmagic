/**
 * Firefox JSON backup reader — docs/04 §2b.
 *
 * Purpose: import `bookmarks-YYYY-MM-DD.json`, the file Firefox writes from
 *   Library → Import and Backup → Backup…. Unlike Firefox's HTML export it
 *   keeps the Mobile root, and it is what people tend to have when a profile
 *   is lost.
 * Inputs: an already-parsed document (`parse-file.ts` parses once and routes
 *   by shape), plus display titles for the roots Firefox names only by key.
 * Guarantees: emits the same tree Firefox's own HTML export describes for the
 *   same profile (docs/04 §2b parity rule), with the Mobile root added.
 *   Separators are skipped silently, as `<HR>` is; `place:` smart bookmarks
 *   are skipped and counted; the tags root is dropped, because it is a view
 *   over bookmarks the other roots already hold.
 */
import { classifyHref } from '../href';
import {
  BmParseError,
  type BookmarkNode,
  computeStats,
  type ParseResult,
  type RootMarker,
} from '../model';
import { microsToSeconds } from '../timestamps';
import { bookmarkTitle, isRecord, NodeBudget, type RootTitles, WarningBag } from './shared';

const CONTAINER = 'text/x-moz-place-container';
const PLACE = 'text/x-moz-place';
const SEPARATOR = 'text/x-moz-place-separator';
const DESCRIPTION_ANNO = 'bookmarkProperties/description';

interface ReadContext {
  budget: NodeBudget;
  warnings: WarningBag;
}

type Kind = 'folder' | 'bookmark' | 'separator' | 'unknown';

/** The shape test the JSON dispatch routes by. */
export function looksLikeFirefoxBackup(doc: unknown): doc is Record<string, unknown> & {
  children: unknown[];
} {
  return (
    isRecord(doc) &&
    (doc.type === CONTAINER || doc.root === 'placesRoot') &&
    Array.isArray(doc.children)
  );
}

function kindOf(raw: Record<string, unknown>): Kind {
  if (raw.type === CONTAINER || raw.typeCode === 2) return 'folder';
  if (raw.type === PLACE || raw.typeCode === 1) return 'bookmark';
  if (raw.type === SEPARATOR || raw.typeCode === 3) return 'separator';
  return 'unknown';
}

function readDates(
  raw: Record<string, unknown>,
  warnings: WarningBag,
): Pick<BookmarkNode, 'addDate' | 'lastModified'> {
  const add = microsToSeconds(raw.dateAdded);
  const mod = microsToSeconds(raw.lastModified);
  if (add.invalid) warnings.add('INVALID_DATE');
  if (mod.invalid) warnings.add('INVALID_DATE');
  return {
    ...(add.seconds !== undefined && { addDate: add.seconds }),
    ...(mod.seconds !== undefined && { lastModified: mod.seconds }),
  };
}

/** Counted where the HTML export would have written a `<DD>`. */
function noteDescription(raw: Record<string, unknown>, warnings: WarningBag): void {
  const annos = Array.isArray(raw.annos) ? raw.annos : [];
  if (annos.some((anno) => isRecord(anno) && anno.name === DESCRIPTION_ANNO)) {
    warnings.add('DESCRIPTIONS_DROPPED');
  }
}

function readBookmark(raw: Record<string, unknown>, ctx: ReadContext): BookmarkNode | null {
  const uri = typeof raw.uri === 'string' ? raw.uri : undefined;
  switch (classifyHref(uri)) {
    case 'missing':
      ctx.warnings.add('MISSING_URL');
      return null;
    case 'invalid':
      ctx.warnings.add('INVALID_URL');
      return null;
    case 'place-query':
      ctx.warnings.add('PLACE_QUERIES_SKIPPED');
      return null;
    case 'ok':
      break;
  }
  ctx.budget.count();
  // Older backups spell it `iconuri`.
  const icon = raw.iconUri ?? raw.iconuri;
  if (typeof icon === 'string' && icon !== '') ctx.warnings.add('FAVICONS_IGNORED');
  noteDescription(raw, ctx.warnings);
  return {
    title: bookmarkTitle(typeof raw.title === 'string' ? raw.title : '', ctx.warnings),
    // SAFETY: classifyHref returned 'ok', which it only does for a string.
    url: uri as string,
    ...readDates(raw, ctx.warnings),
  };
}

function readChildren(raw: unknown, depth: number, ctx: ReadContext): BookmarkNode[] {
  const out: BookmarkNode[] = [];
  if (!Array.isArray(raw)) return out;
  for (const child of raw) {
    ctx.budget.depth(depth);
    const node = readNode(child, depth, ctx);
    if (node !== null) out.push(node);
  }
  return out;
}

function readFolder(
  raw: Record<string, unknown>,
  title: string,
  depth: number,
  ctx: ReadContext,
): BookmarkNode & { children: BookmarkNode[] } {
  ctx.budget.count();
  noteDescription(raw, ctx.warnings);
  return {
    title,
    ...readDates(raw, ctx.warnings),
    children: readChildren(raw.children, depth + 1, ctx),
  };
}

function readNode(raw: unknown, depth: number, ctx: ReadContext): BookmarkNode | null {
  if (!isRecord(raw)) {
    ctx.warnings.add('UNREADABLE_ENTRIES');
    return null;
  }
  switch (kindOf(raw)) {
    case 'folder':
      return readFolder(raw, typeof raw.title === 'string' ? raw.title : '', depth, ctx);
    case 'bookmark':
      return readBookmark(raw, ctx);
    case 'separator':
      return null;
    case 'unknown':
      ctx.warnings.add('UNREADABLE_ENTRIES');
      return null;
  }
}

/** Bookmarks under a root this reader does not import. Iterative — never depth-checked. */
function countBookmarks(root: unknown): number {
  let count = 0;
  const stack: unknown[] = [root];
  while (stack.length > 0) {
    const node = stack.pop();
    if (!isRecord(node)) continue;
    if (kindOf(node) === 'bookmark') count++;
    if (Array.isArray(node.children)) for (const child of node.children) stack.push(child);
  }
  return count;
}

/** A Map, not an object literal: `root: "toString"` must not find a prototype method. */
const ROOT_KEYS = new Map<unknown, 'toolbar' | RootMarker>([
  ['toolbarFolder', 'toolbar'],
  ['unfiledBookmarksFolder', 'other'],
  ['mobileFolder', 'mobile'],
]);

/**
 * The places root's children, in the order Firefox's HTML export writes them:
 * the menu's contents loose at the top level, then the toolbar and Other
 * Bookmarks as folders, each only when it holds something — and then Mobile,
 * which the HTML export leaves out altogether.
 */
function readPlacesRoot(
  children: readonly unknown[],
  titles: RootTitles,
  ctx: ReadContext,
): BookmarkNode[] {
  const menu: BookmarkNode[] = [];
  const special: Partial<Record<'toolbar' | RootMarker, BookmarkNode>> = {};

  for (const child of children) {
    if (!isRecord(child)) {
      ctx.warnings.add('UNREADABLE_ENTRIES');
      continue;
    }
    if (child.root === 'bookmarksMenuFolder') {
      for (const node of readChildren(child.children, 1, ctx)) menu.push(node);
      continue;
    }
    if (child.root === 'tagsFolder') continue;
    const role = ROOT_KEYS.get(child.root);
    if (role === undefined) {
      ctx.warnings.add('EXTRA_ROOTS_SKIPPED', countBookmarks(child));
      continue;
    }
    // The HTML export tests the RAW list, separators included, so a toolbar
    // holding only a separator still comes out as an (empty) folder.
    if (!Array.isArray(child.children) || child.children.length === 0) continue;
    const raw = typeof child.title === 'string' ? child.title : '';
    const folder = readFolder(child, titles[role] ?? raw, 1, ctx);
    special[role] = role === 'toolbar' ? { ...folder, toolbar: true } : { ...folder, root: role };
  }

  const roots = menu;
  for (const role of ['toolbar', 'other', 'mobile'] as const) {
    const folder = special[role];
    if (folder !== undefined) roots.push(folder);
  }
  return roots;
}

/**
 * Read an already-parsed Firefox JSON backup.
 *
 * A container that is not the places root (a hand-made or third-party file)
 * is read as a plain list: its children become the top-level entries.
 *
 * @throws {BmParseError} `NOT_BM_JSON` when the shape is not a Firefox backup;
 *   `TOO_MANY_NODES` / `TOO_DEEP` when a cap is exceeded.
 */
export function readFirefoxJson(
  doc: unknown,
  options: { rootTitles?: RootTitles } = {},
): ParseResult {
  if (!looksLikeFirefoxBackup(doc)) {
    throw new BmParseError('NOT_BM_JSON', 'not a Firefox places container');
  }
  const ctx: ReadContext = { budget: new NodeBudget(), warnings: new WarningBag() };
  const isPlacesRoot =
    doc.root === 'placesRoot' ||
    doc.children.some((c) => isRecord(c) && typeof c.root === 'string');
  const roots = isPlacesRoot
    ? readPlacesRoot(doc.children, options.rootTitles ?? {}, ctx)
    : readChildren(doc.children, 1, ctx);

  if (roots.length === 0) ctx.warnings.add('NO_BOOKMARKS');
  return { roots, stats: computeStats(roots), warnings: ctx.warnings.toArray() };
}
