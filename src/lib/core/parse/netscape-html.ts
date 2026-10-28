/**
 * Netscape Bookmark HTML parser — docs/04 §1, docs/05 §1.
 *
 * Purpose: turn any browser's bookmark export into `BookmarkNode[]`.
 * Inputs: the decoded file text (the read layer already stripped any BOM).
 * Guarantees: never regex-parses markup; reads `textContent`/`getAttribute`
 *   only, so titles are inert; throws `BmParseError` and nothing else.
 *
 * Nodes from the parsed document are NEVER adopted into the live DOM — that,
 * not DOMParser's inertness, is the load-bearing rule (docs/09 T1).
 */
import { classifyHref } from '../href';
import { MAX_NODES } from '../limits';
import {
  BmParseError,
  type BookmarkNode,
  computeStats,
  type ParseResult,
  type RootMarker,
} from '../model';
import { normalizeEpochSeconds } from '../timestamps';
import { bookmarkTitle, NodeBudget, WarningBag } from './shared';

const DOCTYPE_PROBE_BYTES = 512;
const DOCTYPE_MARKER = /NETSCAPE-Bookmark-file-1/i;

const tagOf = (el: Element): string => el.tagName.toLowerCase();

/**
 * The first child of `dt` with this tag, else the first DESCENDANT with it
 * that still belongs to this `dt`.
 *
 * Exporters that do not escape titles write `<A HREF=x>C++ <b>tips</A>`. The
 * HTML parser then keeps that `<b>` open and re-creates it around every later
 * entry, so from there on bookmarks parse as `dt > b > a` and folders as
 * `dt > b > dl` — a direct-child lookup silently dropped the rest of the file.
 * `closest('dt') === dt` keeps an element that belongs to a NESTED entry out.
 */
function ownChild(dt: Element, tag: string): Element | null {
  const direct = dt.querySelector(`:scope > ${tag}`);
  if (direct !== null) return direct;
  for (const el of dt.querySelectorAll(tag)) {
    if (el.closest('dt') === dt) return el;
  }
  return null;
}

/**
 * Locate a folder's child list. Three places, in order (docs/05 §1):
 *  1. inside the `<DT>` — the normal case, because the HTML parser nests it
 *     there whenever the file omits `</DT>`, which every browser does;
 *  2. inside or after a `<DD>` sibling — a `<DD>` closes the `<DT>` and then
 *     swallows the following `<DL>`; missing this loses the whole subtree;
 *  3. the `<DT>`'s next-sibling `<DL>` — only reachable when the file emits an
 *     explicit `</DT>`, which some third-party exporters do.
 */
function nextDlFor(dt: Element): Element | null {
  const inside = ownChild(dt, 'dl');
  if (inside !== null) return inside;

  let sibling = dt.nextElementSibling;
  while (sibling !== null) {
    const tag = tagOf(sibling);
    if (tag === 'dl') return sibling;
    if (tag === 'dd') {
      const nested = sibling.querySelector(':scope > dl');
      if (nested !== null) return nested;
    } else if (tag === 'dt') {
      return null; // next entry started — this folder is empty
    }
    sibling = sibling.nextElementSibling;
  }
  return null;
}

/** A boolean marker attribute: present and not explicitly false (Firefox writes `="false"`). */
function flag(el: Element, name: string): boolean {
  const value = el.getAttribute(name);
  return value !== null && !/^\s*(?:false|0|no)\s*$/i.test(value);
}

function rootMarker(h3: Element): RootMarker | undefined {
  if (flag(h3, 'personal_toolbar_folder')) return undefined; // the toolbar wins
  if (flag(h3, 'unfiled_bookmarks_folder')) return 'other';
  if (flag(h3, 'mobile_bookmarks_folder')) return 'mobile';
  return undefined;
}

function readDates(
  el: Element,
  warnings: WarningBag,
): Pick<BookmarkNode, 'addDate' | 'lastModified'> {
  const add = normalizeEpochSeconds(el.getAttribute('add_date'));
  const mod = normalizeEpochSeconds(el.getAttribute('last_modified'));
  if (add.invalid) warnings.add('INVALID_DATE');
  if (mod.invalid) warnings.add('INVALID_DATE');
  return {
    ...(add.seconds !== undefined && { addDate: add.seconds }),
    ...(mod.seconds !== undefined && { lastModified: mod.seconds }),
  };
}

function hasFavicon(el: Element): number {
  return el.hasAttribute('icon') || el.hasAttribute('icon_uri') ? 1 : 0;
}

interface WalkContext {
  warnings: WarningBag;
  budget: NodeBudget;
}

/**
 * The `<DT>`/`<DD>` entries of a list, looking THROUGH any element the HTML
 * parser wrapped around them. After an unclosed `<b>` in a title, the parser
 * re-opens that `<b>` around whitespace inside the list, and every later `<DT>`
 * lands inside it (`dl > b > dt`) — invisible to a direct-children walk. Lists
 * and entries themselves are not descended into; they belong to someone else.
 */
function* entryElements(list: Element): Generator<Element> {
  for (const child of list.children) {
    const tag = tagOf(child);
    if (tag === 'dt' || tag === 'dd') yield child;
    else if (tag !== 'dl' && tag !== 'hr') yield* entryElements(child);
  }
}

function walkDl(dl: Element, depth: number, ctx: WalkContext): BookmarkNode[] {
  const out: BookmarkNode[] = [];
  for (const child of entryElements(dl)) {
    const tag = tagOf(child);
    // <HR> separators (Firefox) are skipped silently — docs/04 §1.2. The HTML
    // parser usually nests them inside the preceding <DT>; either way they
    // are never read as an entry.
    if (tag === 'dd') ctx.warnings.add('DESCRIPTIONS_DROPPED');
    if (tag !== 'dt') continue;
    // Checked per entry, not per list: an EMPTY list one level past the cap is
    // harmless, and BM JSON accepts the same tree (docs/05 §1).
    ctx.budget.depth(depth);
    out.push(...readEntry(child, depth, ctx));
  }
  return out;
}

/**
 * One `<DT>`, as zero or more nodes.
 *
 * Usually exactly one. Zero when the entry is unreadable or its address is
 * skipped. More than one when a bookmark `<DT>` swallowed a list: with no
 * `</DT>`, a loose bookmark written before a `<DL>` gets that whole list nested
 * inside it, and returning only the bookmark dropped every entry in it.
 */
function readEntry(dt: Element, depth: number, ctx: WalkContext): BookmarkNode[] {
  const a = ownChild(dt, 'a');
  const h3 = ownChild(dt, 'h3');
  // An unescaped `<h3>` INSIDE a bookmark's title is part of the title: read
  // as a folder, the bookmark became an empty folder and its URL vanished.
  if (h3 !== null && !(a?.contains(h3) ?? false)) return [readFolder(dt, h3, depth, ctx)];

  if (a === null) {
    ctx.warnings.add('UNREADABLE_ENTRIES');
    return [];
  }
  const bookmark = readBookmark(a, ctx);
  const swallowed = ownChild(dt, 'dl');
  const trailing = swallowed === null ? [] : walkDl(swallowed, depth, ctx);
  return bookmark === null ? trailing : [bookmark, ...trailing];
}

function readFolder(dt: Element, h3: Element, depth: number, ctx: WalkContext): BookmarkNode {
  ctx.budget.count();
  ctx.warnings.add('FAVICONS_IGNORED', hasFavicon(h3));
  const childDl = nextDlFor(dt);
  const marker = rootMarker(h3);
  return {
    title: h3.textContent ?? '',
    ...readDates(h3, ctx.warnings),
    ...(flag(h3, 'personal_toolbar_folder') && { toolbar: true }),
    ...(marker !== undefined && { root: marker }),
    children: childDl === null ? [] : walkDl(childDl, depth + 1, ctx),
  };
}

function readBookmark(a: Element, ctx: WalkContext): BookmarkNode | null {
  const href = a.getAttribute('href');
  switch (classifyHref(href)) {
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
  ctx.warnings.add('FAVICONS_IGNORED', hasFavicon(a));
  return {
    title: bookmarkTitle(a.textContent ?? '', ctx.warnings),
    // SAFETY: classifyHref returned 'ok', which it only does for a non-null href.
    url: href as string,
    ...readDates(a, ctx.warnings),
  };
}

/**
 * Collect the top-level entries.
 *
 * Normally that is the single wrapper `<DL>` under `<body>`. But Safari has
 * been reported to emit top-level `<DT><H3>` folders with NO outer `<DL>`
 * (Mozilla bug 801450), and real files can mix both — one wrapped root list
 * plus loose `<DT>`s after it. So walk `<body>` in document order and accept
 * both kinds of entry point.
 *
 * The `consumed` pass matters: when a file emits an explicit `</DT>`, a
 * FOLDER's child `<DL>` also lands at body level, and emitting it again would
 * duplicate the subtree. Only folders consume a list — counting bookmark
 * `<DT>`s too made a list after a loose bookmark vanish entirely.
 */
function collectRoots(body: Element, ctx: WalkContext): BookmarkNode[] {
  const children = [...body.children];
  const consumed = new Set<Element>();
  for (const el of children) {
    if (tagOf(el) !== 'dt' || ownChild(el, 'h3') === null) continue;
    const childList = nextDlFor(el);
    if (childList !== null) consumed.add(childList);
  }

  const roots: BookmarkNode[] = [];
  for (const el of children) {
    const tag = tagOf(el);
    if (tag === 'dt') roots.push(...readEntry(el, 1, ctx));
    else if (tag === 'dl' && !consumed.has(el)) roots.push(...walkDl(el, 1, ctx));
  }
  return roots;
}

/**
 * Outermost lists anywhere in the document — the fallback for a root list
 * wrapped in `<div>`, `<center>` or a table cell, which body-level collection
 * cannot see.
 */
function outermostLists(doc: Document, ctx: WalkContext): BookmarkNode[] {
  const roots: BookmarkNode[] = [];
  for (const dl of doc.querySelectorAll('dl')) {
    if (dl.parentElement?.closest('dl') === null) roots.push(...walkDl(dl, 1, ctx));
  }
  return roots;
}

/**
 * Refuse a file with more entries than the node cap BEFORE building its DOM.
 * The cap used to fire only after DOMParser had materialised every element —
 * 25 MB of `<DT><A>` is about 1.7 million of them, enough to freeze or crash
 * the tab before the "parse aborts early" promise in docs/09 T2 could keep.
 */
function precheckEntryCount(text: string): void {
  const dt = /<dt[\s>]/gi;
  let count = 0;
  while (dt.exec(text) !== null) {
    count++;
    if (count > MAX_NODES) {
      throw new BmParseError('TOO_MANY_NODES', `more than ${MAX_NODES} entries in the file`);
    }
  }
}

/**
 * Parse Netscape bookmark HTML.
 *
 * @throws {BmParseError} `NOT_NETSCAPE` when neither the doctype nor any `<DL>`
 *   is present; `TOO_MANY_NODES` / `TOO_DEEP` when a cap is exceeded.
 */
export function parseNetscapeHtml(text: string): ParseResult {
  precheckEntryCount(text);
  const hasDoctype = DOCTYPE_MARKER.test(text.slice(0, DOCTYPE_PROBE_BYTES));
  const doc = new DOMParser().parseFromString(text, 'text/html');
  const body = doc.body;

  const hasEntries =
    body !== null &&
    (doc.querySelector('dl') !== null || [...body.children].some((el) => tagOf(el) === 'dt'));
  if (!hasEntries && !hasDoctype) {
    throw new BmParseError('NOT_NETSCAPE', 'no NETSCAPE doctype and no <DL> found');
  }

  const ctx: WalkContext = { warnings: new WarningBag(), budget: new NodeBudget() };
  let roots = body === null || !hasEntries ? [] : collectRoots(body, ctx);
  if (roots.length === 0 && hasEntries) roots = outermostLists(doc, ctx);

  if (roots.length === 0) ctx.warnings.add('NO_BOOKMARKS');
  return { roots, stats: computeStats(roots), warnings: ctx.warnings.toArray() };
}
