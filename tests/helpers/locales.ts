import type { Locale } from '@/lib/i18n/resolve-locale';

/**
 * Runtime locale id → Chrome's locale code, as `src/public/_locales/` and
 * `store/listing.*.md` spell it (docs/07 §1). The one place the two spellings
 * meet: Chrome wants `zh_CN`, BCP 47 says `zh-CN`. A `Record`, so a new locale
 * without an entry fails to compile.
 */
export const CHROME_LOCALE_DIRS: Record<Locale, string> = {
  en: 'en',
  vi: 'vi',
  ja: 'ja',
  'zh-CN': 'zh_CN',
  ro: 'ro',
};
