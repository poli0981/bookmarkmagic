import { describe, expect, it } from 'vitest';
import { MAX_DEPTH, MAX_NODES } from '@/lib/core/limits';
import { bookmarkTitle, NodeBudget, stripBom, WarningBag } from '@/lib/core/parse/shared';
import { expectBmError } from '../../../helpers/errors';

describe('WarningBag', () => {
  it('aggregates by code and ignores zero increments', () => {
    const bag = new WarningBag();
    bag.add('MISSING_URL');
    bag.add('MISSING_URL', 2);
    bag.add('INVALID_DATE', 0);
    expect(bag.toArray()).toEqual([{ code: 'MISSING_URL', count: 3 }]);
  });

  it('carries a detail line when one is noted', () => {
    const bag = new WarningBag();
    bag.note('NEWER_VERSION', 'file version 2');
    expect(bag.toArray()).toEqual([{ code: 'NEWER_VERSION', count: 1, detail: 'file version 2' }]);
  });
});

describe('NodeBudget', () => {
  it('allows exactly MAX_NODES and refuses one more', () => {
    const budget = new NodeBudget();
    for (let i = 0; i < MAX_NODES; i++) budget.count();
    expectBmError(() => budget.count(), 'TOO_MANY_NODES');
  });

  it('allows MAX_DEPTH and refuses one more', () => {
    const budget = new NodeBudget();
    expect(() => budget.depth(MAX_DEPTH)).not.toThrow();
    expectBmError(() => budget.depth(MAX_DEPTH + 1, 'roots[0]'), 'TOO_DEEP');
  });
});

describe('bookmarkTitle', () => {
  it('keeps titles verbatim — empty included — and counts the empty ones', () => {
    const bag = new WarningBag();
    expect(bookmarkTitle('', bag)).toBe('');
    expect(bookmarkTitle('  ', bag)).toBe('  ');
    expect(bookmarkTitle('Title', bag)).toBe('Title');
    expect(bag.toArray()).toEqual([{ code: 'EMPTY_TITLE', count: 2 }]);
  });
});

describe('stripBom', () => {
  it('removes exactly one leading U+FEFF', () => {
    expect(stripBom('\uFEFFx')).toBe('x');
    expect(stripBom('\uFEFF\uFEFFx')).toBe('\uFEFFx');
    expect(stripBom('x')).toBe('x');
  });
});
