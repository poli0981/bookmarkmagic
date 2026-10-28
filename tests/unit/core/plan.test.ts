import { describe, expect, it } from 'vitest';
import { buildUrlIndex } from '@/lib/core/dedupe';
import type { LiveFolderLike } from '@/lib/core/merge';
import type { BookmarkNode } from '@/lib/core/model';
import { type BuildPlanOptions, buildImportPlan, type PlanDestinations } from '@/lib/core/plan';

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
    root: 'other',
    children: [{ title: 'other link', url: 'https://other.example/' }],
  },
  { title: 'Loose', url: 'https://loose.example/' },
];

/** Live roots as `getTree()` returns them: bar has a "Sub" folder already. */
function live(): PlanDestinations {
  const sub: LiveFolderLike = { id: '50', title: 'Sub', children: [] };
  return {
    toolbar: {
      id: '1',
      title: 'Bookmarks bar',
      children: [{ id: '40', title: 'dup', url: 'https://bar.example/' }, sub],
    },
    other: { id: '2', title: 'Other bookmarks', children: [] },
    mobile: { id: '3', title: 'Mobile bookmarks', children: [] },
  };
}

const base: Omit<BuildPlanOptions, 'mode' | 'dedupe'> = {
  roots: FILE,
  browserIndex: buildUrlIndex([{ title: 'x', url: 'https://bar.example/' }]),
  destinations: live(),
  newFolderTitle: 'Imported 2026-07-25 14:05',
};

const titlesUnder = (plan: ReturnType<typeof buildImportPlan>, parentId: string): string[] =>
  plan.segments.find((s) => s.parentId === parentId)?.nodes.map((n) => n.title) ?? [];

describe('buildImportPlan — new-folder (the safe default)', () => {
  const plan = buildImportPlan({ ...base, mode: 'new-folder', dedupe: false });

  it('produces exactly one segment under Other Bookmarks, wrapping the whole file', () => {
    expect(plan.segments).toHaveLength(1);
    expect(plan.segments[0]?.parentId).toBe('2');
    const wrapper = plan.segments[0]?.nodes[0];
    expect(wrapper?.title).toBe('Imported 2026-07-25 14:05');
    expect(wrapper?.children?.map((n) => n.title)).toEqual([
      'Bookmarks bar',
      'Other bookmarks',
      'Loose',
    ]);
  });

  it('counts the wrapper as a folder to create, and reuses nothing', () => {
    // wrapper + bar + Sub + Other = 4 folders; 4 bookmarks.
    expect(plan.stats).toMatchObject({
      toCreate: 8,
      bookmarkCount: 4,
      folderCount: 4,
      reusedFolders: 0,
    });
  });
});

describe('buildImportPlan — merge', () => {
  const plan = buildImportPlan({ ...base, mode: 'merge', dedupe: false });

  it('unwraps the bar and Other: their contents land in the roots themselves', () => {
    // Writing the folders would produce "Bookmarks bar/Bookmarks bar".
    expect(titlesUnder(plan, '1')).toEqual(['bar link']);
    expect(titlesUnder(plan, '2')).toEqual(['other link', 'Loose']);
  });

  it('writes into the "Sub" the user already has instead of creating a second one', () => {
    const sub = plan.segments.find((s) => s.parentId === '50');
    expect(sub?.nodes.map((n) => n.title)).toEqual(['nested']);
    expect(sub?.trail).toEqual(['Sub']);
    expect(plan.stats.reusedFolders).toBe(1);
  });

  it('counts only what it will create', () => {
    expect(plan.stats).toMatchObject({ toCreate: 4, bookmarkCount: 4, folderCount: 0 });
  });

  it('omits a root nothing is bound for', () => {
    const one = buildImportPlan({
      ...base,
      roots: [{ title: 'Plain', children: [] }],
      mode: 'merge',
      dedupe: false,
    });
    expect(one.segments.map((s) => s.parentId)).toEqual(['2']);
  });

  it('skips URLs already in the browser when dedupe is on, and keeps the folders', () => {
    const deduped = buildImportPlan({ ...base, mode: 'merge', dedupe: true });
    expect(deduped.dedupe).toBe(true);
    expect(deduped.stats.skippedExisting).toBe(1);
    expect(titlesUnder(deduped, '1')).toEqual([]);
  });
});

describe('buildImportPlan — Mobile', () => {
  const file: BookmarkNode[] = [
    { title: 'Mobile bookmarks', root: 'mobile', children: [{ title: 'p', url: 'https://p/' }] },
  ];

  it('restores a Mobile-marked folder into the Mobile root', () => {
    const plan = buildImportPlan({ ...base, roots: file, mode: 'merge', dedupe: false });
    expect(titlesUnder(plan, '3')).toEqual(['p']);
  });

  it('keeps it as an ordinary folder under Other when the profile has no Mobile root', () => {
    const { mobile: _absent, ...noMobile } = live();
    const plan = buildImportPlan({
      ...base,
      roots: file,
      destinations: noMobile,
      mode: 'merge',
      dedupe: false,
    });
    expect(titlesUnder(plan, '2')).toEqual(['Mobile bookmarks']);
  });
});

describe('buildImportPlan — replace', () => {
  it('never dedupes, whatever the stored preference says', () => {
    // The tree is deleted first: skipping "existing" links would wipe out a
    // user restoring their own backup, and in-file repeats are part of it.
    const withRepeat: BookmarkNode[] = [
      { title: 'a', url: 'https://bar.example/' },
      { title: 'b', url: 'https://bar.example/' },
    ];
    const plan = buildImportPlan({ ...base, roots: withRepeat, mode: 'replace', dedupe: true });
    expect(plan.dedupe).toBe(false);
    expect(plan.stats).toMatchObject({ skippedExisting: 0, skippedInFile: 0, bookmarkCount: 2 });
  });

  it('plans against emptied roots: a folder the old tree had is created, not reused', () => {
    const plan = buildImportPlan({ ...base, mode: 'replace', dedupe: false });
    expect(titlesUnder(plan, '1')).toEqual(['bar link', 'Sub']);
    expect(plan.segments.some((s) => s.parentId === '50')).toBe(false);
    expect(plan.stats.reusedFolders).toBe(0);
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
