/**
 * BM JSON v1 parser — docs/04 §2.
 *
 * Purpose: read our own lossless backup/round-trip format.
 * Inputs: decoded file text, or an already-parsed document (the JSON dispatch
 *   in `parse-file.ts` parses once and routes by shape).
 * Guarantees: hand-rolled structural validation (no schema library — the
 *   zero-dependency rule); unknown keys are ignored for forward compatibility.
 */
import { classifyHref } from '../href';
import {
  BmParseError,
  type BookmarkNode,
  computeStats,
  type ParseResult,
  type RootMarker,
} from '../model';
import { normalizeEpochSeconds } from '../timestamps';
import { NodeBudget, WarningBag } from './shared';

export const BM_JSON_FORMAT = 'bookmarkmagic';
export const BM_JSON_VERSION = 1;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

interface ReadContext {
  budget: NodeBudget;
  warnings: WarningBag;
}

/**
 * Dates go through the same normalizer as every other format: a hand-edited or
 * third-party file can carry milliseconds or a string, and `1e300` must not
 * come back out as `ADD_DATE="1e+300"`.
 */
function readDate(value: unknown, warnings: WarningBag): number | undefined {
  const parsed =
    typeof value === 'number' || typeof value === 'string'
      ? normalizeEpochSeconds(value)
      : { seconds: undefined, invalid: value !== undefined && value !== null };
  if (parsed.invalid) warnings.add('INVALID_DATE');
  return parsed.seconds;
}

function readRootMarker(raw: Record<string, unknown>): RootMarker | undefined {
  if (raw.toolbar === true) return undefined; // the toolbar wins
  return raw.root === 'other' || raw.root === 'mobile' ? raw.root : undefined;
}

function readNode(
  raw: unknown,
  path: string,
  depth: number,
  ctx: ReadContext,
): BookmarkNode | null {
  ctx.budget.depth(depth, path);
  if (!isRecord(raw)) throw new BmParseError('INVALID_NODE', `${path} is not an object`);
  if (typeof raw.title !== 'string') {
    throw new BmParseError('INVALID_NODE', `${path}.title must be a string`);
  }
  if (raw.url !== undefined && typeof raw.url !== 'string') {
    throw new BmParseError('INVALID_NODE', `${path}.url must be a string when present`);
  }
  const isFolderNode = raw.url === undefined;
  if (!isFolderNode && raw.children !== undefined) {
    throw new BmParseError('INVALID_NODE', `${path} has a url and children`);
  }
  if (raw.children !== undefined && !Array.isArray(raw.children)) {
    throw new BmParseError('INVALID_NODE', `${path}.children must be an array`);
  }

  if (!isFolderNode) {
    // `place:` is KEPT here: this is the restore format, and a backup must
    // bring back whatever the browser held (docs/05 §1). A blank url is not
    // a bookmark — `bookmarks.create({ url: '' })` makes a FOLDER.
    const verdict = classifyHref(raw.url as string);
    if (verdict === 'missing' || verdict === 'invalid') {
      ctx.warnings.add(verdict === 'missing' ? 'MISSING_URL' : 'INVALID_URL');
      return null;
    }
  }

  ctx.budget.count(path);
  const addDate = readDate(raw.addDate, ctx.warnings);
  const lastModified = readDate(raw.lastModified, ctx.warnings);
  const marker = isFolderNode ? readRootMarker(raw) : undefined;
  return {
    title: raw.title,
    ...(!isFolderNode && { url: raw.url as string }),
    ...(addDate !== undefined && { addDate }),
    ...(lastModified !== undefined && { lastModified }),
    ...(raw.toolbar === true && { toolbar: true }),
    ...(marker !== undefined && { root: marker }),
    // A folder may omit `children` — that means empty, not "not a folder".
    ...(isFolderNode && { children: readChildren(raw.children, path, depth, ctx) }),
  };
}

function readChildren(raw: unknown, path: string, depth: number, ctx: ReadContext): BookmarkNode[] {
  const out: BookmarkNode[] = [];
  const list = Array.isArray(raw) ? raw : [];
  for (const [i, child] of list.entries()) {
    const node = readNode(child, `${path}.children[${i}]`, depth + 1, ctx);
    if (node !== null) out.push(node);
  }
  return out;
}

/**
 * A full-tree safety backup written by 1.0.x carries no `root` markers, so it
 * would restore Other and Mobile one level too deep (docs/03 §1). Its shape is
 * exact — the three roots of a Chromium profile, bar first — so it is
 * recognised and marked here. A mis-mark is harmless: contents land in a root
 * instead of a folder named after it.
 */
function markLegacyBackup(doc: Record<string, unknown>, roots: BookmarkNode[]): void {
  const generator = typeof doc.generator === 'string' ? doc.generator : '';
  if (!/^BookmarkMagic 1\.0\.\d+$/.test(generator) || roots.length !== 3) return;
  const [bar, other, mobile] = roots;
  const isFolder = (n: BookmarkNode | undefined): n is BookmarkNode => n?.children !== undefined;
  if (!isFolder(bar) || !isFolder(other) || !isFolder(mobile) || bar.toolbar !== true) return;
  if (roots.some((n) => n.root !== undefined)) return;
  other.root = 'other';
  mobile.root = 'mobile';
}

/**
 * Read an already-parsed BM JSON document.
 *
 * @throws {BmParseError} `NOT_BM_JSON`, `INVALID_NODE`, `TOO_MANY_NODES` or `TOO_DEEP`.
 */
export function readBmJson(doc: unknown): ParseResult {
  if (!isRecord(doc) || doc.format !== BM_JSON_FORMAT) {
    throw new BmParseError('NOT_BM_JSON', `expected "format": "${BM_JSON_FORMAT}"`);
  }
  if (!Array.isArray(doc.roots)) throw new BmParseError('INVALID_NODE', 'roots must be an array');

  const ctx: ReadContext = { budget: new NodeBudget(), warnings: new WarningBag() };
  if (typeof doc.version === 'number' && doc.version > BM_JSON_VERSION) {
    ctx.warnings.note(
      'NEWER_VERSION',
      `file version ${doc.version}, this build understands ${BM_JSON_VERSION} — best effort`,
    );
  }

  const roots: BookmarkNode[] = [];
  for (const [i, raw] of doc.roots.entries()) {
    const node = readNode(raw, `roots[${i}]`, 1, ctx);
    if (node !== null) roots.push(node);
  }
  markLegacyBackup(doc, roots);
  if (roots.length === 0) ctx.warnings.add('NO_BOOKMARKS');
  return { roots, stats: computeStats(roots), warnings: ctx.warnings.toArray() };
}

/**
 * Parse a BM JSON v1 document from text.
 *
 * @throws {BmParseError} `MALFORMED_JSON`, plus everything `readBmJson` throws.
 */
export function parseBmJson(text: string): ParseResult {
  let doc: unknown;
  try {
    doc = JSON.parse(text);
  } catch (err) {
    throw new BmParseError('MALFORMED_JSON', err instanceof Error ? err.message : 'invalid JSON');
  }
  return readBmJson(doc);
}
