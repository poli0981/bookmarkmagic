import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import en from '@/lib/i18n/locales/en';
import { LOCALES } from '@/lib/i18n/resolve-locale';
import { CHROME_LOCALE_DIRS } from '../../helpers/locales';

/**
 * The places outside `src/` that must name every shipped locale — docs/07 §6.
 *
 * Each is a plain file that cannot import `LOCALES` (an `.mjs` script, a YAML
 * form, Markdown), so forgetting one compiles fine and fails quietly: a
 * language the screenshot sweep never photographs, a build that ships without
 * its `_locales` entry checked, a translation form with no way to choose the
 * language, a store listing nobody wrote. Read as text, like manifest.test.ts.
 */

const ROOT = process.cwd();
const read = (path: string): string => readFileSync(join(ROOT, path), 'utf8');

describe('every shipped locale is wired up outside src/', () => {
  it('is photographed by the screenshot harness', () => {
    const langs = /const LANGS = \[([^\]]*)\]/u.exec(read('scripts/screenshots.mjs'))?.[1] ?? '';
    const listed = [...langs.matchAll(/'([^']+)'/gu)].map((match) => match[1]);
    expect(listed).toEqual([...LOCALES]);
  });

  it.each(LOCALES)('%s has its _locales file required by check-manifest', (locale) => {
    const dir = CHROME_LOCALE_DIRS[locale];
    expect(read('scripts/check-manifest.mjs')).toContain(`'_locales/${dir}/messages.json'`);
  });

  it.each(LOCALES.filter((locale) => locale !== 'en'))(
    '%s can be chosen in the translation issue form',
    (locale) => {
      expect(read('.github/ISSUE_TEMPLATE/translation.yml')).toContain(`(${locale})`);
    },
  );

  it.each(LOCALES)('%s has a store listing, indexed in store/README.md', (locale) => {
    const file = `listing.${CHROME_LOCALE_DIRS[locale]}.md`;
    expect(existsSync(join(ROOT, 'store', file)), file).toBe(true);
    expect(read('store/README.md')).toContain(`\`${file}\``);
  });

  it('lists the same languages in every store description and the README', () => {
    // The LANGUAGES paragraph is typed into each description by hand, so a
    // new locale means re-pasting all of them (docs/13 §4). Built from the
    // list, so a sixth locale fails every listing that does not name it.
    const line = LOCALES.map((locale) => en.settings.lang[locale]).join(' · ');
    for (const locale of LOCALES) {
      expect(read(`store/listing.${CHROME_LOCALE_DIRS[locale]}.md`), locale).toContain(line);
    }
    expect(read('README.md')).toContain(line);
  });
});
