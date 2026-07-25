import { describe, expect, it } from 'vitest';
import { BmParseError } from '@/lib/core/model';
import { parseBmJson } from '@/lib/core/parse/bm-json';

const wrap = (roots: unknown, extra: Record<string, unknown> = {}): string =>
  JSON.stringify({ format: 'bookmarkmagic', version: 1, roots, ...extra });

describe('parseBmJson — happy path', () => {
  it('reads nodes, dates and the toolbar flag', () => {
    const { roots, stats } = parseBmJson(
      wrap([
        {
          title: 'Bar',
          toolbar: true,
          addDate: 1751500000,
          lastModified: 1751500001,
          children: [{ title: 'A', url: 'https://a.example/', addDate: 1751500002 }],
        },
      ]),
    );
    expect(roots[0]?.toolbar).toBe(true);
    expect(roots[0]?.children?.[0]?.url).toBe('https://a.example/');
    expect(stats).toEqual({ bookmarks: 1, folders: 1, maxDepth: 2 });
  });

  it('treats a folder with no children key as an empty folder', () => {
    const { roots } = parseBmJson(wrap([{ title: 'Empty' }]));
    expect(roots[0]).toEqual({ title: 'Empty', children: [] });
  });

  it('ignores unknown keys for forward compatibility', () => {
    const { roots } = parseBmJson(
      wrap([{ title: 'A', url: 'https://a.example/', futureField: 1 }]),
    );
    expect(roots[0]).toEqual({ title: 'A', url: 'https://a.example/' });
  });

  it('warns but still parses when the file version is newer', () => {
    const { warnings } = parseBmJson(wrap([], { version: 99 }));
    expect(warnings.map((w) => w.code)).toContain('NEWER_VERSION');
  });

  it('drops non-positive dates rather than storing them', () => {
    const { roots } = parseBmJson(wrap([{ title: 'A', url: 'https://a.example/', addDate: 0 }]));
    expect(Object.hasOwn(roots[0] ?? {}, 'addDate')).toBe(false);
  });
});

describe('parseBmJson — rejections', () => {
  const expectCode = (text: string, code: string): void => {
    try {
      parseBmJson(text);
      expect.unreachable(`should have thrown ${code}`);
    } catch (err) {
      expect(err).toBeInstanceOf(BmParseError);
      expect((err as BmParseError).code).toBe(code);
    }
  };

  it('rejects malformed JSON', () => {
    expectCode('{ not json', 'MALFORMED_JSON');
  });

  it('rejects JSON that is not ours', () => {
    expectCode('{"checksum":"x","roots":{}}', 'NOT_BM_JSON');
    expectCode('[]', 'NOT_BM_JSON');
  });

  it('rejects a non-array roots', () => {
    expectCode('{"format":"bookmarkmagic","roots":{}}', 'INVALID_NODE');
  });

  it('rejects structurally invalid nodes', () => {
    expectCode(wrap([null]), 'INVALID_NODE');
    expectCode(wrap([{ url: 'https://a.example/' }]), 'INVALID_NODE'); // no title
    expectCode(wrap([{ title: 'A', url: 42 }]), 'INVALID_NODE');
    expectCode(wrap([{ title: 'A', children: 'nope' }]), 'INVALID_NODE');
    expectCode(wrap([{ title: 'A', url: 'https://a.example/', children: [] }]), 'INVALID_NODE');
  });

  it('names the offending path in the detail', () => {
    try {
      parseBmJson(wrap([{ title: 'ok', children: [{ nope: true }] }]));
      expect.unreachable('should have thrown');
    } catch (err) {
      expect((err as BmParseError).detail).toContain('roots[0].children[0]');
    }
  });

  it('warns when there are no bookmarks at all', () => {
    expect(parseBmJson(wrap([])).warnings.map((w) => w.code)).toContain('NO_BOOKMARKS');
  });
});
