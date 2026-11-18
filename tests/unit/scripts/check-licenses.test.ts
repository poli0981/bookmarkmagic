import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  checkLockfile,
  EXCEPTIONS,
  packageNameOf,
  SHIPPED_LICENSES,
  satisfies,
  TOOLCHAIN_LICENSES,
} from '../../../scripts/check-licenses.mjs';

/**
 * scripts/check-licenses.mjs — the licence gate (docs/09 §3.2).
 *
 * Called as functions, never spawned: the process-spawning script tests are
 * the ones that time out under load on Windows (CLAUDE.md, Phase 8).
 */

/** A lockfile with the four shipped packages plus whatever a case adds. */
function lockWith(extra: Record<string, object> = {}): object {
  return {
    lockfileVersion: 3,
    packages: {
      '': { name: 'bookmarkmagic', license: 'GPL-3.0-or-later' },
      'node_modules/svelte': { version: '5.0.0', license: 'MIT', dev: true },
      'node_modules/clsx': { version: '2.0.0', license: 'MIT', dev: true },
      'node_modules/wxt': { version: '0.21.5', license: 'MIT', dev: true },
      'node_modules/@wxt-dev/browser': { version: '0.1.0', license: 'MIT', dev: true },
      ...extra,
    },
  };
}

describe('satisfies — SPDX expressions', () => {
  const allowed = ['MIT', 'Apache-2.0', 'ISC'];

  it.each([
    ['MIT', true],
    ['GPL-3.0-only', false],
    ['MIT OR GPL-3.0-only', true],
    ['GPL-3.0-only OR MIT', true],
    ['MIT AND ISC', true],
    ['MIT AND GPL-3.0-only', false],
    ['(MIT OR GPL-3.0-only) AND ISC', true],
    ['(MIT AND GPL-3.0-only) OR Apache-2.0', true],
    ['(MIT AND GPL-3.0-only) OR AGPL-3.0-only', false],
    ['Apache-2.0 WITH LLVM-exception', true],
  ])('%s → %s', (expression, expected) => {
    expect(satisfies(expression, allowed)).toBe(expected);
  });

  it.each([
    '',
    'UNLICENSED',
    'SEE LICENSE IN LICENSE.md',
    '(MIT',
    'MIT)',
    'MIT OR',
    'AND MIT',
    'MIT WITH',
    'Apache 2.0',
  ])('refuses %j', (expression) => {
    expect(satisfies(expression, allowed)).toBe(false);
  });
});

describe('packageNameOf', () => {
  it.each([
    ['node_modules/vite', 'vite'],
    ['node_modules/@wxt-dev/browser', '@wxt-dev/browser'],
    ['node_modules/a/node_modules/@scope/b', '@scope/b'],
    ['node_modules/a/node_modules/picomatch', 'picomatch'],
  ])('%s → %s', (key, name) => {
    expect(packageNameOf(key)).toBe(name);
  });
});

describe('checkLockfile', () => {
  it('passes a tree of accepted licences and counts them', () => {
    const result = checkLockfile(
      lockWith({
        'node_modules/lightningcss': { license: 'MPL-2.0', dev: true },
        'node_modules/x/node_modules/y': { license: 'MIT OR Apache-2.0', dev: true },
      }),
    );
    expect(result.problems).toEqual([]);
    expect(result.checked).toBe(6);
    expect(result.counts.get('MIT')).toBe(4);
    expect(result.counts.get('MPL-2.0')).toBe(1);
  });

  it('holds shipped packages to the stricter list', () => {
    // MPL-2.0 is fine for a build tool and not for code inside the extension.
    const lock = lockWith({ 'node_modules/svelte': { license: 'MPL-2.0', dev: true } });
    const { problems } = checkLockfile(lock);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('node_modules/svelte');
    expect(problems[0]).toContain('ships in the extension');
  });

  it('applies the shipped list to a nested copy of a shipped package too', () => {
    const lock = lockWith({ 'node_modules/a/node_modules/clsx': { license: 'CC0-1.0' } });
    expect(checkLockfile(lock).problems).toHaveLength(1);
  });

  it.each([
    ['AGPL-3.0-only'],
    ['SSPL-1.0'],
    ['BUSL-1.1'],
    ['UNLICENSED'],
    ['SEE LICENSE IN EULA.txt'],
  ])('fails a toolchain package licensed %s', (license) => {
    const { problems } = checkLockfile(lockWith({ 'node_modules/bad': { license } }));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('build tooling');
  });

  it('fails a package with no licence field at all', () => {
    const { problems, counts } = checkLockfile(
      lockWith({ 'node_modules/bare': { version: '1.0.0' } }),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('(none)');
    expect(counts.get('(none)')).toBe(1);
  });

  it('fails when a credited package is missing from the lockfile', () => {
    const { 'node_modules/clsx': _gone, ...rest } = (lockWith() as { packages: object })
      .packages as Record<string, object>;
    const lock = { lockfileVersion: 3, packages: rest };
    expect(checkLockfile(lock).problems).toEqual([
      'clsx: credited as shipping, but not in the lockfile',
    ]);
  });

  it('expects no credited package in a lockfile that ships nothing (tools/publish)', () => {
    const tools = { lockfileVersion: 3, packages: { 'node_modules/cac': { license: 'MIT' } } };
    expect(checkLockfile(tools, { shipsCode: false }).problems).toEqual([]);
    expect(checkLockfile(tools).problems).toHaveLength(4);
  });

  it('passes the publish tool lockfile', () => {
    const lock: unknown = JSON.parse(
      readFileSync(join(process.cwd(), 'tools/publish/package-lock.json'), 'utf8'),
    );
    expect(checkLockfile(lock, { shipsCode: false }).problems).toEqual([]);
  });

  it('skips the root project and workspace links', () => {
    const lock = lockWith({
      'packages/local': { link: true },
      'node_modules/local': { link: true },
    });
    expect(checkLockfile(lock).problems).toEqual([]);
  });

  it('refuses something that is not a v2/v3 lockfile', () => {
    expect(checkLockfile({ lockfileVersion: 1, dependencies: {} }).problems).toHaveLength(1);
    expect(checkLockfile(null).problems).toHaveLength(1);
  });

  it('keeps log output to safe characters', () => {
    const { problems } = checkLockfile(
      lockWith({ 'node_modules/evil': { license: 'MIT\n::error::injected' } }),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).not.toContain('\n');
    expect(problems[0]).not.toContain('::error::injected');
  });
});

describe('the policy itself', () => {
  it('ships nothing under a copyleft licence', () => {
    for (const id of SHIPPED_LICENSES) expect(id).not.toMatch(/GPL|MPL|EPL|CDDL|SSPL|BUSL/);
  });

  it('accepts everything shipped for tooling too', () => {
    for (const id of SHIPPED_LICENSES) expect(TOOLCHAIN_LICENSES).toContain(id);
  });

  it('starts with no exceptions — each one is a recorded decision', () => {
    expect(Object.keys(EXCEPTIONS)).toEqual([]);
  });

  it('passes the repository lockfile', () => {
    const lock: unknown = JSON.parse(
      readFileSync(join(process.cwd(), 'package-lock.json'), 'utf8'),
    );
    const { problems, checked } = checkLockfile(lock);
    expect(problems).toEqual([]);
    expect(checked).toBeGreaterThan(100);
  });
});
