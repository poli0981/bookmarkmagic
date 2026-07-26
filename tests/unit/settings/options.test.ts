import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '@/lib/browser/storage';
import { setLocale, t } from '@/lib/i18n/index.svelte';
import type { Locale } from '@/lib/i18n/resolve-locale';
import {
  CSV_DELIMITER_CHOICES,
  EXPORT_FORMAT_CHOICES,
  IMPORT_MODE_CHOICES,
  LOCALE_CHOICES,
  MARKDOWN_STYLE_CHOICES,
  parseChoice,
  type SettingChoice,
  THEME_CHOICES,
} from '@/lib/settings/options';

const TABLES: [name: string, choices: readonly SettingChoice<string>[]][] = [
  ['LOCALE_CHOICES', LOCALE_CHOICES],
  ['THEME_CHOICES', THEME_CHOICES],
  ['EXPORT_FORMAT_CHOICES', EXPORT_FORMAT_CHOICES],
  ['IMPORT_MODE_CHOICES', IMPORT_MODE_CHOICES],
  ['CSV_DELIMITER_CHOICES', CSV_DELIMITER_CHOICES],
  ['MARKDOWN_STYLE_CHOICES', MARKDOWN_STYLE_CHOICES],
];

const LOCALES: Locale[] = ['en', 'vi', 'ja'];

afterEach(() => {
  setLocale('en');
});

describe('choice labels', () => {
  it.each(TABLES)('%s resolves every labelKey in all three locales', (_name, choices) => {
    // t() falls back to the key path on a miss, so a typo renders as literal
    // "settings.markdownStyle" in the UI and nothing else would catch it.
    const missing: string[] = [];
    for (const locale of LOCALES) {
      setLocale(locale);
      for (const choice of choices) {
        if (t(choice.labelKey) === choice.labelKey) missing.push(`${locale}: ${choice.labelKey}`);
      }
    }
    expect(missing).toEqual([]);
  });
});

describe('choice values match the storage allow-lists', () => {
  // coerceSettings in browser/storage.ts is the gatekeeper for what can be
  // persisted. If a value can be stored but has no row, it is unreachable; if a
  // row offers a value coerceSettings rejects, choosing it silently does
  // nothing. Both are caught here.
  it.each([
    ['locale', LOCALE_CHOICES, ['auto', 'en', 'vi', 'ja']],
    ['theme', THEME_CHOICES, ['system', 'light', 'dark']],
    ['defaultExportFormat', EXPORT_FORMAT_CHOICES, ['netscape-html', 'bm-json', 'csv', 'markdown']],
    ['defaultMergeMode', IMPORT_MODE_CHOICES, ['new-folder', 'merge', 'replace']],
    ['csvDelimiter', CSV_DELIMITER_CHOICES, [',', ';']],
    ['markdownStyle', MARKDOWN_STYLE_CHOICES, ['nested', 'flat']],
  ] as [string, readonly SettingChoice<string>[], string[]][])('%s', (_key, choices, allowed) => {
    expect(choices.map((choice) => choice.value).sort()).toEqual([...allowed].sort());
  });

  it('offers a row for every field the default settings carry', () => {
    // Six persisted fields, six rows (docs/06 §3.4 as amended in Phase 4).
    expect(Object.keys(DEFAULT_SETTINGS).sort()).toEqual([
      'csvDelimiter',
      'defaultExportFormat',
      'defaultMergeMode',
      'locale',
      'markdownStyle',
      'theme',
    ]);
  });
});

describe('parseChoice', () => {
  it('returns the narrowed value for a known option', () => {
    expect(parseChoice('dark', THEME_CHOICES)).toBe('dark');
    expect(parseChoice(';', CSV_DELIMITER_CHOICES)).toBe(';');
  });

  it('returns undefined for anything not in the table', () => {
    expect(parseChoice('klingon', LOCALE_CHOICES)).toBeUndefined();
    expect(parseChoice('', CSV_DELIMITER_CHOICES)).toBeUndefined();
    expect(parseChoice('DARK', MARKDOWN_STYLE_CHOICES)).toBeUndefined();
  });
});
