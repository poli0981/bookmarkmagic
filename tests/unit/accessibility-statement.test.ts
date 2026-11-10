import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * ACCESSIBILITY.md is a public promise (docs/06 §5), and nothing in the build
 * reads it. These pin the parts that rot quietly: the routes a user is sent
 * down, and the key table, which is the only place the tree's keys are
 * written for users — nothing in the UI shows them.
 */
const REPO_ROOT = process.cwd();
const read = (path: string): string => readFileSync(join(REPO_ROOT, path), 'utf8');

describe('the accessibility statement', () => {
  const statement = read('ACCESSIBILITY.md');

  it('is linked from the README', () => {
    expect(read('README.md')).toContain('](ACCESSIBILITY.md)');
  });

  it('sends reports to a form that exists and carries the accessibility label', () => {
    const form = '.github/ISSUE_TEMPLATE/accessibility.yml';
    expect(existsSync(join(REPO_ROOT, form))).toBe(true);
    expect(statement).toContain('issues/new?template=accessibility.yml');
    expect(read(form)).toMatch(/^labels: \[accessibility\]$/m);
  });

  it('gives the same address as the issue chooser and the README', () => {
    const address = 'accessibility@poli0981.dev';
    expect(statement).toContain(address);
    expect(read('README.md')).toContain(address);
    expect(read('.github/ISSUE_TEMPLATE/config.yml')).toContain(`mailto:${address}`);
  });

  it('documents every key the tree handles (docs/06 §5)', () => {
    // The left column of the statement's key table. A key added to
    // `edit/tree-keyboard.ts` or `edit/tree-keys.ts` belongs here and there.
    const keys = [
      '| ↑ / ↓ |',
      '| Home / End |',
      '| → |',
      '| ← |',
      '| A letter or digit |',
      '| Enter |',
      '| F2 |',
      '| Delete (Fn+Delete on a Mac laptop) |',
      '| Menu key, or Shift+F10 |',
      '| Alt+↑ / Alt+↓ |',
      '| Ctrl+C (⌘C on macOS) |',
      '| Ctrl+F (⌘F on macOS) |',
    ];
    for (const key of keys) expect(statement, `missing ${key}`).toContain(key);
  });

  it('has a row for every key the tree’s code handles', () => {
    // The other direction: a key ADDED to the code without a row here fails.
    // `resolveKey` switches on these names; `tree-keys.ts` handles the rest.
    const ROWS: Record<string, string> = {
      ArrowDown: '| ↑ / ↓ |',
      ArrowUp: '| ↑ / ↓ |',
      Home: '| Home / End |',
      End: '| Home / End |',
      ArrowRight: '| → |',
      ArrowLeft: '| ← |',
      Enter: '| Enter |',
      F2: '| F2 |',
      Delete: '| Delete',
      ContextMenu: '| Menu key, or Shift+F10 |',
    };
    const source = read('src/lib/edit/tree-keyboard.ts');
    const cases = [...source.matchAll(/case '([A-Za-z0-9]+)':/g)].map((match) => match[1] ?? '');
    expect(cases.length).toBeGreaterThanOrEqual(Object.keys(ROWS).length);
    for (const key of cases) {
      const row = ROWS[key];
      expect(
        row,
        `tree-keyboard.ts handles ${key}, which has no row in ACCESSIBILITY.md`,
      ).toBeDefined();
      expect(statement).toContain(row ?? '');
    }
  });

  it('states a goal and says what was not tested, rather than claiming conformance', () => {
    expect(statement).toContain('That is a goal, not a claim.');
    expect(statement).toContain('**Not tested**');
    expect(statement).toContain('## Known limitations');
  });

  it('is dated, so a stale review shows', () => {
    expect(statement).toMatch(
      /\*\*Last reviewed:\*\* \d{4}-\d{2}-\d{2}, for version \d+\.\d+\.\d+\./,
    );
  });
});
