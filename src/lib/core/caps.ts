/**
 * Would the import read this back? — docs/09 T2, docs/03 §1 step 6b.
 *
 * Purpose: the Replace safety backup is only a backup if BookmarkMagic can
 *   import it again. A profile past the node, depth or size caps produced a
 *   file the parser refuses, and 1.0.x would still delete everything after
 *   writing it. These checks run before anything is written or deleted.
 * Inputs: a tree, or the serialized text.
 * Guarantees: pure; the limits are exactly the ones the parsers enforce.
 */
import { MAX_DEPTH, MAX_FILE_BYTES, MAX_NODES } from './limits';
import { type BookmarkNode, computeStats } from './model';

/** Why a tree could not be re-imported, or undefined when it could. */
export function treeCapsBreach(roots: readonly BookmarkNode[]): string | undefined {
  const { bookmarks, folders, maxDepth } = computeStats(roots);
  const nodes = bookmarks + folders;
  if (nodes > MAX_NODES) return `${nodes} items, over the ${MAX_NODES} the import accepts`;
  if (maxDepth > MAX_DEPTH) {
    return `folders nested ${maxDepth} deep, over the ${MAX_DEPTH} the import accepts`;
  }
  return undefined;
}

/**
 * UTF-8 length without materialising the bytes — a 25 MB string is the case
 * this exists for. Lone surrogates count as U+FFFD, as `TextEncoder` writes them.
 */
export function utf8ByteLength(text: string): number {
  let bytes = 0;
  for (let i = 0; i < text.length; i++) {
    const unit = text.charCodeAt(i);
    if (unit < 0x80) bytes += 1;
    else if (unit < 0x800) bytes += 2;
    else if (unit >= 0xd800 && unit <= 0xdbff && isLowSurrogate(text.charCodeAt(i + 1))) {
      bytes += 4;
      i++;
    } else bytes += 3;
  }
  return bytes;
}

function isLowSurrogate(unit: number): boolean {
  return unit >= 0xdc00 && unit <= 0xdfff;
}

/** Why a serialized file could not be re-imported, or undefined when it could. */
export function textCapsBreach(text: string): string | undefined {
  const bytes = utf8ByteLength(text);
  return bytes > MAX_FILE_BYTES
    ? `${bytes} bytes, over the ${MAX_FILE_BYTES} the import accepts`
    : undefined;
}
