import { describe, expect, it } from 'vitest';
import { millisToSeconds, normalizeEpochSeconds } from '@/lib/core/timestamps';

describe('normalizeEpochSeconds — magnitude table (docs/05 §4)', () => {
  it('keeps seconds', () => {
    expect(normalizeEpochSeconds('1751500000')).toEqual({ seconds: 1751500000, invalid: false });
  });

  it('converts milliseconds', () => {
    expect(normalizeEpochSeconds(1_751_500_000_000)).toEqual({
      seconds: 1751500000,
      invalid: false,
    });
  });

  it('converts microseconds', () => {
    expect(normalizeEpochSeconds(1_751_500_000_000_000)).toEqual({
      seconds: 1751500000,
      invalid: false,
    });
  });

  it('treats bucket boundaries as non-overlapping', () => {
    // 1e11 is the first millisecond value; 1e11-1 is still seconds.
    expect(normalizeEpochSeconds(1e11 - 1).seconds).toBe(Math.round(1e11 - 1));
    expect(normalizeEpochSeconds(1e11).seconds).toBe(1e8);
    expect(normalizeEpochSeconds(1e14).seconds).toBe(1e8);
  });
});

describe('normalizeEpochSeconds — absent vs invalid', () => {
  it('treats a missing attribute as absent, silently', () => {
    expect(normalizeEpochSeconds(null)).toEqual({ seconds: undefined, invalid: false });
    expect(normalizeEpochSeconds(undefined)).toEqual({ seconds: undefined, invalid: false });
    expect(normalizeEpochSeconds('')).toEqual({ seconds: undefined, invalid: false });
  });

  it('treats 0 as absent, silently — Chrome writes ADD_DATE="0" routinely', () => {
    expect(normalizeEpochSeconds('0')).toEqual({ seconds: undefined, invalid: false });
    expect(normalizeEpochSeconds(0)).toEqual({ seconds: undefined, invalid: false });
  });

  it('accepts dates Chrome accepts, down to 1 second past the epoch', () => {
    // A 1e8 floor would drop 1970-1973, which Chrome's own importer takes.
    expect(normalizeEpochSeconds(1).seconds).toBe(1);
    expect(normalizeEpochSeconds(86_400).seconds).toBe(86_400);
  });

  it('flags garbage as invalid so the caller can warn', () => {
    expect(normalizeEpochSeconds('not a number').invalid).toBe(true);
    expect(normalizeEpochSeconds(-5).invalid).toBe(true);
    expect(normalizeEpochSeconds(Number.NaN).invalid).toBe(true);
    expect(normalizeEpochSeconds(1e18).invalid).toBe(true);
  });
});

describe('millisToSeconds — the chrome.bookmarks adapter conversion', () => {
  it('divides by 1000 and rounds', () => {
    expect(millisToSeconds(1_751_500_000_499)).toBe(1751500000);
  });

  it('returns undefined for absent or unusable values', () => {
    expect(millisToSeconds(undefined)).toBeUndefined();
    expect(millisToSeconds(0)).toBeUndefined();
    expect(millisToSeconds(-1)).toBeUndefined();
  });
});
