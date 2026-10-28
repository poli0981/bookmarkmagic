/**
 * Markdown serializer — docs/04 §4. Export only; there is no Markdown parser.
 *
 * Purpose: a human-readable share format (blog posts, Discord, README).
 * Inputs: a tree, a heading date, and a style.
 * Guarantees: every character CommonMark gives meaning to is escaped in titles,
 *   a line break inside a title collapses to a space, and URLs containing `)`
 *   or whitespace are angle-bracket wrapped so the link target survives.
 */
import { type BookmarkNode, isBookmark } from '../model';

export type MarkdownStyle = 'nested' | 'flat';

export interface MarkdownOptions {
  /** Rendered into the H1, e.g. "2026-07-25". Passed in — no ambient time. */
  date: string;
  style?: MarkdownStyle;
}

type Bookmark = BookmarkNode & { url: string };

/**
 * Make a title inert Markdown text.
 *
 * Escaping only `[ ] ( )` let a title like `<img src=x onerror=alert(1)>` through
 * as raw HTML — CommonMark allows it inside link text, and the READMEs and blogs
 * a share format ends up in often render it — and let `**`, `_` or a backtick
 * garble the bold folder names. A line break in a title turned the rest of the
 * list into a heading or a paragraph. CommonMark defines a backslash escape for
 * every ASCII punctuation character, so escaping all of these is always safe.
 */
export function escapeMarkdown(value: string): string {
  return value.replace(/\r\n?|\n/g, ' ').replace(/([\\`*_{}[\]()<>#+\-.!|~&])/g, '\\$1');
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

function link(node: Bookmark): string {
  return `[${escapeMarkdown(node.title)}](${formatUrl(node.url)})`;
}

function writeNested(nodes: readonly BookmarkNode[], depth: number, out: string[]): void {
  const pad = '  '.repeat(depth);
  for (const node of nodes) {
    if (isBookmark(node)) {
      out.push(`${pad}- ${link(node)}`);
    } else {
      out.push(`${pad}- **${escapeMarkdown(node.title)}**`);
      writeNested(node.children ?? [], depth + 1, out);
    }
  }
}

/** Collect every bookmark at or below a node, depth-first. */
function flatten(nodes: readonly BookmarkNode[], into: Bookmark[]): void {
  for (const node of nodes) {
    if (isBookmark(node)) into.push(node);
    else flatten(node.children ?? [], into);
  }
}

function writeFlat(roots: readonly BookmarkNode[], out: string[]): void {
  const loose = roots.filter(isBookmark);
  for (const node of loose) out.push(`- ${link(node)}`);
  if (loose.length > 0) out.push('');

  for (const node of roots) {
    if (isBookmark(node)) continue;
    const bookmarks: Bookmark[] = [];
    flatten(node.children ?? [], bookmarks);
    out.push(`## ${escapeMarkdown(node.title)}`, '');
    for (const bookmark of bookmarks) out.push(`- ${link(bookmark)}`);
    out.push('');
  }
}

/**
 * Drop trailing line feeds in one backward pass.
 *
 * Replaces `.replace(/\n+$/, '')`, which backtracks: for every newline in a
 * long run that is NOT at the end, the engine re-scans the rest of the run
 * before failing at `$` — quadratic in the run length (SonarCloud S8786).
 */
function trimTrailingNewlines(text: string): string {
  let end = text.length;
  while (end > 0 && text.charCodeAt(end - 1) === 0x0a) end--;
  return text.slice(0, end);
}

/** Serialize a tree to Markdown. */
export function serializeMarkdown(
  roots: readonly BookmarkNode[],
  options: MarkdownOptions,
): string {
  const out: string[] = [`# Bookmarks — ${options.date}`, ''];
  if ((options.style ?? 'nested') === 'flat') writeFlat(roots, out);
  else writeNested(roots, 0, out);
  return `${trimTrailingNewlines(out.join('\n'))}\n`;
}
