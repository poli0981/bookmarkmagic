/**
 * Markdown serializer — docs/04 §4. Export only; there is no Markdown parser.
 *
 * Purpose: a human-readable share format (blog posts, Discord, README).
 * Inputs: a tree, a heading date, and a style.
 * Guarantees: `[ ] ( )` escaped in titles; URLs containing `)` or whitespace
 *   are angle-bracket wrapped so the link target survives.
 */
import { type BookmarkNode, isFolder } from '../model';

export type MarkdownStyle = 'nested' | 'flat';

export interface MarkdownOptions {
  /** Rendered into the H1, e.g. "2026-07-25". Passed in — no ambient time. */
  date: string;
  style?: MarkdownStyle;
}

/** Escape the characters that would otherwise form link syntax. */
export function escapeMarkdown(value: string): string {
  return value.replace(/([\\[\]()])/g, '\\$1');
}

/**
 * Wrap a URL in angle brackets when it contains characters that break `(...)`.
 *
 * Inside `<...>` CommonMark forbids `<`, `>` and line endings, so those must be
 * percent-encoded or the whole link renders as literal text.
 */
export function formatUrl(url: string): string {
  if (!/[\s()<>]/.test(url)) return url;
  const safe = url
    .replace(/</g, '%3C')
    .replace(/>/g, '%3E')
    .replace(/\r/g, '%0D')
    .replace(/\n/g, '%0A');
  return `<${safe}>`;
}

function link(node: BookmarkNode): string {
  return `[${escapeMarkdown(node.title)}](${formatUrl(node.url as string)})`;
}

function writeNested(nodes: readonly BookmarkNode[], depth: number, out: string[]): void {
  const pad = '  '.repeat(depth);
  for (const node of nodes) {
    if (isFolder(node)) {
      out.push(`${pad}- **${escapeMarkdown(node.title)}**`);
      writeNested(node.children ?? [], depth + 1, out);
    } else {
      out.push(`${pad}- ${link(node)}`);
    }
  }
}

/** Collect every bookmark at or below a node, depth-first. */
function flatten(nodes: readonly BookmarkNode[], into: BookmarkNode[]): void {
  for (const node of nodes) {
    if (isFolder(node)) flatten(node.children ?? [], into);
    else into.push(node);
  }
}

function writeFlat(roots: readonly BookmarkNode[], out: string[]): void {
  const loose: BookmarkNode[] = [];
  for (const node of roots) if (!isFolder(node)) loose.push(node);
  for (const node of loose) out.push(`- ${link(node)}`);
  if (loose.length > 0) out.push('');

  for (const node of roots) {
    if (!isFolder(node)) continue;
    const bookmarks: BookmarkNode[] = [];
    flatten(node.children ?? [], bookmarks);
    out.push(`## ${escapeMarkdown(node.title)}`, '');
    for (const bookmark of bookmarks) out.push(`- ${link(bookmark)}`);
    out.push('');
  }
}

/** Serialize a tree to Markdown. */
export function serializeMarkdown(
  roots: readonly BookmarkNode[],
  options: MarkdownOptions,
): string {
  const out: string[] = [`# Bookmarks — ${options.date}`, ''];
  if ((options.style ?? 'nested') === 'flat') writeFlat(roots, out);
  else writeNested(roots, 0, out);
  return `${out.join('\n').replace(/\n+$/, '')}\n`;
}
