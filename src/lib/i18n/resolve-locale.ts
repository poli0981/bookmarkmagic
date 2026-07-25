/**
 * Locale resolution — pure, so it is unit-testable without the runes runtime.
 *
 * Inputs: a browser UI language tag (`chrome.i18n.getUILanguage()`).
 * Guarantees: always returns a supported locale; never throws.
 */
export type Locale = 'en' | 'vi' | 'ja';

/**
 * Map a browser UI language tag onto a supported locale (docs/07 §2).
 * Only the primary subtag matters: `vi`, `vi-VN` → vi; `ja`, `ja-JP` → ja;
 * everything else falls back to English, the default locale.
 */
export function resolveLocale(uiLanguage: string): Locale {
  const tag = uiLanguage.toLowerCase();
  if (tag === 'vi' || tag.startsWith('vi-')) return 'vi';
  if (tag === 'ja' || tag.startsWith('ja-')) return 'ja';
  return 'en';
}
