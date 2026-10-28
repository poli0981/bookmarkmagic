import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseBmJson, readBmJson } from '@/lib/core/parse/bm-json';

/** BM JSON rules added in v1.1.0 — docs/04 §2. */
const doc = (roots: unknown[], extra: Record<string, unknown> = {}): string =>
  JSON.stringify({ format: 'bookmarkmagic', version: 1, ...extra, roots });

describe('BM JSON — addresses', () => {
  it('skips a blank url, which Chrome would turn into a FOLDER', () => {
    const { roots, warnings } = parseBmJson(
      doc([
        { title: 'x', url: '' },
        { title: 'ok', url: 'https://a.example/' },
      ]),
    );
    expect(roots.map((n) => n.title)).toEqual(['ok']);
    expect(warnings).toContainEqual({ code: 'MISSING_URL', count: 1 });
  });

  it('skips an unparseable url and keeps place: (this is the restore format)', () => {
    const { roots, warnings } = parseBmJson(
      doc([
        { title: 'bad', url: 'not a url' },
        { title: 'smart', url: 'place:sort=8' },
      ]),
    );
    expect(roots.map((n) => n.url)).toEqual(['place:sort=8']);
    expect(warnings).toContainEqual({ code: 'INVALID_URL', count: 1 });
  });
});

describe('BM JSON — dates go through the shared normalizer', () => {
  it('reads milliseconds and strings, and flags nonsense instead of storing it', () => {
    const { roots, warnings } = parseBmJson(
      doc([
        { title: 'ms', url: 'https://a.example/', addDate: 1_700_000_000_000 },
        { title: 'string', url: 'https://b.example/', addDate: '1700000000' },
        { title: 'huge', url: 'https://c.example/', addDate: 1e300 },
        { title: 'tiny', url: 'https://d.example/', addDate: 0.3 },
      ]),
    );
    expect(roots.map((n) => n.addDate)).toEqual([1700000000, 1700000000, undefined, undefined]);
    expect(warnings).toContainEqual({ code: 'INVALID_DATE', count: 1 });
  });
});

describe('BM JSON — root markers', () => {
  it('reads "root" on folders only, and lets the toolbar win', () => {
    const { roots } = parseBmJson(
      doc([
        { title: 'o', root: 'other', children: [] },
        { title: 'm', root: 'mobile', children: [] },
        { title: 'both', toolbar: true, root: 'other', children: [] },
        { title: 'junk', root: 'elsewhere', children: [] },
        { title: 'bookmark', root: 'other', url: 'https://a.example/' },
      ]),
    );
    expect(roots.map((n) => n.root)).toEqual(['other', 'mobile', undefined, undefined, undefined]);
  });

  it('marks a 1.0.x full-tree backup so a restore stops nesting Other and Mobile', () => {
    const path = join(process.cwd(), 'tests/fixtures/weird/bm-legacy-1.0.1-backup.json');
    const { roots } = parseBmJson(readFileSync(path, 'utf8'));
    expect(roots.map((n) => [n.title, n.toolbar, n.root])).toEqual([
      ['Bookmarks bar', true, undefined],
      ['Other bookmarks', undefined, 'other'],
      ['Mobile bookmarks', undefined, 'mobile'],
    ]);
  });

  it('leaves a 1.0.x export that is not a three-root backup alone', () => {
    const { roots } = readBmJson({
      format: 'bookmarkmagic',
      generator: 'BookmarkMagic 1.0.1',
      roots: [
        { title: 'Just a folder', children: [] },
        { title: 'Another', children: [] },
      ],
    });
    expect(roots.every((n) => n.root === undefined)).toBe(true);
  });

  it('does not apply the legacy rule to files from 1.1 or later', () => {
    const { roots } = readBmJson({
      format: 'bookmarkmagic',
      generator: 'BookmarkMagic 1.1.0',
      roots: [
        { title: 'Bar', toolbar: true, children: [] },
        { title: 'A folder the user made', children: [] },
        { title: 'Another', children: [] },
      ],
    });
    expect(roots.map((n) => n.root)).toEqual([undefined, undefined, undefined]);
  });
});
