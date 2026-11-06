import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BM_BACKUP_ERROR_CODES, BM_ENV_ERROR_CODES } from '@/lib/browser/errors';
import { BM_PARSE_ERROR_CODES, PARSE_WARNING_CODES } from '@/lib/core/model';
import { type LocaleTag, localeTag, PLURAL_FORMS, requiredPluralForms } from '@/lib/i18n/format';
import en, { type Dict } from '@/lib/i18n/locales/en';
import ja from '@/lib/i18n/locales/ja';
import ro from '@/lib/i18n/locales/ro';
import vi from '@/lib/i18n/locales/vi';
import zhCN from '@/lib/i18n/locales/zh-CN';
import { LOCALES, type Locale } from '@/lib/i18n/resolve-locale';

/**
 * Runtime companions to the `satisfies Dict` compile check (docs/07 §2, §5).
 *
 * The compile check proves the *shape* matches. It is blind to what these
 * assert: interpolation tokens drifting between locales, empty leaves, which
 * plural forms a locale's grammar needs, and the check itself being silently
 * disabled by someone changing `satisfies` to `as`.
 */

type Node = { [key: string]: Node | string };

/** Every non-English locale, with the tag its plural rules come from. */
const LOCALE_DICTS: [name: Locale, dict: Node][] = [
  ['vi', vi as Node],
  ['ja', ja as Node],
  ['zh-CN', zhCN as Node],
  ['ro', ro as Node],
];

const ALL: [name: Locale, dict: Node][] = [['en', en as Node], ...LOCALE_DICTS];

/** Every leaf as a dotted path → value. */
function flatten(node: Node, prefix = ''): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(node)) {
    const path = prefix === '' ? key : `${prefix}.${key}`;
    if (typeof value === 'string') out.set(path, value);
    else for (const [inner, text] of flatten(value, path)) out.set(inner, text);
  }
  return out;
}

/** `{token}` names, sorted, so two orderings of the same set compare equal. */
function tokens(text: string): string[] {
  return [...text.matchAll(/\{(\w+)\}/gu)].map((match) => match[1] ?? '').sort();
}

/** Every branch node as a dotted path → its own key names. */
function branches(node: Node, prefix = ''): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const [key, value] of Object.entries(node)) {
    if (typeof value === 'string') continue;
    const path = prefix === '' ? key : `${prefix}.${key}`;
    out.set(path, Object.keys(value));
    for (const [inner, keys] of branches(value, path)) out.set(inner, keys);
  }
  return out;
}

const FORM_KEYS = new Set<string>(PLURAL_FORMS);
const english = flatten(en as Node);
/** English's plural keys: every branch holding `one` and `other`. */
const PLURAL_PATHS = new Set(
  [...branches(en as Node)]
    .filter(([, keys]) => keys.includes('one') && keys.includes('other'))
    .map(([path]) => path),
);

/** `a.b.few` → `a.b` when `a.b` is a plural key, else undefined. */
function pluralParent(path: string): string | undefined {
  const cut = path.lastIndexOf('.');
  const parent = path.slice(0, cut);
  return cut > 0 && PLURAL_PATHS.has(parent) ? parent : undefined;
}

/** A `few` leaf has no English twin; it is compared against English `other`. */
function englishTwin(path: string): string | undefined {
  const parent = pluralParent(path);
  if (parent !== undefined && path.endsWith('.few')) return english.get(`${parent}.other`);
  return english.get(path);
}

const tagOf = (name: Locale): LocaleTag => localeTag(name);

describe('the locale list', () => {
  it('this suite checks every shipped locale', () => {
    // A locale added to LOCALES but not to LOCALE_DICTS would skip every check
    // below and still type-check (docs/07 §6).
    expect(ALL.map(([name]) => name).sort()).toEqual([...LOCALES].sort());
  });

  it('every shipped locale needs only plural forms the helper can select', () => {
    // docs/07 §5. selectPluralForm folds zero/two/many into `other`; a locale
    // that actually uses one of them (ar, pl, ru…) must fail here, before its
    // dictionary is written against a grammar the app cannot render.
    for (const name of LOCALES) {
      const categories = new Intl.PluralRules(tagOf(name)).resolvedOptions().pluralCategories;
      expect(
        categories.filter((category) => !FORM_KEYS.has(category)),
        name,
      ).toEqual([]);
    }
  });
});

describe('dictionary completeness', () => {
  it.each(LOCALE_DICTS)('%s has exactly the same key paths as en', (_name, dict) => {
    // `few` is the one leaf English has no twin for; the plural-shape test
    // below decides where it belongs.
    const paths = [...flatten(dict).keys()].filter(
      (path) => !(path.endsWith('.few') && pluralParent(path) !== undefined),
    );
    expect(paths.sort()).toEqual([...english.keys()].sort());
  });

  it.each(LOCALE_DICTS)(
    '%s uses the same interpolation tokens as en in every string',
    (_name, dict) => {
      // `satisfies Dict` cannot see this: a translation that drops {total} from
      // 'Importing… {done} / {total}' type-checks and renders a broken sentence.
      const drift: string[] = [];
      for (const [path, text] of flatten(dict)) {
        const expected = tokens(englishTwin(path) ?? '');
        const actual = tokens(text);
        if (actual.join('|') !== expected.join('|')) {
          drift.push(`${path}: expected {${expected.join('}, {')}}, got {${actual.join('}, {')}}`);
        }
      }
      expect(drift).toEqual([]);
    },
  );

  it.each(ALL)('%s has no empty leaves', (_name, dict) => {
    const empty = [...flatten(dict)].filter(([, text]) => text.trim() === '').map(([path]) => path);
    expect(empty).toEqual([]);
  });

  it('finds the plural keys at all', () => {
    expect(PLURAL_PATHS.size).toBeGreaterThan(0);
  });

  it.each(ALL)('%s carries exactly the plural forms its grammar needs', (name, dict) => {
    // docs/07 §5: `{ one, other }` everywhere, plus `few` where the locale's
    // own Intl.PluralRules uses it (Romanian). One-form locales repeat the
    // same string in both, but must still carry both or the `satisfies Dict`
    // shape check stops proving anything.
    const required = requiredPluralForms(tagOf(name)).sort();
    const shapes = branches(dict);
    const wrong = [...PLURAL_PATHS]
      .map((path) => [path, [...(shapes.get(path) ?? [])].sort()] as const)
      .filter(([, keys]) => keys.join('|') !== required.join('|'))
      .map(([path, keys]) => `${path}: {${keys.join(', ')}}`);
    expect(wrong).toEqual([]);
  });

  it.each(ALL)('%s names no non-plural key one, few or other', (_name, dict) => {
    // Any branch holding one of those keys is read as a plural — so a branch
    // that is not one of English's plural keys is malformed (docs/07 §5).
    const stray = [...branches(dict)]
      .filter(([, keys]) => keys.some((key) => FORM_KEYS.has(key)))
      .filter(([path]) => !PLURAL_PATHS.has(path))
      .map(([path]) => path);
    expect(stray).toEqual([]);
  });

  it('gives English exactly the two forms on every plural key', () => {
    const malformed = [...branches(en as Node)]
      .filter(([path]) => PLURAL_PATHS.has(path))
      .filter(([, keys]) => [...keys].sort().join('|') !== 'one|other')
      .map(([path]) => path);
    expect(malformed).toEqual([]);
  });

  it.each(LOCALE_DICTS)('%s writes the language names as endonyms, like en', (_name, dict) => {
    // docs/07 §5: identical in every dictionary, so a user can find their own
    // language whatever the UI is currently in.
    const names = [...flatten(dict)].filter(([path]) => path.startsWith('settings.lang.'));
    const englishNames = [...english].filter(([path]) => path.startsWith('settings.lang.'));
    expect(names.sort()).toEqual(englishNames.sort());
  });

  it('names every shipped locale in the language list', () => {
    expect(Object.keys(en.settings.lang).sort()).toEqual([...LOCALES].sort());
  });
});

describe('Romanian orthography', () => {
  // docs/07 §4: comma-below ș ț (U+0218–U+021B) are the letters; the cedilla
  // forms ş ţ (U+015E/F, U+0162/3) only look alike, and break search and sort.
  // Files, not the dictionary object, so comments and the manifest count too.
  const FILES = [
    'src/lib/i18n/locales/ro.ts',
    'src/lib/i18n/locales/ro-notices.ts',
    'src/lib/i18n/locales/ro-import.ts',
    'src/public/_locales/ro/messages.json',
  ];

  /** ş Ş ţ Ţ — by code point, so no formatter can turn them into look-alikes. */
  const CEDILLA = new Set([0x015e, 0x015f, 0x0162, 0x0163]);
  const isCommaBelow = (point: number): boolean => point >= 0x0218 && point <= 0x021b;

  it.each(FILES)('%s uses comma-below ș ț, never the cedilla forms', (file) => {
    const points = [...readFileSync(join(process.cwd(), file), 'utf8')].map(
      (char) => char.codePointAt(0) ?? 0,
    );
    expect(points.filter((point) => CEDILLA.has(point)).map((p) => p.toString(16))).toEqual([]);
    // Non-vacuous: the file really is Romanian text with these letters in it.
    expect(points.some(isCommaBelow)).toBe(true);
  });

  it('carries the "de" form only where Romanian grammar puts it', () => {
    // `other` (20+) takes "de"; `one` and `few` never do. A swapped pair reads
    // "5 de marcaje" / "20 marcaje" — both wrong, and both type-check.
    const leaves = flatten(ro as Node);
    const wrong: string[] = [];
    for (const path of PLURAL_PATHS) {
      for (const form of ['one', 'few'] as const) {
        if (/\{n\} de /u.test(leaves.get(`${path}.${form}`) ?? '')) wrong.push(`${path}.${form}`);
      }
      const other = leaves.get(`${path}.other`) ?? '';
      if (/\{n\} (?!de )\p{L}/u.test(other) && !/\{n\} de /u.test(other))
        wrong.push(`${path}.other`);
    }
    expect(wrong).toEqual([]);
  });
});

describe('the Dict type', () => {
  it('accepts a third plural form and nothing else', () => {
    // Type-level: these lines are the test; tsc runs over this file.
    const romanianStyle = { one: 'a', few: 'b', other: 'c' } satisfies Dict['popup']['bookmarks'];
    // @ts-expect-error — `other` is required in every locale.
    const missingOther = { one: 'a' } satisfies Dict['popup']['bookmarks'];
    // @ts-expect-error — `many` is not a form any shipped locale carries.
    const strayForm = { one: 'a', other: 'b', many: 'c' } satisfies Dict['popup']['bookmarks'];
    // @ts-expect-error — a plain string leaf takes no plural forms.
    const notPlural = { one: 'a', other: 'b' } satisfies Dict['common']['import'];
    expect([romanianStyle, missingOther, strayForm, notPlural]).toHaveLength(4);
  });
});

describe('every code the core can emit has a message', () => {
  // A code with no key renders as its own dotted path ("warnings.INVALID_URL")
  // in the preview. The union types cannot catch that; this can.
  it.each(ALL)('%s has a plural message for every ParseWarningCode', (_name, dict) => {
    const leaves = flatten(dict);
    for (const code of PARSE_WARNING_CODES) {
      expect(leaves.get(`warnings.${code}.one`), code).toBeTypeOf('string');
      expect(leaves.get(`warnings.${code}.other`), code).toBeTypeOf('string');
    }
  });

  it.each(ALL)('%s has a message for every error code describeError can produce', (_name, dict) => {
    const leaves = flatten(dict);
    // describeError also maps these four fixed keys (browser/describe-error.ts).
    const fixed = ['BROWSER', 'PARTIAL_WRITE', 'PARTIAL_CLEAR', 'UNKNOWN'];
    for (const code of [
      ...BM_PARSE_ERROR_CODES,
      ...BM_BACKUP_ERROR_CODES,
      ...BM_ENV_ERROR_CODES,
      ...fixed,
    ]) {
      expect(leaves.get(`errors.${code}`), code).toBeTypeOf('string');
    }
  });
});
