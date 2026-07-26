/**
 * Locale-aware number and date formatting — docs/07 §3.
 *
 * Purpose: the single place `Intl` is constructed, so every rendered count and
 *   timestamp follows the UI language rather than the browser's.
 * Inputs: a resolved `Locale`, plus raw numbers / ISO 8601 strings.
 * Guarantees: pure (no Svelte, no `chrome.*`), never throws — an unparseable
 *   date returns `undefined` rather than blowing up mid-render.
 */
import type { Locale } from './resolve-locale';

/** BCP 47 tags docs/07 §3 pins per locale. */
export type LocaleTag = 'en-US' | 'vi-VN' | 'ja-JP';

const TAGS: Record<Locale, LocaleTag> = {
  en: 'en-US',
  vi: 'vi-VN',
  ja: 'ja-JP',
};

// Constructing an Intl formatter is expensive relative to a render, and
// StatsCard alone formats four counts per paint — so cache per tag.
const numberFormats = new Map<LocaleTag, Intl.NumberFormat>();
const dateFormats = new Map<LocaleTag, Intl.DateTimeFormat>();
const pluralRules = new Map<LocaleTag, Intl.PluralRules>();

/** The two forms docs/07 §5 requires every plural key to carry. */
export type PluralForm = 'one' | 'other';

/**
 * Pick a plural form for a count.
 *
 * Narrowed to `one`/`other` deliberately: `Intl.PluralRules` can return `zero`,
 * `two`, `few` and `many` for other languages, but en yields only one/other and
 * vi/ja only ever yield other — so the two-form dictionaries docs/07 §5
 * specifies are sufficient for exactly the locales we ship.
 */
export function selectPluralForm(count: number, tag: LocaleTag): PluralForm {
  let rules = pluralRules.get(tag);
  if (rules === undefined) {
    rules = new Intl.PluralRules(tag);
    pluralRules.set(tag, rules);
  }
  return rules.select(count) === 'one' ? 'one' : 'other';
}

export function localeTag(locale: Locale): LocaleTag {
  return TAGS[locale];
}

/** Group a count for display — VI uses `.` thousands, EN `,`, JA `,`. */
export function formatCount(value: number, tag: LocaleTag): string {
  let format = numberFormats.get(tag);
  if (format === undefined) {
    format = new Intl.NumberFormat(tag);
    numberFormats.set(tag, format);
  }
  return format.format(value);
}

/**
 * Format an ISO 8601 instant for display.
 *
 * Returns `undefined` — not a fallback string — when the input is unparseable.
 * That is load-bearing: `readLegal` deliberately coerces a missing `acceptedAt`
 * to `''` (browser/storage.ts), and `Intl.format(new Date(''))` throws a
 * RangeError *inside a render*, which would blank the whole About tab. Forcing
 * the caller to branch is the point.
 */
export function formatDateTime(iso: string, tag: LocaleTag): string | undefined {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return undefined;

  let format = dateFormats.get(tag);
  if (format === undefined) {
    format = new Intl.DateTimeFormat(tag, { dateStyle: 'medium', timeStyle: 'short' });
    dateFormats.set(tag, format);
  }
  return format.format(date);
}
