import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Every package the build may compile in is credited — docs/14 §5.
 *
 * `wxt.config.ts` fails the build when code from a package outside
 * CREDITED_PACKAGES ships; this test closes the other half, so the list cannot
 * grow without the notices growing with it. Through v1.0.x the notices said
 * "none" while three packages shipped.
 */
const read = (path: string): string => readFileSync(join(process.cwd(), path), 'utf8');
const CONFIG = read('wxt.config.ts');
const credited = [
  ...(/const CREDITED_PACKAGES = \[([^\]]*)\]/.exec(CONFIG)?.[1] ?? '').matchAll(/'([^']+)'/g),
].map((m) => m[1] ?? '');

describe('third-party notices', () => {
  it('reads a non-empty credited list from wxt.config.ts', () => {
    expect(credited).toEqual(expect.arrayContaining(['svelte', 'clsx']));
  });

  it.each(['legal/THIRD_PARTY_NOTICES.md', 'src/public/THIRD_PARTY_NOTICES.txt'])(
    '%s names every credited package and carries an MIT notice for it',
    (path) => {
      const notices = read(path);
      for (const name of credited) expect(notices, name).toContain(name);
      const licenseTexts = notices.match(/Permission is hereby granted/g) ?? [];
      // One MIT text per credited project (wxt and @wxt-dev/browser share one).
      expect(licenseTexts.length).toBeGreaterThanOrEqual(3);
    },
  );
});
