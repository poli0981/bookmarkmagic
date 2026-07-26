/**
 * The choices each Settings row offers — docs/06 §3.4.
 *
 * Purpose: keep the six option tables out of the component so they can be
 *   asserted against the storage allow-lists, and give `<select>` handlers a
 *   way to narrow a raw string without an unexplained cast.
 * Inputs: none — static tables plus one pure narrowing helper.
 * Guarantees: pure. Lives in `settings/` rather than `core/` because it takes
 *   its types from `browser/storage.ts`, which `core/` may not touch
 *   (docs/02 §3 rule 1).
 */
import type { ExportFormat, ImportMode, ThemePreference } from '../browser/storage';
import type { CsvDelimiter } from '../core/serialize/csv';
import type { MarkdownStyle } from '../core/serialize/markdown';
import type { Locale } from '../i18n/resolve-locale';

export interface SettingChoice<T extends string> {
  value: T;
  /** Dotted i18n path — resolved at render time so it follows the locale. */
  labelKey: string;
}

/** `'auto'` is a first-class option: it is what `DEFAULT_SETTINGS.locale` is. */
export const LOCALE_CHOICES: readonly SettingChoice<Locale | 'auto'>[] = [
  { value: 'auto', labelKey: 'settings.localeAuto' },
  { value: 'en', labelKey: 'settings.lang.en' },
  { value: 'vi', labelKey: 'settings.lang.vi' },
  { value: 'ja', labelKey: 'settings.lang.ja' },
];

export const THEME_CHOICES: readonly SettingChoice<ThemePreference>[] = [
  { value: 'system', labelKey: 'settings.themes.system' },
  { value: 'light', labelKey: 'settings.themes.light' },
  { value: 'dark', labelKey: 'settings.themes.dark' },
];

// The next four reuse the Export/Import tabs' own keys rather than inventing
// parallel wording. That is ~14 keys × 3 locales not written, and it makes it
// impossible for #settings and #export to describe the same choice differently.
export const EXPORT_FORMAT_CHOICES: readonly SettingChoice<ExportFormat>[] = [
  { value: 'netscape-html', labelKey: 'export.formats.netscape-html.name' },
  { value: 'bm-json', labelKey: 'export.formats.bm-json.name' },
  { value: 'csv', labelKey: 'export.formats.csv.name' },
  { value: 'markdown', labelKey: 'export.formats.markdown.name' },
];

export const IMPORT_MODE_CHOICES: readonly SettingChoice<ImportMode>[] = [
  { value: 'new-folder', labelKey: 'import.mode.newFolder' },
  { value: 'merge', labelKey: 'import.mode.merge' },
  { value: 'replace', labelKey: 'import.mode.replace' },
];

export const CSV_DELIMITER_CHOICES: readonly SettingChoice<CsvDelimiter>[] = [
  { value: ',', labelKey: 'export.comma' },
  { value: ';', labelKey: 'export.semicolon' },
];

export const MARKDOWN_STYLE_CHOICES: readonly SettingChoice<MarkdownStyle>[] = [
  { value: 'nested', labelKey: 'export.nested' },
  { value: 'flat', labelKey: 'export.flat' },
];

/**
 * Narrow a raw control value against a choice table.
 *
 * Exists so `<select>` handlers never need `as SomeUnion`, which docs/10 §2
 * would require a `// SAFETY:` comment for. Returns `undefined` for anything
 * not in the table; callers must bail before building a settings patch, since
 * `exactOptionalPropertyTypes` rejects an explicit `undefined` in the patch.
 */
export function parseChoice<T extends string>(
  raw: string,
  choices: readonly SettingChoice<T>[],
): T | undefined {
  return choices.find((choice) => choice.value === raw)?.value;
}
