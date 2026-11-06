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
export const LOCALES = ['en', 'vi', 'ja'] as const;

export type Locale = (typeof LOCALES)[number];

/**
 * Map a browser UI language tag onto a supported locale (docs/07 §2).
 * Only whole subtags count: `vi`, `vi-VN` → vi; `ja`, `ja-JP` → ja; `vic` or
 * `jav` are other languages. Everything else falls back to English, the
 * default locale.
 */
export function resolveLocale(uiLanguage: string): Locale {
  const [language = ''] = uiLanguage.toLowerCase().split(/[-_]/u);
  if (language === 'vi') return 'vi';
  if (language === 'ja') return 'ja';
  return 'en';
}
