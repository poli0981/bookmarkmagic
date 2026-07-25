import { describe, expect, it } from 'vitest';
import type { BookmarkNode } from '@/lib/core/model';
import { parseBmJson } from '@/lib/core/parse/bm-json';
import { parseCsv } from '@/lib/core/parse/csv';
import { parseNetscapeHtml } from '@/lib/core/parse/netscape-html';
import { serializeBmJson } from '@/lib/core/serialize/bm-json';
import { serializeCsv } from '@/lib/core/serialize/csv';
import { serializeNetscapeHtml } from '@/lib/core/serialize/netscape-html';
import { generateTree, makeRng, project, type RoundTripFormat } from '../../helpers/tree';

/**
 * The flagship suite — docs/11 §3.
 *
 * `parse(serialize(t)).roots deepEquals project(t, format)`, plus
 * `warnings.length === 0`, so a parser that silently degrades cannot pass.
 */
const ROUND_TRIPS: Record<
  RoundTripFormat,
  {
    serialize: (t: readonly BookmarkNode[]) => string;
    parse: (s: string) => ReturnType<typeof parseBmJson>;
  }
> = {
  'bm-json': {
    serialize: (t) => serializeBmJson(t, { version: '0.1.0', exportedAt: '2026-07-25T00:00:00Z' }),
    parse: parseBmJson,
  },
  'netscape-html': { serialize: serializeNetscapeHtml, parse: parseNetscapeHtml },
  csv: { serialize: (t) => serializeCsv(t), parse: parseCsv },
};

const FORMATS = Object.keys(ROUND_TRIPS) as RoundTripFormat[];

const SAMPLE: BookmarkNode[] = [
  {
    title: 'Bookmarks bar',
    toolbar: true,
    addDate: 1751500000,
    lastModified: 1751500001,
    children: [
      { title: 'Example', url: 'https://example.com/', addDate: 1751500000 },
      {
        title: 'Dev tools',
        addDate: 1751500002,
        children: [{ title: 'GitHub', url: 'https://github.com/', addDate: 1751500003 }],
      },
    ],
  },
  {
    title: 'Other',
    children: [{ title: 'Nested only', children: [] }],
  },
];

describe.each(FORMATS)('round-trip: %s', (format) => {
  const { serialize, parse } = ROUND_TRIPS[format];

  it('reproduces the sample tree under the documented projection', () => {
    const result = parse(serialize(SAMPLE));
    expect(result.roots).toEqual(project(SAMPLE, format));
  });

  it('emits no warnings for a clean tree', () => {
    // CSV drops the sample's empty folders, which legitimately yields nothing
    // to warn about; HTML/JSON must be silent too.
    expect(parse(serialize(SAMPLE)).warnings).toEqual([]);
  });

  it('survives 200 seeded random trees', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const tree = generateTree(makeRng(seed));
      const expected = project(tree, format);
      let actual: BookmarkNode[];
      try {
        actual = parse(serialize(tree)).roots;
      } catch (err) {
        throw new Error(`seed ${seed} (${format}) threw: ${String(err)}`);
      }
      expect(actual, `seed ${seed} (${format})`).toEqual(expected);
    }
  });
});

describe('round-trip: cross-format', () => {
  it('HTML → JSON → CSV keeps every bookmark URL that CSV can carry', () => {
    const viaHtml = parseNetscapeHtml(serializeNetscapeHtml(SAMPLE)).roots;
    const viaJson = parseBmJson(
      serializeBmJson(viaHtml, { version: '0.1.0', exportedAt: '2026-07-25T00:00:00Z' }),
    ).roots;
    const viaCsv = parseCsv(serializeCsv(viaJson)).roots;

    const urls = (nodes: readonly BookmarkNode[]): string[] => {
      const out: string[] = [];
      const walk = (list: readonly BookmarkNode[]): void => {
        for (const n of list) {
          if (n.url !== undefined) out.push(n.url);
          walk(n.children ?? []);
        }
      };
      walk(nodes);
      return out.sort();
    };

    expect(urls(viaCsv)).toEqual(urls(SAMPLE));
  });

  it('CSV re-imports its own export, BOM and all', () => {
    const csv = serializeCsv(SAMPLE);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(parseCsv(csv).roots).toEqual(project(SAMPLE, 'csv'));
  });

  it('CSV round-trips with the semicolon delimiter too', () => {
    const csv = serializeCsv(SAMPLE, { delimiter: ';' });
    expect(parseCsv(csv).roots).toEqual(project(SAMPLE, 'csv'));
  });
});
