/**
 * Netscape Bookmark HTML serializer — docs/04 §1.1.
 *
 * Purpose: emit the interchange format every major browser reads.
 * Inputs: a `BookmarkNode[]` tree.
 * Guarantees: 4-space indent per depth (matches Chrome); attributes only when
 *   values exist; `& < > "` escaped in titles and hrefs.
 *
 * `LAST_MODIFIED` is emitted on `<H3>` only, never on `<A>` — that is what
 * Chrome does, and it is why the round-trip suite projects `lastModified` away
 * for bookmarks (docs/11 §3).
 *
 * Root folders carry a marker so a re-import puts their contents back INTO the
 * root rather than into a folder named after it (docs/04 §1.1):
 * `PERSONAL_TOOLBAR_FOLDER` (Chrome's), `UNFILED_BOOKMARKS_FOLDER` (Firefox's,
 * which Firefox's own importer honours) and `MOBILE_BOOKMARKS_FOLDER` (ours —
 * importers ignore attributes they do not know).
 */
import { type BookmarkNode, isBookmark } from '../model';

const HEADER = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<!-- This is an automatically generated file. It will be read and overwritten. DO NOT EDIT! -->
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
`;

/**
 * Escape the four characters that can break out of text or an attribute value,
 * plus CR.
 *
 * CR is not a markup hazard — it is a round-trip hazard. The HTML tokenizer
 * normalizes CR and CRLF to LF during input-stream preprocessing, so a title
 * containing `\r` would come back as `\n`. A numeric reference survives,
 * because character references are decoded *after* that normalization.
 * `\r` reaches us from BM JSON and from quoted CSV fields, so this is
 * reachable in production, not theoretical.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\r/g, '&#13;');
}

function attr(name: string, value: number | undefined): string {
  return value === undefined ? '' : ` ${name}="${value}"`;
}

function indent(depth: number): string {
  return '    '.repeat(depth);
}

/** The one root-marker attribute a folder carries, if any. The toolbar wins. */
function rootAttr(node: BookmarkNode): string {
  if (node.toolbar === true) return ' PERSONAL_TOOLBAR_FOLDER="true"';
  if (node.root === 'other') return ' UNFILED_BOOKMARKS_FOLDER="true"';
  if (node.root === 'mobile') return ' MOBILE_BOOKMARKS_FOLDER="true"';
  return '';
}

function writeNode(node: BookmarkNode, depth: number, out: string[]): void {
  const pad = indent(depth);
  if (!isBookmark(node)) {
    out.push(
      `${pad}<DT><H3${attr('ADD_DATE', node.addDate)}${attr('LAST_MODIFIED', node.lastModified)}${rootAttr(node)}>${escapeHtml(node.title)}</H3>`,
    );
    out.push(`${pad}<DL><p>`);
    for (const child of node.children ?? []) writeNode(child, depth + 1, out);
    out.push(`${pad}</DL><p>`);
    return;
  }

  out.push(
    `${pad}<DT><A HREF="${escapeHtml(node.url)}"${attr('ADD_DATE', node.addDate)}>${escapeHtml(node.title)}</A>`,
  );
}

/** Serialize a tree to Netscape bookmark HTML (UTF-8, LF line endings). */
export function serializeNetscapeHtml(roots: readonly BookmarkNode[]): string {
  const out: string[] = ['<DL><p>'];
  for (const node of roots) writeNode(node, 1, out);
  out.push('</DL><p>');
  return `${HEADER}${out.join('\n')}\n`;
}
