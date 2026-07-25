import { describe, expect, it } from 'vitest';
import {
  BmParseError,
  type BookmarkNode,
  computeStats,
  type ImportPlan,
  isFolder,
  type MergeMode,
  type PlanSegment,
  walkTree,
} from '@/lib/core/model';

const TREE: BookmarkNode[] = [
  {
    title: 'Bar',
    children: [
      { title: 'a', url: 'https://a.example/' },
      { title: 'Deep', children: [{ title: 'b', url: 'https://b.example/' }] },
    ],
  },
  { title: 'loose', url: 'https://c.example/' },
];

describe('isFolder', () => {
  it('is defined by the absence of a url, not by children', () => {
    expect(isFolder({ title: 'f', children: [] })).toBe(true);
    expect(isFolder({ title: 'f' })).toBe(true);
    expect(isFolder({ title: 'b', url: 'https://x.test/' })).toBe(false);
  });
});

describe('walkTree', () => {
  it('yields parents before children, siblings in order, with 1-based depth', () => {
    expect([...walkTree(TREE)].map(({ node, depth }) => `${depth}:${node.title}`)).toEqual([
      '1:Bar',
      '2:a',
      '2:Deep',
      '3:b',
      '1:loose',
    ]);
  });

  it('handles an empty forest', () => {
    expect([...walkTree([])]).toEqual([]);
  });
});

describe('computeStats', () => {
  it('counts bookmarks, folders and max depth in one pass', () => {
    expect(computeStats(TREE)).toEqual({ bookmarks: 3, folders: 2, maxDepth: 3 });
  });

  it('reports zero depth for an empty forest', () => {
    expect(computeStats([])).toEqual({ bookmarks: 0, folders: 0, maxDepth: 0 });
  });
});

describe('BmParseError', () => {
  it('carries a machine code plus optional detail and line', () => {
    const err = new BmParseError('CSV_ROW_MISMATCH', 'row has 3 fields', 7);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('BmParseError');
    expect(err.code).toBe('CSV_ROW_MISMATCH');
    expect(err.line).toBe(7);
    expect(err.message).toContain('row has 3 fields');
  });

  it('falls back to the bare code when there is no detail', () => {
    expect(new BmParseError('NOT_NETSCAPE').message).toBe('NOT_NETSCAPE');
  });
});

describe('ImportPlan can express every mode (docs/02 §4)', () => {
  const toolbarNodes: BookmarkNode[] = [{ title: 'bar item', url: 'https://a.example/' }];
  const otherNodes: BookmarkNode[] = [{ title: 'other item', url: 'https://b.example/' }];

  const plan = (mode: MergeMode, segments: PlanSegment[]): ImportPlan => ({
    mode,
    dedupe: mode !== 'replace',
    segments,
    stats: {
      toCreate: segments.reduce((n, s) => n + [...walkTree(s.nodes)].length, 0),
      bookmarkCount: segments.reduce(
        (n, s) => n + [...walkTree(s.nodes)].filter(({ node }) => !isFolder(node)).length,
        0,
      ),
      skippedExisting: 0,
      skippedInFile: 0,
    },
  });

  it('new-folder is a single segment under one root', () => {
    const p = plan('new-folder', [
      { rootId: '2', nodes: [{ title: 'Imported 2026-07-25', children: toolbarNodes }] },
    ]);
    expect(p.segments).toHaveLength(1);
    expect(p.stats.toCreate).toBe(2); // wrapper folder + 1 bookmark
    expect(p.stats.bookmarkCount).toBe(1);
  });

  it('merge and replace can target two roots at once', () => {
    for (const mode of ['merge', 'replace'] as const) {
      const p = plan(mode, [
        { rootId: '1', nodes: toolbarNodes },
        { rootId: '2', nodes: otherNodes },
      ]);
      expect(p.segments.map((s) => s.rootId)).toEqual(['1', '2']);
      // One denominator for the whole import, not per segment.
      expect(p.stats.toCreate).toBe(2);
    }
  });

  it('dedupe is off for replace — the browser tree is deleted first', () => {
    expect(plan('replace', []).dedupe).toBe(false);
  });
});
