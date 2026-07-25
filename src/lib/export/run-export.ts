/**
 * The export pipeline — docs/03 §2.
 *
 * Purpose: turn the live tree plus a scope and format into a downloaded file.
 * Guarantees: pure up to the final download; no `downloads` permission (the
 *   anchor path is enough here — unlike the Replace backup, a failed export
 *   loses nothing).
 */
import { getRootChildren, getRoots, type LiveNode, toBookmarkNodes } from '../browser/bookmarks';
import { sanitizeFilename, timestampSuffix, triggerDownload } from '../browser/download';
import type { ExportFormat } from '../browser/storage';
import { filterBySelection } from '../core/select';
import { serializeBmJson } from '../core/serialize/bm-json';
import { type CsvDelimiter, serializeCsv } from '../core/serialize/csv';
import { type MarkdownStyle, serializeMarkdown } from '../core/serialize/markdown';
import { serializeNetscapeHtml } from '../core/serialize/netscape-html';

const APP_VERSION = '0.1.0';

export const FORMAT_META: Record<
  ExportFormat,
  { extension: string; mimeType: string; importable: boolean }
> = {
  'netscape-html': { extension: 'html', mimeType: 'text/html', importable: true },
  'bm-json': { extension: 'json', mimeType: 'application/json', importable: true },
  csv: { extension: 'csv', mimeType: 'text/csv', importable: true },
  markdown: { extension: 'md', mimeType: 'text/markdown', importable: false },
};

export interface ExportOptions {
  format: ExportFormat;
  /** `undefined` ⇒ everything; otherwise the tri-state folder selection. */
  selection?: ReadonlySet<string>;
  csvDelimiter?: CsvDelimiter;
  markdownStyle?: MarkdownStyle;
  /** Passed in so this module stays free of ambient time. */
  now: Date;
}

export interface ExportPreview {
  content: string;
  filename: string;
  mimeType: string;
  bookmarks: number;
}

/** ISO date for the Markdown heading — locale-independent by design (docs/07 §3). */
function isoDate(now: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * Count the bookmarks a selection would export.
 *
 * Separate from `buildExport` on purpose: the UI needs this on every render to
 * label the button, and serializing the whole tree just to count it would be
 * O(n) work per keystroke on a 100k-node profile.
 */
export function countSelected(
  roots: readonly LiveNode[],
  selection: ReadonlySet<string> | undefined,
): number {
  const scoped = selection === undefined ? roots : filterBySelection(roots, selection);
  let total = 0;
  const walk = (nodes: readonly LiveNode[]): void => {
    for (const node of nodes) {
      if (node.url !== undefined) total++;
      walk(node.children ?? []);
    }
  };
  walk(scoped);
  return total;
}

/** Serialize a scoped tree. Split out from the download so it is testable. */
export function buildExport(
  roots: readonly LiveNode[],
  options: ExportOptions,
  toolbarId?: string,
): ExportPreview {
  const scoped =
    options.selection === undefined ? [...roots] : filterBySelection(roots, options.selection);
  // Carrying the toolbar marker is what lets an exported HTML file re-import
  // into the Bookmarks Bar rather than under Other Bookmarks (docs/03 §1).
  const nodes = toBookmarkNodes(scoped, toolbarId === undefined ? {} : { toolbarId });

  let bookmarks = 0;
  const count = (list: readonly { url?: string; children?: unknown[] }[]): void => {
    for (const node of list) {
      if (node.url !== undefined) bookmarks++;
      count((node.children ?? []) as { url?: string; children?: unknown[] }[]);
    }
  };
  count(nodes);

  const meta = FORMAT_META[options.format];
  const scope = options.selection === undefined ? 'all' : 'partial';
  return {
    content: serialize(nodes, options),
    filename: sanitizeFilename(
      `bookmarks-${scope}-${timestampSuffix(options.now)}.${meta.extension}`,
    ),
    mimeType: meta.mimeType,
    bookmarks,
  };
}

function serialize(nodes: ReturnType<typeof toBookmarkNodes>, options: ExportOptions): string {
  switch (options.format) {
    case 'netscape-html':
      return serializeNetscapeHtml(nodes);
    case 'bm-json':
      return serializeBmJson(nodes, {
        version: APP_VERSION,
        exportedAt: options.now.toISOString(),
      });
    case 'csv':
      return serializeCsv(nodes, {
        ...(options.csvDelimiter !== undefined && { delimiter: options.csvDelimiter }),
      });
    case 'markdown':
      return serializeMarkdown(nodes, {
        date: isoDate(options.now),
        ...(options.markdownStyle !== undefined && { style: options.markdownStyle }),
      });
  }
}

/** Read the live tree, serialize per `options`, and hand the file to the browser. */
export async function runExport(options: ExportOptions): Promise<ExportPreview> {
  const [roots, resolved] = await Promise.all([getRootChildren(), getRoots()]);
  const preview = buildExport(roots, options, resolved.toolbarId);
  triggerDownload(preview.filename, preview.content, preview.mimeType);
  return preview;
}
