import { describe, expect, it } from 'vitest';
import en from '@/lib/i18n/locales/en';
import ja from '@/lib/i18n/locales/ja';
import vi from '@/lib/i18n/locales/vi';

/**
 * Runtime companions to the `satisfies Dict` compile check (docs/07 §2).
 *
 * The compile check proves the *shape* matches. It is blind to what these
 * assert: interpolation tokens drifting between locales, empty leaves, and the
 * check itself being silently disabled by someone changing `satisfies` to `as`.
 */

type Node = { [key: string]: Node | string };

const LOCALES: [name: string, dict: Node][] = [
  ['vi', vi as Node],
  ['ja', ja as Node],
];

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

const english = flatten(en as Node);

describe('dictionary completeness', () => {
  it.each(LOCALES)('%s has exactly the same key paths as en', (_name, dict) => {
    expect([...flatten(dict).keys()].sort()).toEqual([...english.keys()].sort());
  });

  it.each(LOCALES)('%s uses the same interpolation tokens as en in every string', (_name, dict) => {
    // `satisfies Dict` cannot see this: a translation that drops {total} from
    // 'Importing… {done} / {total}' type-checks and renders a broken sentence.
    const drift: string[] = [];
    for (const [path, text] of flatten(dict)) {
      const expected = tokens(english.get(path) ?? '');
      const actual = tokens(text);
      if (actual.join('|') !== expected.join('|')) {
        drift.push(`${path}: expected {${expected.join('}, {')}}, got {${actual.join('}, {')}}`);
      }
    }
    expect(drift).toEqual([]);
  });

  it.each([['en', en as Node], ...LOCALES])('%s has no empty leaves', (_name, dict) => {
    const empty = [...flatten(dict)].filter(([, text]) => text.trim() === '').map(([path]) => path);
    expect(empty).toEqual([]);
  });

  it('carries every plural key as { one, other } in all three locales', () => {
    // docs/07 §5. VI/JA have one grammatical form and repeat the same string,
    // but they must still carry both keys or the `satisfies Dict` shape check
    // §2 relies on for completeness stops proving anything.
    const pluralPaths = [...branches(en as Node)]
      .filter(([, keys]) => keys.includes('one') && keys.includes('other'))
      .map(([path]) => path);

    expect(pluralPaths.length).toBeGreaterThan(0);
    for (const [name, dict] of LOCALES) {
      const leaves = flatten(dict);
      for (const path of pluralPaths) {
        expect(leaves.get(`${path}.one`), `${name}: ${path}.one`).toBeTypeOf('string');
        expect(leaves.get(`${path}.other`), `${name}: ${path}.other`).toBeTypeOf('string');
      }
    }
  });

  it('gives every plural key exactly the two forms, and no stray siblings', () => {
    const malformed = [...branches(en as Node)]
      .filter(([, keys]) => keys.includes('one') || keys.includes('other'))
      .filter(([, keys]) => keys.length !== 2)
      .map(([path]) => path);
    expect(malformed).toEqual([]);
  });
});
