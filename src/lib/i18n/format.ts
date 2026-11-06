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
export type LocaleTag = 'en-US' | 'vi-VN' | 'ja-JP' | 'zh-CN' | 'ro-RO';

/** A `Record`, so a new locale without a tag fails to compile (docs/07 §6). */
const TAGS: Record<Locale, LocaleTag> = {
  en: 'en-US',
  vi: 'vi-VN',
  ja: 'ja-JP',
  'zh-CN': 'zh-CN',
  ro: 'ro-RO',
};

// Constructing an Intl formatter is expensive relative to a render, and
// StatsCard alone formats four counts per paint — so cache per tag.
const numberFormats = new Map<LocaleTag, Intl.NumberFormat>();
const dateFormats = new Map<LocaleTag, Intl.DateTimeFormat>();
const pluralRules = new Map<LocaleTag, Intl.PluralRules>();

/**
 * The plural forms a dictionary may carry (docs/07 §5): every locale has `one`
 * and `other`; a locale whose rules use `few` (Romanian) carries that too.
 */
export type PluralForm = 'one' | 'few' | 'other';

/** The CLDR categories `PluralForm` can represent — the guard test's bound. */
export const PLURAL_FORMS: readonly PluralForm[] = ['one', 'few', 'other'];

function rulesFor(tag: LocaleTag): Intl.PluralRules {
  let rules = pluralRules.get(tag);
  if (rules === undefined) {
    rules = new Intl.PluralRules(tag);
    pluralRules.set(tag, rules);
  }
  return rules;
}

/**
 * Pick a plural form for a count.
 *
 * Narrowed to `one`/`few`/`other`: `Intl.PluralRules` can also return `zero`,
 * `two` and `many`, which fold into `other`. No shipped locale produces them —
 * `dictionaries.test.ts` fails if one ever does, before a grammar this cannot
 * select reaches a user.
 */
export function selectPluralForm(count: number, tag: LocaleTag): PluralForm {
  const category = rulesFor(tag).select(count);
  return category === 'one' || category === 'few' ? category : 'other';
}

/** The forms a locale's plural keys must carry: `one`, `other`, plus any it uses. */
export function requiredPluralForms(tag: LocaleTag): PluralForm[] {
  const used = new Set<string>(rulesFor(tag).resolvedOptions().pluralCategories);
  return PLURAL_FORMS.filter((form) => form !== 'few' || used.has(form));
}

export function localeTag(locale: Locale): LocaleTag {
  return TAGS[locale];
}

/** Group a count for display — VI and RO use `.` thousands, EN, JA and ZH `,`. */
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
