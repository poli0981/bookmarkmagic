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

  it('accepts the underscore spelling Chrome uses for _locales directories', () => {
    expect(resolveLocale('vi_VN')).toBe('vi');
    expect(resolveLocale('zh_CN')).toBe('zh-CN');
  });

  it('maps Simplified Chinese tags to zh-CN', () => {
    for (const tag of ['zh', 'zh-CN', 'zh-cn', 'zh-SG', 'zh-Hans', 'zh-Hans-CN', 'zh-Hans-HK']) {
      expect(resolveLocale(tag), tag).toBe('zh-CN');
    }
  });

  it('maps Romanian tags to ro', () => {
    for (const tag of ['ro', 'ro-RO', 'ro-MD', 'RO_ro']) {
      expect(resolveLocale(tag), tag).toBe('ro');
    }
  });

  it('gives Traditional Chinese English, as Chrome’s manifest fallback does (docs/07 §1)', () => {
    for (const tag of ['zh-TW', 'zh-HK', 'zh-MO', 'zh-Hant', 'zh-Hant-TW', 'zh_TW']) {
      expect(resolveLocale(tag), tag).toBe('en');
    }
  });

  it('lets an explicit script win over the region, and ignores extension subtags', () => {
    expect(resolveLocale('zh-Hans-TW')).toBe('zh-CN');
    expect(resolveLocale('zh-Hant-CN')).toBe('en');
    expect(resolveLocale('zh-MY')).toBe('zh-CN');
    expect(resolveLocale('zh-u-nu-hant')).toBe('zh-CN');
    expect(resolveLocale('zh-CN-x-hant')).toBe('zh-CN');
    expect(resolveLocale('zh-TW-u-ca-roc')).toBe('en');
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
    expect(resolveLocale('zha')).toBe('en');
    expect(resolveLocale('rom')).toBe('en');
  });
});
