/**
 * Chrome profile `Bookmarks` file reader — docs/04 §2a.
 *
 * Purpose: import the JSON file Chromium keeps in the profile folder
 *   (`User Data/Default/Bookmarks`, no extension). It is the only copy left
 *   when the browser no longer starts, and unlike Chrome's HTML export it
 *   still says which bookmarks were in Other and Mobile.
 * Inputs: an already-parsed document (`parse-file.ts` parses once and routes
 *   by shape).
 * Guarantees: reads `roots.bookmark_bar`, `other` and `synced` only; any other
 *   root (Opera's Speed Dial and Trash, vendor additions) is skipped and its
 *   bookmarks counted. `id`, `guid`, `meta_info`, `sync_metadata` and
 *   `checksum` are ignored — the checksum is never verified, so a hand-repaired
 *   file still imports.
 */
import { classifyHref } from '../href';
import { BmParseError, type BookmarkNode, computeStats, type ParseResult } from '../model';
import { chromeTimeToSeconds } from '../timestamps';
import { bookmarkTitle, isRecord, NodeBudget, type RootTitles, WarningBag } from './shared';

/** The roots `BookmarkCodec` writes, in the order Chrome's HTML export emits them. */
const KNOWN_ROOTS = ['bookmark_bar', 'other', 'synced'] as const;

interface ReadContext {
  budget: NodeBudget;
  warnings: WarningBag;
}

/** The shape test the JSON dispatch routes by. */
export function looksLikeChromeBookmarks(doc: unknown): doc is { roots: Record<string, unknown> } {
  if (!isRecord(doc) || !isRecord(doc.roots)) return false;
  const roots = doc.roots;
  return KNOWN_ROOTS.some((key) => isRecord(roots[key]));
}

function readDate(raw: unknown, warnings: WarningBag): number | undefined {
  const parsed = chromeTimeToSeconds(raw);
  if (parsed.invalid) warnings.add('INVALID_DATE');
  return parsed.seconds;
}

function readUrl(raw: Record<string, unknown>, ctx: ReadContext): BookmarkNode | null {
  const url = typeof raw.url === 'string' ? raw.url : undefined;
  switch (classifyHref(url)) {
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
  const addDate = readDate(raw.date_added, ctx.warnings);
  return {
    title: bookmarkTitle(typeof raw.name === 'string' ? raw.name : '', ctx.warnings),
    // SAFETY: classifyHref returned 'ok', which it only does for a string.
    url: url as string,
    ...(addDate !== undefined && { addDate }),
  };
}

function readFolder(
  raw: Record<string, unknown>,
  title: string,
  depth: number,
  ctx: ReadContext,
): BookmarkNode & { children: BookmarkNode[] } {
  ctx.budget.count();
  const addDate = readDate(raw.date_added, ctx.warnings);
  const lastModified = readDate(raw.date_modified, ctx.warnings);
  const children: BookmarkNode[] = [];
  if (Array.isArray(raw.children)) {
    for (const child of raw.children) {
      ctx.budget.depth(depth + 1);
      const node = readNode(child, depth + 1, ctx);
      if (node !== null) children.push(node);
    }
  }
  return {
    title,
    ...(addDate !== undefined && { addDate }),
    ...(lastModified !== undefined && { lastModified }),
    children,
  };
}

function readNode(raw: unknown, depth: number, ctx: ReadContext): BookmarkNode | null {
  if (isRecord(raw)) {
    if (raw.type === 'url') return readUrl(raw, ctx);
    if (raw.type === 'folder') {
      return readFolder(raw, typeof raw.name === 'string' ? raw.name : '', depth, ctx);
    }
  }
  ctx.warnings.add('UNREADABLE_ENTRIES');
  return null;
}

/**
 * Bookmarks under a root this reader does not import. Iterative: the root is
 * never read, so nothing has depth-checked it.
 */
function countBookmarks(root: unknown): number {
  let count = 0;
  const stack: unknown[] = [root];
  while (stack.length > 0) {
    const node = stack.pop();
    if (!isRecord(node)) continue;
    if (node.type === 'url') count++;
    if (Array.isArray(node.children)) for (const child of node.children) stack.push(child);
  }
  return count;
}

/** The file's own root name, else the caller's localized one. */
function rootTitle(raw: Record<string, unknown>, fallback: string | undefined): string {
  const name = typeof raw.name === 'string' ? raw.name : '';
  return name.trim() !== '' ? name : (fallback ?? name);
}

/**
 * Read an already-parsed Chrome `Bookmarks` document.
 *
 * Emits what Chrome's own HTML export describes, plus the two root markers it
 * drops (docs/04 §2a): the bar always, as a `toolbar` folder; then Other and
 * Mobile as `root`-marked folders, each only when it holds something.
 *
 * @throws {BmParseError} `NOT_BM_JSON` when the shape is not a Chrome profile
 *   file; `TOO_MANY_NODES` / `TOO_DEEP` when a cap is exceeded.
 */
export function readChromeBookmarks(
  doc: unknown,
  options: { rootTitles?: RootTitles } = {},
): ParseResult {
  if (!looksLikeChromeBookmarks(doc)) {
    throw new BmParseError('NOT_BM_JSON', 'no bookmark_bar, other or synced root');
  }
  const titles = options.rootTitles ?? {};
  const ctx: ReadContext = { budget: new NodeBudget(), warnings: new WarningBag() };
  const { bookmark_bar: bar, other, synced } = doc.roots;
  const roots: BookmarkNode[] = [];

  if (isRecord(bar)) {
    roots.push({ ...readFolder(bar, rootTitle(bar, titles.toolbar), 1, ctx), toolbar: true });
  }
  for (const [raw, marker] of [
    [other, 'other'],
    [synced, 'mobile'],
  ] as const) {
    if (!isRecord(raw)) continue;
    const folder = readFolder(raw, rootTitle(raw, titles[marker]), 1, ctx);
    if (folder.children.length > 0) roots.push({ ...folder, root: marker });
  }

  for (const [key, value] of Object.entries(doc.roots)) {
    // Old profiles also keep a `sync_transaction_version` string in here.
    if ((KNOWN_ROOTS as readonly string[]).includes(key) || !isRecord(value)) continue;
    ctx.warnings.add('EXTRA_ROOTS_SKIPPED', countBookmarks(value));
  }

  if (roots.length === 0) ctx.warnings.add('NO_BOOKMARKS');
  return { roots, stats: computeStats(roots), warnings: ctx.warnings.toArray() };
}
