import { describe, expect, it } from 'vitest';
import type { LiveNode } from '@/lib/browser/bookmarks';
import { buildExport, countSelected } from '@/lib/export/run-export';

const LIVE: LiveNode[] = [
  {
    id: '1',
    title: 'Bookmarks bar',
    children: [
      { id: '10', title: 'Apple', url: 'https://apple.example/' },
      { id: '11', title: 'Dev', children: [{ id: '12', title: 'GH', url: 'https://gh.example/' }] },
    ],
  },
  { id: '2', title: 'Other', children: [{ id: '20', title: 'Z', url: 'https://z.example/' }] },
];

describe('countSelected', () => {
  it('counts everything when nothing is selected explicitly', () => {
    expect(countSelected(LIVE, undefined)).toBe(3);
  });

  it('counts only the selected subtree', () => {
    expect(countSelected(LIVE, new Set(['11']))).toBe(1);
    expect(countSelected(LIVE, new Set(['1']))).toBe(2);
  });

  it('is zero for an empty selection, which disables the button', () => {
    expect(countSelected(LIVE, new Set())).toBe(0);
  });

  it('agrees with what buildExport would actually write', () => {
    // The button label and the file must never disagree.
    for (const selection of [undefined, new Set(['11']), new Set(['1', '2'])]) {
      expect(countSelected(LIVE, selection)).toBe(
        buildExport(LIVE, {
          format: 'bm-json',
          ...(selection !== undefined && { selection }),
          now: new Date(2026, 6, 25),
        }).bookmarks,
      );
    }
  });
});
