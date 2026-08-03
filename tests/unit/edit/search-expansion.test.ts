import { describe, expect, it } from 'vitest';
import {
  collapseSearchExpansion,
  forgetSearchExpansion,
  mergeSearchExpansion,
} from '@/lib/edit/search-expansion';

/**
 * Search-driven expansion — docs/03 §3.
 *
 * The bug this closes: a one-character query expands most of a large tree, and
 * clearing the box then rendered every one of those rows at once in a single
 * synchronous pass, with no virtualization behind it. The 150 ms debounce
 * delayed that; it never bounded it.
 */
const set = (...ids: string[]): ReadonlySet<string> => new Set(ids);

describe('mergeSearchExpansion', () => {
  it('opens what the search needs and remembers only what it opened', () => {
    const result = mergeSearchExpansion(set('a'), set('a', 'b', 'c'), set());
    expect([...result.expanded].sort()).toEqual(['a', 'b', 'c']);
    // 'a' was already open, so the search does not own it and must not close it.
    expect([...result.opened].sort()).toEqual(['b', 'c']);
  });

  it('accumulates across successive queries', () => {
    const first = mergeSearchExpansion(set(), set('a'), set());
    const second = mergeSearchExpansion(first.expanded, set('b'), first.opened);
    expect([...second.opened].sort()).toEqual(['a', 'b']);
  });

  it('returns the SAME set objects when nothing is missing', () => {
    // Identity, not equality: the caller stores these in `$state`, so returning
    // an equal-but-new Set would re-run every dependent on every keystroke.
    const expanded = set('a', 'b');
    const opened = set('b');
    const result = mergeSearchExpansion(expanded, set('a'), opened);
    expect(result.expanded).toBe(expanded);
    expect(result.opened).toBe(opened);
  });

  it('is a no-op for an empty search', () => {
    const expanded = set('a');
    expect(mergeSearchExpansion(expanded, set(), set()).expanded).toBe(expanded);
  });
});

describe('collapseSearchExpansion', () => {
  it('closes only what the search opened', () => {
    const result = collapseSearchExpansion(set('a', 'b', 'c'), set('b', 'c'));
    expect([...result]).toEqual(['a']);
  });

  it('leaves a folder the user opened themselves alone', () => {
    // The whole point: a user who expanded a folder while searching keeps it.
    const merged = mergeSearchExpansion(set(), set('a', 'b'), set());
    const owned = forgetSearchExpansion(merged.opened, 'a');
    expect([...collapseSearchExpansion(merged.expanded, owned)]).toEqual(['a']);
  });

  it('returns the same set when the search opened nothing', () => {
    const expanded = set('a');
    expect(collapseSearchExpansion(expanded, set())).toBe(expanded);
  });

  it('tolerates an id that is no longer expanded', () => {
    expect([...collapseSearchExpansion(set('a'), set('gone'))]).toEqual(['a']);
  });
});

describe('forgetSearchExpansion', () => {
  it('drops the id, transferring ownership to the user', () => {
    expect([...forgetSearchExpansion(set('a', 'b'), 'a')]).toEqual(['b']);
  });

  it('returns the same set for an id it never owned', () => {
    const opened = set('a');
    expect(forgetSearchExpansion(opened, 'zzz')).toBe(opened);
  });
});

describe('the whole cycle', () => {
  it('search, then clear, returns exactly to the starting state', () => {
    const start = set('root');
    const merged = mergeSearchExpansion(start, set('root', 'x', 'y', 'z'), set());
    expect(merged.expanded.size).toBe(4);

    const cleared = collapseSearchExpansion(merged.expanded, merged.opened);
    expect([...cleared]).toEqual(['root']);
  });
});
