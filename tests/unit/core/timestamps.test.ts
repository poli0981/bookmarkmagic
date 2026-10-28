import { describe, expect, it } from 'vitest';
import {
  chromeTimeToSeconds,
  microsToSeconds,
  millisToSeconds,
  normalizeEpochSeconds,
} from '@/lib/core/timestamps';

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

describe('normalizeEpochSeconds — never stores a zero date', () => {
  it('treats a value that rounds to 0 as absent, not as 0', () => {
    expect(normalizeEpochSeconds(0.4)).toEqual({ seconds: undefined, invalid: false });
    expect(normalizeEpochSeconds('0.2')).toEqual({ seconds: undefined, invalid: false });
  });
});

describe('chromeTimeToSeconds — profile Bookmarks file dates (docs/04 §2a)', () => {
  it('converts µs since 1601 held as a decimal string beyond 2^53', () => {
    // 13344473600000000 µs since 1601 = 1700000000 s since 1970.
    expect(chromeTimeToSeconds('13344473600000000')).toEqual({
      seconds: 1700000000,
      invalid: false,
    });
    expect(Number('13344473600000000') > Number.MAX_SAFE_INTEGER).toBe(true);
  });

  it("truncates, like Chrome's own HTML writer", () => {
    expect(chromeTimeToSeconds('13344473600999999').seconds).toBe(1700000000);
  });

  it('reads "0" and absence as no date, silently', () => {
    for (const raw of ['0', '', undefined, null, 0]) {
      expect(chromeTimeToSeconds(raw)).toEqual({ seconds: undefined, invalid: false });
    }
  });

  it('flags garbage and dates outside the representable range', () => {
    for (const raw of ['abc', '-5', '1.5e16', '12', '11644473600000000', '99999999999999999999']) {
      expect(chromeTimeToSeconds(raw).invalid, raw).toBe(true);
    }
  });

  it('tolerates a bare number where a string was expected', () => {
    // Past 2^53, so JSON.parse has already rounded it — by microseconds only.
    expect(chromeTimeToSeconds(13344473600000000).seconds).toBe(1700000000);
    expect(chromeTimeToSeconds(-1).invalid).toBe(true);
  });
});

describe('microsToSeconds — Firefox PRTime (docs/04 §2b)', () => {
  it('converts by unit, not by magnitude', () => {
    // 86400 s after the epoch is 8.64e10 µs — the magnitude buckets would read
    // that as SECONDS (it is under 1e11) and land in the year 4707.
    expect(microsToSeconds(86_400e6)).toEqual({ seconds: 86400, invalid: false });
    expect(microsToSeconds(1_700_000_000_999_999).seconds).toBe(1700000000);
  });

  it('reads 0 and absence as no date, and rejects nonsense', () => {
    expect(microsToSeconds(0)).toEqual({ seconds: undefined, invalid: false });
    expect(microsToSeconds(undefined)).toEqual({ seconds: undefined, invalid: false });
    expect(microsToSeconds(-1).invalid).toBe(true);
    expect(microsToSeconds('1700000000000000').invalid).toBe(true);
    expect(microsToSeconds(1e20).invalid).toBe(true);
  });
});
