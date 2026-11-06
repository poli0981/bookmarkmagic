import { formatCount, formatDateTime, localeTag, selectPluralForm } from './format';
import en, { type Dict } from './locales/en';
import ja from './locales/ja';
import ro from './locales/ro';
import vi from './locales/vi';
import zhCN from './locales/zh-CN';
import type { Locale } from './resolve-locale';

/**
 * Runtime UI i18n (docs/07 §2).
 *
 * chrome.i18n always follows the browser UI language and cannot be switched at
 * runtime, so every in-app string resolves through this store instead. The
 * dictionaries are static imports, never loaded over the network — network
 * calls are banned repo-wide (docs/08 §3), and bundling a few small dicts costs
 * nothing at our size.
 *
 * A `Record<Locale, Dict>`, so a locale added to `LOCALES` without a dictionary
 * is a compile error here rather than an English UI at runtime.
 */
const dicts: Record<Locale, Dict> = { en, vi, ja, 'zh-CN': zhCN, ro };

let locale = $state<Locale>('en');

export function setLocale(next: Locale): void {
  locale = next;
}

/**
 * The *resolved* locale — always one of `LOCALES`, never `'auto'`.
 *
 * Not to be confused with `getSettings().locale`, the *preference*, which also
 * carries `'auto'`. Language controls must bind to the preference — binding to
 * this makes choosing "Automatic" instantly snap the control to "English".
 */
export function getLocale(): Locale {
  return locale;
}

/** Group a count for the current locale (docs/07 §3). Reactive. */
export function num(value: number): string {
  return formatCount(value, localeTag(locale));
}

/** Format an ISO instant for the current locale, or `undefined` if unparseable. */
export function dateTime(iso: string): string | undefined {
  return formatDateTime(iso, localeTag(locale));
}

/**
 * Resolve a dotted key path, falling back to English, then to the key itself.
 * Interpolation is `{token}` replacement only — never concatenate sentence
 * fragments, or word order breaks in other languages (docs/07 §2).
 */
export function t(path: string, params?: Record<string, string | number>): string {
  const raw = lookup(dicts[locale], path) ?? lookup(dicts.en, path) ?? path;
  return interpolate(raw, params);
}

/**
 * Resolve a plural key — an object of `{ one, other }`, plus `few` in a locale
 * that uses it (Romanian), per docs/07 §5.
 *
 * `{n}` is supplied automatically, already grouped for the locale, so callers
 * pass the raw count and never have to format it themselves. One-form locales
 * (vi, ja, zh) carry `one` and `other` with the same text, which is what keeps
 * the `satisfies Dict` shape check meaningful.
 */
export function tPlural(
  path: string,
  count: number,
  params?: Record<string, string | number>,
): string {
  const form = selectPluralForm(count, localeTag(locale));
  const raw =
    lookup(dicts[locale], `${path}.${form}`) ??
    lookup(dicts[locale], `${path}.other`) ??
    lookup(dicts.en, `${path}.${form}`) ??
    lookup(dicts.en, `${path}.other`) ??
    path;
  return interpolate(raw, { n: num(count), ...params });
}

function interpolate(raw: string, params?: Record<string, string | number>): string {
  if (params === undefined) return raw;
  return raw.replace(/\{(\w+)\}/g, (match, token: string) =>
    Object.hasOwn(params, token) ? String(params[token]) : match,
  );
}

function lookup(dict: unknown, path: string): string | undefined {
  let node: unknown = dict;
  for (const key of path.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined;
    node = (node as Record<string, unknown>)[key];
  }
  return typeof node === 'string' ? node : undefined;
}
