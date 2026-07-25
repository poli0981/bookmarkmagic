import { describe, expect, it } from 'vitest';
import type { LiveNode } from '@/lib/browser/bookmarks';
import { parseNetscapeHtml } from '@/lib/core/parse/netscape-html';
import { buildExport, FORMAT_META } from '@/lib/export/run-export';

const NOW = new Date(2026, 6, 25, 14, 5);

const LIVE: LiveNode[] = [
  {
    id: '1',
    title: 'Bookmarks bar',
    children: [
      { id: '10', title: 'Apple', url: 'https://apple.example/', dateAdded: 1_751_500_000_000 },
      {
        id: '11',
        title: 'Dev',
        children: [{ id: '12', title: 'GitHub', url: 'https://github.com/' }],
      },
    ],
  },
  {
    id: '2',
    title: 'Other bookmarks',
    children: [{ id: '20', title: 'Zebra', url: 'https://z.example/' }],
  },
];

describe('buildExport — scope', () => {
  it('exports everything when no selection is given', () => {
    const preview = buildExport(LIVE, { format: 'bm-json', now: NOW }, '1');
    expect(preview.bookmarks).toBe(3);
    expect(preview.filename).toBe('bookmarks-all-20260725-1405.json');
  });

  it('exports only the selected subtree, keeping its folder path', () => {
    const preview = buildExport(
      LIVE,
      { format: 'bm-json', selection: new Set(['11']), now: NOW },
      '1',
    );
    expect(preview.bookmarks).toBe(1);
    expect(preview.filename).toBe('bookmarks-partial-20260725-1405.json');
    expect(preview.content).toContain('GitHub');
    expect(preview.content).toContain('Bookmarks bar');
    expect(preview.content).not.toContain('Zebra');
  });
});

describe('buildExport — formats', () => {
  it.each(Object.keys(FORMAT_META) as (keyof typeof FORMAT_META)[])(
    'produces the documented extension and mime type for %s',
    (format) => {
      const preview = buildExport(LIVE, { format, now: NOW }, '1');
      expect(preview.filename.endsWith(`.${FORMAT_META[format].extension}`)).toBe(true);
      expect(preview.mimeType).toBe(FORMAT_META[format].mimeType);
      expect(preview.content.length).toBeGreaterThan(0);
    },
  );

  it('honours the CSV delimiter setting', () => {
    const preview = buildExport(LIVE, { format: 'csv', csvDelimiter: ';', now: NOW }, '1');
    expect(preview.content).toContain('folder_path;title;url;add_date');
  });

  it('honours the Markdown style setting', () => {
    const nested = buildExport(LIVE, { format: 'markdown', now: NOW }, '1');
    const flat = buildExport(LIVE, { format: 'markdown', markdownStyle: 'flat', now: NOW }, '1');
    expect(nested.content).toContain('- **Bookmarks bar**');
    expect(flat.content).toContain('## Bookmarks bar');
  });

  it('dates the Markdown heading with an ISO date, not a locale format', () => {
    expect(buildExport(LIVE, { format: 'markdown', now: NOW }, '1').content).toContain(
      '# Bookmarks — 2026-07-25',
    );
  });
});

describe('buildExport — round trip', () => {
  it('exported HTML re-imports with the toolbar intact', () => {
    // The Phase 3 exit criterion: an exported file must come back losslessly,
    // including which folder is the Bookmarks Bar.
    const preview = buildExport(LIVE, { format: 'netscape-html', now: NOW }, '1');
    const { roots, warnings } = parseNetscapeHtml(preview.content);

    expect(warnings).toEqual([]);
    expect(roots.map((r) => r.title)).toEqual(['Bookmarks bar', 'Other bookmarks']);
    expect(roots[0]?.toolbar).toBe(true);
    expect(roots[0]?.children?.[1]?.children?.[0]?.url).toBe('https://github.com/');
  });

  it('converts live millisecond dates to the file format seconds', () => {
    const preview = buildExport(LIVE, { format: 'netscape-html', now: NOW }, '1');
    expect(parseNetscapeHtml(preview.content).roots[0]?.children?.[0]?.addDate).toBe(1751500000);
  });

  it('does not mark a toolbar at all when none is resolved', () => {
    const preview = buildExport(LIVE, { format: 'bm-json', now: NOW });
    expect(preview.content).not.toContain('"toolbar"');
  });
});
