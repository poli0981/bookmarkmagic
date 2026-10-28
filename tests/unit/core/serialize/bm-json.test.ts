import { describe, expect, it } from 'vitest';
import type { BookmarkNode } from '@/lib/core/model';
import { parseBmJson } from '@/lib/core/parse/bm-json';
import { serializeBmJson } from '@/lib/core/serialize/bm-json';

const OPTIONS = { version: '1.1.0', exportedAt: '2026-10-28T00:00:00.000Z' };

const TREE: BookmarkNode[] = [
  {
    title: 'Bar',
    toolbar: true,
    children: [{ title: 'a', url: 'https://a.example/', addDate: 1 }],
  },
  { title: 'Other', root: 'other', lastModified: 2, children: [] },
  { title: 'Mobile', root: 'mobile', children: [] },
];

describe('serializeBmJson', () => {
  it('writes a stable field order, with the root markers', () => {
    const doc = JSON.parse(serializeBmJson(TREE, OPTIONS));
    expect(Object.keys(doc)).toEqual(['format', 'version', 'generator', 'exportedAt', 'roots']);
    expect(doc.version).toBe(1);
    expect(doc.generator).toBe('BookmarkMagic 1.1.0');
    expect(doc.roots[0]).toEqual({
      title: 'Bar',
      toolbar: true,
      children: [{ title: 'a', url: 'https://a.example/', addDate: 1 }],
    });
    expect(doc.roots[1]).toEqual({ title: 'Other', root: 'other', lastModified: 2, children: [] });
    expect(doc.roots[2].root).toBe('mobile');
  });

  it('never writes root next to toolbar', () => {
    const doc = JSON.parse(
      serializeBmJson([{ title: 'x', toolbar: true, root: 'other', children: [] }], OPTIONS),
    );
    expect(doc.roots[0].root).toBeUndefined();
  });

  it('writes a compact backup on request, indented otherwise', () => {
    const pretty = serializeBmJson(TREE, OPTIONS);
    const compact = serializeBmJson(TREE, { ...OPTIONS, indent: 0 });
    expect(pretty).toContain('\n  "format"');
    expect(compact.trimEnd()).not.toContain('\n');
    expect(compact.endsWith('\n')).toBe(true);
    expect(compact.length).toBeLessThan(pretty.length);
    expect(JSON.parse(compact)).toEqual(JSON.parse(pretty));
  });

  it('round-trips through the parser, markers included', () => {
    expect(parseBmJson(serializeBmJson(TREE, OPTIONS)).roots).toEqual(TREE);
  });
});
