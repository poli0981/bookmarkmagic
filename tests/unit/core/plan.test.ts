import { describe, expect, it } from 'vitest';
import { buildUrlIndex } from '@/lib/core/dedupe';
import type { BookmarkNode } from '@/lib/core/model';
import { type BuildPlanOptions, buildImportPlan } from '@/lib/core/plan';

const FILE: BookmarkNode[] = [
  {
    title: 'Bookmarks bar',
    toolbar: true,
    children: [
      { title: 'bar link', url: 'https://bar.example/' },
      { title: 'Sub', children: [{ title: 'nested', url: 'https://nested.example/' }] },
    ],
  },
  {
    title: 'Other bookmarks',
    children: [{ title: 'other link', url: 'https://other.example/' }],
  },
];

const BROWSER: BookmarkNode[] = [
  { title: 'Bar', children: [{ title: 'dup', url: 'https://bar.example/' }] },
];

const base: Omit<BuildPlanOptions, 'mode' | 'dedupe'> = {
  roots: FILE,
  browserIndex: buildUrlIndex(BROWSER),
  toolbarRootId: '1',
  otherRootId: '2',
  newFolderTitle: 'Imported 2026-07-25 14:05',
};

describe('buildImportPlan — new-folder (the safe default)', () => {
  const plan = buildImportPlan({ ...base, mode: 'new-folder', dedupe: false });

  it('produces exactly one segment under Other Bookmarks', () => {
    expect(plan.segments).toHaveLength(1);
    expect(plan.segments[0]?.rootId).toBe('2');
  });

  it('wraps the whole tree in the dated folder', () => {
    const wrapper = plan.segments[0]?.nodes[0];
    expect(wrapper?.title).toBe('Imported 2026-07-25 14:05');
    expect(wrapper?.children).toHaveLength(2);
  });

  it('counts the wrapper folder in toCreate but not in bookmarkCount', () => {
    // 1 wrapper + 2 top folders + 1 sub + 3 bookmarks = 7 nodes, 3 bookmarks.
    expect(plan.stats.toCreate).toBe(7);
    expect(plan.stats.bookmarkCount).toBe(3);
  });
});

describe('buildImportPlan — merge splits across both roots', () => {
  const plan = buildImportPlan({ ...base, mode: 'merge', dedupe: false });

  it('sends the toolbar folder CONTENTS to the bar, not the folder itself', () => {
    // Writing the folder itself would produce "Bookmarks bar/Bookmarks bar".
    const bar = plan.segments.find((s) => s.rootId === '1');
    expect(bar?.nodes.map((n) => n.title)).toEqual(['bar link', 'Sub']);
  });

  it('sends everything else to Other Bookmarks', () => {
    const other = plan.segments.find((s) => s.rootId === '2');
    expect(other?.nodes.map((n) => n.title)).toEqual(['Other bookmarks']);
  });

  it('keeps one denominator across both segments', () => {
    // bar: bar link + Sub + nested = 3; other: Other bookmarks + other link = 2.
    expect(plan.stats.toCreate).toBe(5);
    expect(plan.stats.bookmarkCount).toBe(3);
  });

  it('omits an empty segment rather than emitting it', () => {
    const noToolbar = buildImportPlan({
      ...base,
      roots: [{ title: 'Plain', children: [] }],
      mode: 'merge',
      dedupe: false,
    });
    expect(noToolbar.segments.map((s) => s.rootId)).toEqual(['2']);
  });
});

describe('buildImportPlan — dedupe', () => {
  it('skips URLs already in the browser and reports the count', () => {
    const plan = buildImportPlan({ ...base, mode: 'merge', dedupe: true });
    expect(plan.stats.skippedExisting).toBe(1);
    const bar = plan.segments.find((s) => s.rootId === '1');
    expect(bar?.nodes.map((n) => n.title)).toEqual(['Sub']);
  });

  it('ignores the browser index entirely in replace mode', () => {
    // The tree is deleted first, so skipping "existing" links would wipe out a
    // user restoring their own backup.
    const plan = buildImportPlan({ ...base, mode: 'replace', dedupe: true });
    expect(plan.stats.skippedExisting).toBe(0);
    expect(plan.stats.bookmarkCount).toBe(3);
  });

  it('still collapses in-file repeats in replace mode', () => {
    const withRepeat: BookmarkNode[] = [
      { title: 'a', url: 'https://same.example/' },
      { title: 'b', url: 'https://same.example/' },
    ];
    const plan = buildImportPlan({ ...base, roots: withRepeat, mode: 'replace', dedupe: true });
    expect(plan.stats.skippedInFile).toBe(1);
    expect(plan.stats.bookmarkCount).toBe(1);
  });
});

describe('buildImportPlan — independence', () => {
  it('never aliases the parsed tree, even with dedupe off', () => {
    const roots: BookmarkNode[] = [
      { title: 'F', children: [{ title: 'a', url: 'https://a.example/' }] },
    ];
    const plan = buildImportPlan({ ...base, roots, mode: 'merge', dedupe: false });
    const planned = plan.segments[0]?.nodes[0];
    expect(planned).toEqual(roots[0]);
    expect(planned).not.toBe(roots[0]);
    expect(planned?.children?.[0]).not.toBe(roots[0]?.children?.[0]);
  });
});
