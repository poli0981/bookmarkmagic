// @ts-check
/**
 * Licence gate — docs/09 §3.2, docs/12 §2.1.
 *
 * Reads `package-lock.json` (lockfile v3), where npm records each installed
 * package's `license` field, and checks every entry against one of two lists:
 *
 *  - SHIPPED — the packages the build compiles into the extension
 *    (`CREDITED_PACKAGES`, scripts/credited-packages.mjs). Their code travels
 *    inside a GPL-3.0-or-later extension, so only permissive licences that
 *    combine with it cleanly are accepted.
 *  - TOOLCHAIN — everything else. The extension has no runtime dependencies,
 *    so all of these are build and test tools that never ship. Permissive
 *    licences and weak, file-level copyleft (MPL-2.0) are fine; network
 *    copyleft (AGPL), source-available terms (SSPL, BUSL, Commons Clause),
 *    a missing or custom licence (`UNLICENSED`, `SEE LICENSE IN …`) are not.
 *
 * Anything outside the lists fails the run until a person looks at it — the
 * point is that a new licence enters the tree through a reviewed change to
 * this file, never unnoticed through a Dependabot bump. `EXCEPTIONS` is that
 * reviewed change for one package, with its reason.
 *
 * The `license` value is self-declared by each package and copied verbatim by
 * npm; this gate trusts it, as every lockfile-based checker must. It needs no
 * `node_modules` and no network, so it runs before anything is installed.
 *
 * Usage: node scripts/check-licenses.mjs — reads <repo>/package-lock.json and
 * <repo>/tools/publish/package-lock.json (the store-upload tool, docs/12 §3),
 * resolved from this file. Its tests call `checkLockfile(lock)` directly.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CREDITED_PACKAGES } from './credited-packages.mjs';

/** Permissive licences that may ship inside a GPL-3.0-or-later extension. */
export const SHIPPED_LICENSES = Object.freeze([
  '0BSD',
  'Apache-2.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'ISC',
  'MIT',
  'MIT-0',
]);

/** Licences accepted for build and test tooling, which never ships. */
export const TOOLCHAIN_LICENSES = Object.freeze([
  ...SHIPPED_LICENSES,
  'BlueOak-1.0.0',
  'CC-BY-4.0',
  'CC0-1.0',
  'MPL-2.0',
  'Python-2.0',
  'Unlicense',
  'Zlib',
]);

/**
 * Packages accepted despite the lists above: `name → reason`. Empty on
 * purpose; an entry is a decision, recorded in docs/15's decision log.
 * @type {Readonly<Record<string, string>>}
 */
export const EXCEPTIONS = Object.freeze({});

/**
 * Whether an SPDX licence expression is satisfied by the allowed identifiers.
 * `A OR B` needs either side, `A AND B` both; parentheses group; `A WITH X`
 * (a licence exception) is judged by `A`. Anything unparseable is refused.
 *
 * @param {string} expression
 * @param {readonly string[]} allowed
 * @returns {boolean}
 */
export function satisfies(expression, allowed) {
  const tokens = expression.match(/\(|\)|[^\s()]+/g) ?? [];
  let at = 0;

  /** @returns {boolean} */
  const parseOr = () => {
    let ok = parseAnd();
    while (tokens[at] === 'OR') {
      at++;
      const right = parseAnd();
      ok = ok || right;
    }
    return ok;
  };
  /** @returns {boolean} */
  const parseAnd = () => {
    let ok = parseTerm();
    while (tokens[at] === 'AND') {
      at++;
      const right = parseTerm();
      ok = ok && right;
    }
    return ok;
  };
  /** @returns {boolean} */
  const parseTerm = () => {
    const token = tokens[at++];
    if (token === '(') {
      const ok = parseOr();
      if (tokens[at++] !== ')') throw new SyntaxError('unbalanced parentheses');
      return ok;
    }
    if (token === undefined || token === ')' || token === 'AND' || token === 'OR') {
      throw new SyntaxError('expected a licence identifier');
    }
    if (tokens[at] === 'WITH') at += 2;
    return allowed.includes(token);
  };

  try {
    const ok = parseOr();
    return at === tokens.length && tokens.length > 0 && ok;
  } catch {
    return false;
  }
}

/**
 * The package name a lockfile key installs: the part after the last
 * `node_modules/`, scope included.
 * @param {string} key
 */
export function packageNameOf(key) {
  const at = key.lastIndexOf('node_modules/');
  return at === -1 ? key : key.slice(at + 'node_modules/'.length);
}

/**
 * Lockfile text is our own committed file, but it is still file content: keep
 * what reaches the log to the characters package names and SPDX ids use.
 * @param {unknown} value
 */
function printable(value) {
  return String(value)
    .replaceAll(/[^\w@/.+() -]/g, '?')
    .slice(0, 120);
}

/**
 * Check every installed package of a v2/v3 lockfile.
 *
 * @param {unknown} lock - the parsed `package-lock.json`
 * @param {{ shipsCode?: boolean }} [options] - `shipsCode: false` for a lockfile
 *   that builds nothing into the extension (tools/publish), where the credited
 *   packages are not expected
 * @returns {{ problems: string[], checked: number, counts: Map<string, number> }}
 */
export function checkLockfile(lock, options = {}) {
  const shipsCode = options.shipsCode ?? true;
  /** @type {string[]} */
  const problems = [];
  /** @type {Map<string, number>} */
  const counts = new Map();
  const packages =
    typeof lock === 'object' && lock !== null && 'packages' in lock ? lock.packages : undefined;
  if (typeof packages !== 'object' || packages === null) {
    return { problems: ['no "packages" map — lockfile v2 or v3 expected'], checked: 0, counts };
  }

  const shippedSeen = new Set();
  let checked = 0;
  for (const [key, raw] of Object.entries(packages)) {
    // The root project (key "") and workspace links carry no install of their own.
    if (key === '' || !key.includes('node_modules/')) continue;
    if (typeof raw === 'object' && raw !== null && 'link' in raw && raw.link === true) continue;
    checked++;
    const name = packageNameOf(key);
    const license =
      typeof raw === 'object' && raw !== null && 'license' in raw ? raw.license : undefined;
    const label = typeof license === 'string' ? license : '(none)';
    counts.set(label, (counts.get(label) ?? 0) + 1);

    const shipped = CREDITED_PACKAGES.includes(name);
    if (shipped) shippedSeen.add(name);
    if (Object.hasOwn(EXCEPTIONS, name)) continue;
    const allowed = shipped ? SHIPPED_LICENSES : TOOLCHAIN_LICENSES;
    if (typeof license !== 'string' || !satisfies(license, allowed)) {
      problems.push(
        `${printable(key)}: licence "${printable(label)}" is not accepted for ` +
          (shipped ? 'code that ships in the extension' : 'build tooling'),
      );
    }
  }

  for (const name of shipsCode ? CREDITED_PACKAGES : []) {
    if (!shippedSeen.has(name)) {
      problems.push(`${printable(name)}: credited as shipping, but not in the lockfile`);
    }
  }
  return { problems, checked, counts };
}

/** The lockfiles this repository installs from, and whether each builds the extension. */
const LOCKFILES = [
  { path: 'package-lock.json', shipsCode: true },
  { path: 'tools/publish/package-lock.json', shipsCode: false },
];

/** @returns {number} exit code */
function main() {
  const repo = resolve(fileURLToPath(import.meta.url), '..', '..');
  /** @type {string[]} */
  const problems = [];
  let checked = 0;
  /** @type {Map<string, number>} */
  const counts = new Map();
  for (const { path, shipsCode } of LOCKFILES) {
    /** @type {unknown} */
    let lock;
    try {
      lock = JSON.parse(readFileSync(resolve(repo, path), 'utf8'));
    } catch (cause) {
      console.error(`::error::check-licenses: cannot read ${path} (${String(cause)})`);
      return 1;
    }
    const result = checkLockfile(lock, { shipsCode });
    for (const problem of result.problems) problems.push(`${path}: ${problem}`);
    checked += result.checked;
    for (const [license, n] of result.counts) counts.set(license, (counts.get(license) ?? 0) + n);
  }
  if (problems.length > 0) {
    for (const problem of problems) console.error(`::error::check-licenses: ${problem}`);
    console.error(
      '\nSee docs/09 §3.2: add the licence to a list, or an EXCEPTIONS entry, on purpose.',
    );
    return 1;
  }
  const summary = [...counts]
    .sort((a, b) => b[1] - a[1])
    .map(([license, n]) => `${printable(license)} ${n}`)
    .join(', ');
  console.warn(`check-licenses: clean — ${checked} packages (${summary}).`);
  return 0;
}

// Run only as the entry point (same guard as check-manifest.mjs).
const isEntry =
  import.meta.url.startsWith('file:') &&
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isEntry) {
  // exitCode, not exit(): exit() can cut off piped stderr before CI reads it.
  process.exitCode = main();
}
