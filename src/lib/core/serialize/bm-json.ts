/**
 * BM JSON v1 serializer — docs/04 §2.
 *
 * Purpose: our lossless round-trip format, and the forced safety backup taken
 *   before a Replace import.
 * Inputs: a tree plus the generator version and an export timestamp.
 * Guarantees: field order is stable so diffs between two backups stay small.
 */
import { type BookmarkNode, isFolder } from '../model';
import { BM_JSON_FORMAT, BM_JSON_VERSION } from '../parse/bm-json';

export interface BmJsonOptions {
  /** App version, e.g. "1.0.0" — becomes `generator`. */
  version: string;
  /** ISO 8601 instant. Passed in so this module stays free of ambient time. */
  exportedAt: string;
}

function toJsonNode(node: BookmarkNode): Record<string, unknown> {
  return {
    title: node.title,
    ...(node.url !== undefined && { url: node.url }),
    ...(node.toolbar === true && { toolbar: true }),
    ...(node.addDate !== undefined && { addDate: node.addDate }),
    ...(node.lastModified !== undefined && { lastModified: node.lastModified }),
    ...(isFolder(node) && { children: (node.children ?? []).map(toJsonNode) }),
  };
}

/** Serialize a tree to BM JSON v1 (2-space indented, trailing newline). */
export function serializeBmJson(roots: readonly BookmarkNode[], options: BmJsonOptions): string {
  const doc = {
    format: BM_JSON_FORMAT,
    version: BM_JSON_VERSION,
    generator: `BookmarkMagic ${options.version}`,
    exportedAt: options.exportedAt,
    roots: roots.map(toJsonNode),
  };
  return `${JSON.stringify(doc, null, 2)}\n`;
}
