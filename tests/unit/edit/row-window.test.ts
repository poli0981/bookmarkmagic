import { describe, expect, it } from 'vitest';
import {
  follow,
  INITIAL_WINDOW,
  mounted,
  showEarlier,
  showLater,
  WINDOW,
} from '@/lib/edit/row-window';

describe('row window', () => {
  it('mounts everything when there are fewer rows than a window', () => {
    expect(mounted(INITIAL_WINDOW, 0)).toEqual({ from: 0, to: 0 });
    expect(mounted(INITIAL_WINDOW, 120)).toEqual({ from: 0, to: 120 });
  });

  it('jumps to a far row with one window of rows, not every row before it', () => {
    // End on 20 000 rows used to mount all 20 000 (v1.1.0 review).
    const win = follow(INITIAL_WINDOW, 19_999, 20_000);
    const range = mounted(win, 20_000);
    expect(range.to - range.from).toBe(WINDOW);
    expect(range.from).toBeLessThanOrEqual(19_999);
    expect(range.to).toBe(20_000);
  });

  it('keeps the same window while the focus stays inside it', () => {
    const win = follow(INITIAL_WINDOW, 10_000, 20_000);
    expect(follow(win, 10_001, 20_000)).toBe(win);
    expect(follow(win, -1, 20_000)).toBe(win);
  });

  it('always holds the focused row', () => {
    for (const total of [1, 499, 500, 501, 1_234, 20_000]) {
      for (const focus of [0, Math.floor(total / 2), total - 1]) {
        const range = mounted(follow(INITIAL_WINDOW, focus, total), total);
        expect(focus).toBeGreaterThanOrEqual(range.from);
        expect(focus).toBeLessThan(range.to);
      }
    }
  });

  it('refits when the rows shrink under it', () => {
    const win = follow(INITIAL_WINDOW, 9_000, 10_000);
    expect(mounted(win, 600)).toEqual({ from: 100, to: 600 });
  });

  it('grows upward and downward by one step at a time', () => {
    const win = follow(INITIAL_WINDOW, 5_000, 10_000);
    const before = mounted(win, 10_000);
    const up = mounted(showEarlier(win, 10_000), 10_000);
    expect(up).toEqual({ from: before.from - WINDOW, to: before.to });
    const down = mounted(showLater(win, 10_000), 10_000);
    expect(down).toEqual({ from: before.from, to: before.to + WINDOW });
    expect(mounted(showEarlier(INITIAL_WINDOW, 10_000), 10_000)).toEqual({ from: 0, to: WINDOW });
    expect(mounted(showLater({ start: 9_000, size: 900 }, 10_000), 10_000)).toEqual({
      from: 9_000,
      to: 10_000,
    });
  });
});
