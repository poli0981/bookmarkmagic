import { describe, expect, it } from 'vitest';
import type { BookmarkNode } from '@/lib/core/model';
import { routeTopLevel } from '@/lib/core/route';

const b = (title: string): BookmarkNode => ({ title, url: `https://${title}.example/` });
const titles = (nodes: readonly BookmarkNode[]): string[] => nodes.map((n) => n.title);

/** Top-level routing — docs/03 §1 step 7. */
describe('routeTopLevel', () => {
  it('unwraps the toolbar folder into the bar; a flagged bookmark goes there as itself', () => {
    const routed = routeTopLevel(
      [
        { title: 'Bar', toolbar: true, children: [b('one'), b('two')] },
        { ...b('flagged'), toolbar: true },
      ],
      { hasMobileRoot: true },
    );
    expect(titles(routed.toolbar)).toEqual(['one', 'two', 'flagged']);
    expect(routed.unwrapped).toBe(1);
  });

  it('splices an Other-marked folder in place, keeping the file order', () => {
    const routed = routeTopLevel(
      [b('before'), { title: 'Other', root: 'other', children: [b('x'), b('y')] }, b('after')],
      { hasMobileRoot: true },
    );
    expect(titles(routed.other)).toEqual(['before', 'x', 'y', 'after']);
  });

  it('sends a Mobile-marked folder to Mobile, or keeps it as a folder when there is none', () => {
    const file: BookmarkNode[] = [{ title: 'Mobile', root: 'mobile', children: [b('phone')] }];
    expect(titles(routeTopLevel(file, { hasMobileRoot: true }).mobile)).toEqual(['phone']);
    const without = routeTopLevel(file, { hasMobileRoot: false });
    expect(without.mobile).toEqual([]);
    expect(titles(without.other)).toEqual(['Mobile']);
    expect(without.unwrapped).toBe(0);
  });

  it('lets the toolbar win over a root marker', () => {
    const routed = routeTopLevel(
      [{ title: 'Both', toolbar: true, root: 'other', children: [b('t')] }],
      {
        hasMobileRoot: true,
      },
    );
    expect(titles(routed.toolbar)).toEqual(['t']);
    expect(routed.other).toEqual([]);
  });

  it('reads markers on top-level nodes only — deeper, they are data', () => {
    const inner: BookmarkNode = { title: 'Inner', root: 'other', children: [b('kept')] };
    const routed = routeTopLevel([{ title: 'Outer', children: [inner] }], { hasMobileRoot: true });
    expect(routed.other[0]?.children?.[0]).toBe(inner);
    expect(routed.unwrapped).toBe(0);
  });

  it('handles a root list far past the spread-argument limit', () => {
    const huge = Array.from({ length: 150_000 }, (_, i) => b(`n${i}`));
    const routed = routeTopLevel([{ title: 'Other', root: 'other', children: huge }], {
      hasMobileRoot: true,
    });
    expect(routed.other).toHaveLength(150_000);
  });
});
