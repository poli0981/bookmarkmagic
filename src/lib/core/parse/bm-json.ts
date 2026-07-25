/**
 * BM JSON v1 parser — docs/04 §2.
 *
 * Purpose: read our own lossless backup/round-trip format.
 * Inputs: decoded file text.
 * Guarantees: hand-rolled structural validation (no schema library — the
 *   zero-dependency rule); unknown keys are ignored for forward compatibility.
 */
import { MAX_DEPTH, MAX_NODES } from '../limits';
import {
  BmParseError,
  type BookmarkNode,
  computeStats,
  type ParseResult,
  type ParseWarning,
} from '../model';

export const BM_JSON_FORMAT = 'bookmarkmagic';
export const BM_JSON_VERSION = 1;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Accept a finite non-negative number; anything else means "absent". */
function optionalEpoch(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return undefined;
  return Math.round(value);
}

interface ReadContext {
  count: { nodes: number };
}

function readNode(raw: unknown, path: string, depth: number, ctx: ReadContext): BookmarkNode {
  if (depth > MAX_DEPTH) {
    throw new BmParseError('TOO_DEEP', `nesting deeper than ${MAX_DEPTH} levels at ${path}`);
  }
  if (!isRecord(raw)) {
    throw new BmParseError('INVALID_NODE', `${path} is not an object`);
  }
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

  ctx.count.nodes++;
  if (ctx.count.nodes > MAX_NODES) {
    throw new BmParseError('TOO_MANY_NODES', `more than ${MAX_NODES} nodes`);
  }

  const addDate = optionalEpoch(raw.addDate);
  const lastModified = optionalEpoch(raw.lastModified);

  return {
    title: raw.title,
    ...(!isFolderNode && { url: raw.url as string }),
    ...(addDate !== undefined && { addDate }),
    ...(lastModified !== undefined && { lastModified }),
    ...(raw.toolbar === true && { toolbar: true }),
    // A folder may omit `children` — that means empty, not "not a folder".
    ...(isFolderNode && {
      children: ((raw.children ?? []) as unknown[]).map((child, i) =>
        readNode(child, `${path}.children[${i}]`, depth + 1, ctx),
      ),
    }),
  };
}

/**
 * Parse a BM JSON v1 document.
 *
 * @throws {BmParseError} `MALFORMED_JSON`, `NOT_BM_JSON`, `INVALID_NODE`,
 *   `TOO_MANY_NODES` or `TOO_DEEP`.
 */
export function parseBmJson(text: string): ParseResult {
  let doc: unknown;
  try {
    doc = JSON.parse(text) as unknown;
  } catch (err) {
    throw new BmParseError('MALFORMED_JSON', err instanceof Error ? err.message : 'invalid JSON');
  }

  if (!isRecord(doc) || doc.format !== BM_JSON_FORMAT) {
    throw new BmParseError('NOT_BM_JSON', `expected "format": "${BM_JSON_FORMAT}"`);
  }
  if (!Array.isArray(doc.roots)) {
    throw new BmParseError('INVALID_NODE', 'roots must be an array');
  }

  const warnings: ParseWarning[] = [];
  if (typeof doc.version === 'number' && doc.version > BM_JSON_VERSION) {
    warnings.push({
      code: 'NEWER_VERSION',
      count: 1,
      detail: `file version ${doc.version}, this build understands ${BM_JSON_VERSION} — best effort`,
    });
  }

  const ctx: ReadContext = { count: { nodes: 0 } };
  const roots = doc.roots.map((node, i) => readNode(node, `roots[${i}]`, 1, ctx));
  if (roots.length === 0) warnings.push({ code: 'NO_BOOKMARKS', count: 1 });

  return { roots, stats: computeStats(roots), warnings };
}
