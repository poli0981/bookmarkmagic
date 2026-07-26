import { afterEach, describe, expect, it } from 'vitest';
import { formatCount, formatDateTime, localeTag, selectPluralForm } from '@/lib/i18n/format';
import { dateTime, getLocale, num, setLocale, tPlural } from '@/lib/i18n/index.svelte';

afterEach(() => {
  setLocale('en');
});

describe('localeTag', () => {
  it('maps each locale onto the BCP 47 tag docs/07 §3 pins', () => {
    expect(localeTag('en')).toBe('en-US');
    expect(localeTag('vi')).toBe('vi-VN');
    expect(localeTag('ja')).toBe('ja-JP');
  });
});

describe('formatCount', () => {
  it('groups thousands for English', () => {
    expect(formatCount(1_234_567, 'en-US')).toBe('1,234,567');
  });

  it('groups thousands for vi/ja with a locale-appropriate separator', () => {
    // Asserted structurally rather than glyph-for-glyph: ICU separator data can
    // shift between Node releases, and a brittle assertion here would block an
    // unrelated Node bump for no real gain.
    expect(formatCount(1_234_567, 'vi-VN')).toMatch(/^1\D234\D567$/u);
    expect(formatCount(1_234_567, 'ja-JP')).toMatch(/^1\D234\D567$/u);
    expect(formatCount(1_234_567, 'vi-VN')).not.toBe(formatCount(1_234_567, 'en-US'));
  });

  it('keeps the cache keyed by tag — interleaved calls do not bleed', () => {
    const en = formatCount(1_000, 'en-US');
    const vi = formatCount(1_000, 'vi-VN');
    expect(formatCount(1_000, 'en-US')).toBe(en);
    expect(formatCount(1_000, 'vi-VN')).toBe(vi);
    expect(en).not.toBe(vi);
  });

  it('leaves small numbers alone in every locale', () => {
    expect(formatCount(0, 'en-US')).toBe('0');
    expect(formatCount(42, 'ja-JP')).toBe('42');
  });
});

describe('formatDateTime', () => {
  it('renders a valid instant, differently per locale', () => {
    const en = formatDateTime('2026-07-25T10:00:00.000Z', 'en-US');
    const ja = formatDateTime('2026-07-25T10:00:00.000Z', 'ja-JP');
    // Not an exact string: output is timezone-dependent and the suite does not
    // pin TZ (doing so would change every existing date test's environment).
    expect(en).toContain('2026');
    expect(ja).toContain('2026');
    expect(en).not.toBe(ja);
  });

  it('returns undefined instead of throwing on an unparseable date', () => {
    // readLegal coerces a missing acceptedAt to '' (browser/storage.ts), and
    // Intl.format(new Date('')) throws RangeError *inside a render*, which
    // would blank the About tab. This is the guard against that.
    expect(formatDateTime('', 'en-US')).toBeUndefined();
    expect(formatDateTime('not-a-date', 'en-US')).toBeUndefined();
    expect(() => formatDateTime('', 'ja-JP')).not.toThrow();
  });
});

describe('selectPluralForm', () => {
  it('distinguishes one from other in English', () => {
    expect(selectPluralForm(1, 'en-US')).toBe('one');
    expect(selectPluralForm(0, 'en-US')).toBe('other');
    expect(selectPluralForm(2, 'en-US')).toBe('other');
  });

  it('always returns other for vi and ja, which have one grammatical form', () => {
    for (const count of [0, 1, 2, 100]) {
      expect(selectPluralForm(count, 'vi-VN')).toBe('other');
      expect(selectPluralForm(count, 'ja-JP')).toBe('other');
    }
  });
});

describe('tPlural', () => {
  it('picks the singular form and supplies a formatted {n}', () => {
    setLocale('en');
    expect(tPlural('warnings.INVALID_DATE', 1)).toBe('1 unreadable date was left blank.');
  });

  it('picks the plural form and groups the count', () => {
    setLocale('en');
    expect(tPlural('warnings.INVALID_DATE', 1234)).toBe('1,234 unreadable dates were left blank.');
  });

  it('resolves in vi and ja without falling back to English', () => {
    for (const locale of ['vi', 'ja'] as const) {
      setLocale(locale);
      const text = tPlural('warnings.INVALID_DATE', 3);
      expect(text).not.toBe('warnings.INVALID_DATE');
      expect(text).not.toContain('unreadable');
      expect(text).toContain('3');
    }
  });

  it('returns the path itself for an unknown key rather than throwing', () => {
    setLocale('en');
    expect(tPlural('warnings.NOT_A_REAL_CODE', 2)).toBe('warnings.NOT_A_REAL_CODE');
  });
});

describe('reactive wrappers', () => {
  it('getLocale() reports the resolved locale, not the stored preference', () => {
    // The preference (getSettings().locale) also carries 'auto'; this never
    // does. Language controls must bind to the preference, not to this.
    setLocale('ja');
    expect(getLocale()).toBe('ja');
  });

  it('num() follows setLocale', () => {
    setLocale('vi');
    expect(num(1_234_567)).toBe(formatCount(1_234_567, 'vi-VN'));
    setLocale('en');
    expect(num(1_234_567)).toBe('1,234,567');
  });

  it('dateTime() follows setLocale and propagates the undefined guard', () => {
    setLocale('ja');
    expect(dateTime('2026-07-25T10:00:00.000Z')).toBe(
      formatDateTime('2026-07-25T10:00:00.000Z', 'ja-JP'),
    );
    expect(dateTime('')).toBeUndefined();
  });
});
