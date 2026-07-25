import { describe, expect, it } from 'vitest';
import { resolveLocale } from '@/lib/i18n/resolve-locale';

describe('resolveLocale', () => {
  it('maps Vietnamese tags to vi', () => {
    expect(resolveLocale('vi')).toBe('vi');
    expect(resolveLocale('vi-VN')).toBe('vi');
    expect(resolveLocale('VI-vn')).toBe('vi');
  });

  it('maps Japanese tags to ja', () => {
    expect(resolveLocale('ja')).toBe('ja');
    expect(resolveLocale('ja-JP')).toBe('ja');
  });

  it('falls back to en for anything else', () => {
    expect(resolveLocale('en-US')).toBe('en');
    expect(resolveLocale('de')).toBe('en');
    expect(resolveLocale('')).toBe('en');
  });

  it('does not match on a shared prefix that is a different language', () => {
    // 'vic' / 'jav' (Javanese) start with vi/ja but are not our locales.
    expect(resolveLocale('jav')).toBe('en');
    expect(resolveLocale('vic')).toBe('en');
  });
});
