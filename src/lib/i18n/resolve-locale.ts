/**
 * The shipped locales and how a browser language maps onto them — docs/07 §2.
 *
 * Pure, so it is unit-testable without the runes runtime.
 * Inputs: a browser UI language tag (`chrome.i18n.getUILanguage()`).
 * Guarantees: always returns a supported locale; never throws.
 */

/**
 * Every UI locale BookmarkMagic ships, in the order the language switcher
 * lists them — the single source of truth (docs/07 §2, §6).
 *
 * `as const` is right *here*: these are ids, not a dictionary (the ban in
 * docs/07 §2 is about dictionaries). Every table keyed by locale is a
 * `Record<Locale, …>`, so adding an id here and forgetting a table is a
 * compile error, not a silent fallback to English.
 */
export const LOCALES = ['en', 'vi', 'ja', 'zh-CN'] as const;

export type Locale = (typeof LOCALES)[number];

/** Regions whose Chinese is written in Traditional characters. */
const TRADITIONAL_REGIONS = new Set(['tw', 'hk', 'mo']);

/**
 * Map a browser UI language tag onto a supported locale (docs/07 §2).
 * Only whole subtags count: `vi`, `vi-VN` → vi; `ja`, `ja-JP` → ja; `vic` or
 * `jav` are other languages. Everything else falls back to English, the
 * default locale.
 */
export function resolveLocale(uiLanguage: string): Locale {
  const [language = '', ...subtags] = uiLanguage.toLowerCase().split(/[-_]/u);
  if (language === 'vi') return 'vi';
  if (language === 'ja') return 'ja';
  if (language === 'zh') return isTraditional(subtags) ? 'en' : 'zh-CN';
  return 'en';
}

/**
 * Traditional Chinese gets English, not Simplified (docs/07 §1–2): Chrome's
 * own manifest fallback goes `zh_TW → zh → en`, so mapping it to `zh-CN` here
 * would make the extension's name and its UI disagree. An explicit script
 * subtag wins over the region (`zh-Hans-HK` is Simplified).
 */
function isTraditional(subtags: readonly string[]): boolean {
  if (subtags.includes('hant')) return true;
  if (subtags.includes('hans')) return false;
  return subtags.some((subtag) => TRADITIONAL_REGIONS.has(subtag));
}
