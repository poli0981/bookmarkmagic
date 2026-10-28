import { describe, expect, it } from 'vitest';
import { type LiveFolderLike, planIntoFolder } from '@/lib/core/merge';
import { type BookmarkNode, isFolder, walkTree } from '@/lib/core/model';
import { generateTree, makeRng } from '../../helpers/tree';

const folder = (id: string, title: string, children: LiveFolderLike[] = []): LiveFolderLike => ({
  id,
  title,
  children,
});

/** Merge folder matching — docs/05 §5. */
describe('planIntoFolder — matching', () => {
  const live = folder('1', 'Bar', [
    folder('10', 'Dev', [folder('11', 'Deep')]),
    { id: '12', title: 'Link', url: 'https://a.example/' },
    folder('13', 'Dev'),
    { id: '14', title: 'Managed', unmodifiable: 'managed', children: [] },
  ]);

  it('reuses matched folders at every level and writes only the new items', () => {
    const plan = planIntoFolder(
      [
        {
          title: 'Dev',
          children: [{ title: 'Deep', children: [{ title: 'x', url: 'https://x.example/' }] }],
        },
      ],
      live,
    );
    expect(plan.reusedFolders).toBe(2);
    expect(plan.segments).toEqual([
      {
        parentId: '11',
        trail: ['Dev', 'Deep'],
        nodes: [{ title: 'x', url: 'https://x.example/' }],
      },
    ]);
  });

  it('matches exactly and case-sensitively', () => {
    const plan = planIntoFolder([{ title: 'dev', children: [] }], live);
    expect(plan.reusedFolders).toBe(0);
    expect(plan.segments[0]?.parentId).toBe('1');
  });

  it('never matches a bookmark that has the same title', () => {
    const plan = planIntoFolder([{ title: 'Link', children: [] }], live);
    expect(plan.segments[0]?.nodes).toEqual([{ title: 'Link', children: [] }]);
  });

  it('uses the first of two same-named live folders', () => {
    const plan = planIntoFolder(
      [{ title: 'Dev', children: [{ title: 'y', url: 'https://y.example/' }] }],
      live,
    );
    expect(plan.segments[0]?.parentId).toBe('10');
  });

  it('never writes into a policy-managed folder', () => {
    const plan = planIntoFolder([{ title: 'Managed', children: [] }], live);
    expect(plan.reusedFolders).toBe(0);
    expect(plan.segments[0]?.parentId).toBe('1');
  });

  it('creates an unmatched folder as one node, its whole subtree inside it', () => {
    const fresh: BookmarkNode = {
      title: 'New',
      children: [{ title: 'Dev', children: [{ title: 'z', url: 'https://z.example/' }] }],
    };
    const plan = planIntoFolder([fresh], live);
    // The inner "Dev" is NOT matched against Bar/Dev: its parent does not exist.
    expect(plan.segments).toEqual([{ parentId: '1', nodes: [fresh] }]);
  });

  it('keeps file order within each folder it appends to', () => {
    const plan = planIntoFolder(
      [
        { title: 'a', url: 'https://a/' },
        { title: 'Dev', children: [{ title: 'in', url: 'https://in/' }] },
        { title: 'b', url: 'https://b/' },
      ],
      live,
    );
    expect(plan.segments.map((s) => [s.parentId, s.nodes.map((n) => n.title)])).toEqual([
      ['1', ['a', 'b']],
      ['10', ['in']],
    ]);
  });
});

describe('planIntoFolder — properties over 200 random trees', () => {
  /** A live copy of a file tree, with fresh ids and the odd managed folder. */
  function toLive(nodes: readonly BookmarkNode[], rng: () => number, ids: { n: number }) {
    return nodes.map((node): LiveFolderLike => {
      const id = `L${ids.n++}`;
      if (!isFolder(node)) return { id, title: node.title, url: node.url ?? '' };
      return {
        id,
        title: node.title,
        ...(rng() < 0.05 && { unmodifiable: 'managed' }),
        children: toLive(node.children ?? [], rng, ids),
      };
    });
  }

  /** Keep a random ~60% of a tree, so the live side overlaps the file without equalling it. */
  function thin(nodes: readonly BookmarkNode[], rng: () => number): BookmarkNode[] {
    return nodes
      .filter(() => rng() < 0.6)
      .map((n) => (n.children === undefined ? n : { ...n, children: thin(n.children, rng) }));
  }

  /** Writable folders by id, never descending into a managed one. */
  function writableFolders(root: LiveFolderLike): Map<string, LiveFolderLike> {
    const out = new Map<string, LiveFolderLike>();
    const stack = [root];
    while (stack.length > 0) {
      const node = stack.pop() as LiveFolderLike;
      if (node.url !== undefined || node.unmodifiable !== undefined) continue;
      out.set(node.id, node);
      for (const child of node.children ?? []) stack.push(child);
    }
    return out;
  }

  function scenario(seed: number) {
    const rng = makeRng(seed);
    const file = generateTree(rng, { maxDepth: 4, maxChildren: 5 });
    const ids = { n: 0 };
    const live = folder('root', 'Root', [
      ...toLive(thin(file, rng), rng, ids),
      ...toLive(generateTree(rng, { maxDepth: 2 }), rng, ids),
    ]);
    return { file, live, plan: planIntoFolder(file, live) };
  }

  const SEEDS = Array.from({ length: 200 }, (_, seed) => seed + 1);

  it('the corpus really exercises reuse, so the properties cannot pass vacuously', () => {
    const reusing = SEEDS.filter((seed) => scenario(seed).plan.reusedFolders > 0);
    expect(reusing.length).toBeGreaterThan(50);
  });

  it.each(SEEDS)('seed %i', (seed) => {
    const { file, live, plan } = scenario(seed);
    const writable = writableFolders(live);

    // Every write lands in a folder that exists and may be written to.
    for (const segment of plan.segments) expect(writable.has(segment.parentId)).toBe(true);

    // Nothing lost, nothing invented: each file node is created or reused.
    const created = plan.segments.reduce((n, s) => n + [...walkTree(s.nodes)].length, 0);
    expect(created + plan.reusedFolders).toBe([...walkTree(file)].length);

    // No created folder duplicates a writable folder already in its parent.
    for (const segment of plan.segments) {
      const existing = new Set(
        (writable.get(segment.parentId)?.children ?? [])
          .filter((c) => c.url === undefined && c.unmodifiable === undefined)
          .map((c) => c.title),
      );
      for (const node of segment.nodes) {
        if (isFolder(node)) expect(existing.has(node.title)).toBe(false);
      }
    }
  });
});
