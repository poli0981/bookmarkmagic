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
import { MAX_DEPTH, MAX_NODES } from '../limits';
import {
  BmParseError,
  type BookmarkNode,
  computeStats,
  type ParseResult,
  type ParseWarning,
  type ParseWarningCode,
} from '../model';
import { normalizeEpochSeconds } from '../timestamps';

const DOCTYPE_PROBE_BYTES = 512;
const DOCTYPE_MARKER = /NETSCAPE-Bookmark-file-1/i;

class WarningBag {
  private readonly counts = new Map<ParseWarningCode, number>();

  /** A zero increment is a no-op — never emit a warning with count 0. */
  add(code: ParseWarningCode, times = 1): void {
    if (times <= 0) return;
    this.counts.set(code, (this.counts.get(code) ?? 0) + times);
  }

  toArray(): ParseWarning[] {
    return [...this.counts].map(([code, count]) => ({ code, count }));
  }
}

const tagOf = (el: Element): string => el.tagName.toLowerCase();

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
  const inside = dt.querySelector(':scope > dl');
  if (inside !== null) return inside;

  let sibling = dt.nextElementSibling;
  while (sibling !== null) {
    const tag = tagOf(sibling);
    if (tag === 'dl') return sibling;
    if (tag === 'dd') {
      const nested = sibling.querySelector(':scope > dl');
      if (nested !== null) return nested;
      sibling = sibling.nextElementSibling;
      continue;
    }
    if (tag === 'dt') return null; // next entry started — this folder is empty
    sibling = sibling.nextElementSibling;
  }
  return null;
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

function countFavicons(el: Element): number {
  let n = 0;
  if (el.hasAttribute('icon')) n++;
  if (el.hasAttribute('icon_uri')) n++;
  return n > 0 ? 1 : 0;
}

interface WalkContext {
  warnings: WarningBag;
  count: { nodes: number };
}

function walkDl(dl: Element, depth: number, ctx: WalkContext): BookmarkNode[] {
  if (depth > MAX_DEPTH) {
    throw new BmParseError('TOO_DEEP', `nesting deeper than ${MAX_DEPTH} levels`);
  }

  const out: BookmarkNode[] = [];
  for (const child of dl.children) {
    const tag = tagOf(child);
    // <HR> separators (Firefox) are skipped silently — docs/04 §1.2. Note the
    // HTML parser usually nests them inside the preceding <DT> rather than
    // leaving them here, since only dt/dd closes a dt; either way they are
    // never read as an entry.
    if (tag === 'hr') continue;
    if (tag === 'dd') {
      ctx.warnings.add('DESCRIPTIONS_DROPPED');
      continue;
    }
    if (tag !== 'dt') continue;

    const node = readEntry(child, depth, ctx);
    if (node === null) continue;
    countNode(ctx);
    out.push(node);
  }
  return out;
}

function countNode(ctx: WalkContext): void {
  ctx.count.nodes++;
  if (ctx.count.nodes > MAX_NODES) {
    throw new BmParseError('TOO_MANY_NODES', `more than ${MAX_NODES} nodes`);
  }
}

/**
 * Collect the top-level entries.
 *
 * Normally that is the single wrapper `<DL>` under `<body>`. But Safari has
 * been reported to emit top-level `<DT><H3>` folders with NO outer `<DL>`
 * (Mozilla bug 801450), and real files can mix both — one wrapped root list
 * plus loose `<DT>`s after it. Taking "the first outermost `<DL>`" silently
 * drops everything outside it, so walk `<body>` in document order instead and
 * accept both kinds of entry point.
 *
 * The `consumed` pass matters: when a file emits an explicit `</DT>`, a
 * folder's child `<DL>` also lands at body level, and emitting it again as a
 * root list would duplicate the whole subtree.
 */
function collectRoots(body: Element, ctx: WalkContext): BookmarkNode[] {
  const children = [...body.children];

  const consumed = new Set<Element>();
  for (const el of children) {
    if (tagOf(el) !== 'dt') continue;
    const childList = nextDlFor(el);
    if (childList !== null) consumed.add(childList);
  }

  const roots: BookmarkNode[] = [];
  for (const el of children) {
    const tag = tagOf(el);
    if (tag === 'dt') {
      const node = readEntry(el, 1, ctx);
      if (node === null) continue;
      countNode(ctx);
      roots.push(node);
    } else if (tag === 'dl' && !consumed.has(el)) {
      roots.push(...walkDl(el, 1, ctx));
    }
  }
  return roots;
}

function readEntry(dt: Element, depth: number, ctx: WalkContext): BookmarkNode | null {
  const h3 = dt.querySelector(':scope > h3');
  if (h3 !== null) {
    ctx.warnings.add('FAVICONS_IGNORED', countFavicons(h3));
    const childDl = nextDlFor(dt);
    return {
      title: h3.textContent ?? '',
      ...readDates(h3, ctx.warnings),
      ...(h3.hasAttribute('personal_toolbar_folder') && { toolbar: true }),
      children: childDl === null ? [] : walkDl(childDl, depth + 1, ctx),
    };
  }

  const a = dt.querySelector(':scope > a');
  if (a === null) return null;

  const href = a.getAttribute('href');
  if (href === null || href.trim() === '') {
    ctx.warnings.add('MISSING_URL');
    return null;
  }

  ctx.warnings.add('FAVICONS_IGNORED', countFavicons(a));
  const title = a.textContent ?? '';
  if (title.trim() === '') ctx.warnings.add('EMPTY_TITLE');
  return {
    title: title === '' ? href : title,
    url: href,
    ...readDates(a, ctx.warnings),
  };
}

/**
 * Parse Netscape bookmark HTML.
 *
 * @throws {BmParseError} `NOT_NETSCAPE` when neither the doctype nor any `<DL>`
 *   is present; `TOO_MANY_NODES` / `TOO_DEEP` when a cap is exceeded.
 */
export function parseNetscapeHtml(text: string): ParseResult {
  const hasDoctype = DOCTYPE_MARKER.test(text.slice(0, DOCTYPE_PROBE_BYTES));
  const doc = new DOMParser().parseFromString(text, 'text/html');
  const body = doc.body;

  const hasEntries =
    body !== null &&
    (doc.querySelector('dl') !== null || [...body.children].some((el) => tagOf(el) === 'dt'));

  if (!hasEntries && !hasDoctype) {
    throw new BmParseError('NOT_NETSCAPE', 'no NETSCAPE doctype and no <DL> found');
  }

  const warnings = new WarningBag();
  const roots =
    body === null || !hasEntries ? [] : collectRoots(body, { warnings, count: { nodes: 0 } });

  if (roots.length === 0) warnings.add('NO_BOOKMARKS');
  return { roots, stats: computeStats(roots), warnings: warnings.toArray() };
}
