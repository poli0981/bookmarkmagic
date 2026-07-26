import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The permission list is the product's most load-bearing public claim: it is in
 * the README, the privacy policy, the store listing's privacy tab, and
 * CLAUDE.md's first hard rule. Until this file existed, nothing enforced it —
 * a single added string in wxt.config.ts would have shipped silently.
 *
 * Read as text rather than imported, so the assertion cannot be satisfied by a
 * value computed at build time; what ships is what is written here.
 */

const RAW = readFileSync(join(process.cwd(), 'wxt.config.ts'), 'utf8');
/**
 * Comments stripped first. The file's own header says "No host_permissions, no
 * content_scripts", so a naive substring check fails on the prose that promises
 * the very thing it is checking.
 */
const CONFIG = RAW.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

/** Anything that widens the extension's reach beyond bookmarks + storage. */
const FORBIDDEN_KEYS = [
  'host_permissions',
  'optional_permissions',
  'optional_host_permissions',
  'content_scripts',
  'web_accessible_resources',
  'externally_connectable',
  'content_security_policy',
  'declarative_net_request',
  'devtools_page',
  'chrome_url_overrides',
];

describe('manifest', () => {
  it('requests exactly ["bookmarks", "storage"]', () => {
    const match = CONFIG.match(/permissions:\s*\[([^\]]*)\]/);
    expect(match?.[1], 'no permissions array found in wxt.config.ts').toBeDefined();

    const requested = [...(match?.[1] ?? '').matchAll(/'([^']+)'|"([^"]+)"/g)].map(
      (entry) => entry[1] ?? entry[2],
    );
    // Adding one is a minor-version event that also requires updating docs
    // 08/09/13 and the store privacy tab (docs/09 §4). Update this list last.
    expect(requested).toEqual(['bookmarks', 'storage']);
  });

  it.each(FORBIDDEN_KEYS)('declares no %s', (key) => {
    expect(CONFIG).not.toContain(key);
  });

  it('declares no background service worker', () => {
    // docs/15 decision log, 2026-07-03: no background worker in v1. One would
    // also change the store review posture.
    expect(CONFIG).not.toMatch(/\bbackground\s*:/);
  });

  it('keeps the manifest at v3 by not overriding WXT’s default', () => {
    // WXT emits manifest_version 3 for the chrome-mv3 target. An explicit
    // downgrade here would be the only way to lose it.
    expect(CONFIG).not.toMatch(/manifest_version\s*:\s*2/);
  });

  it('still points default_locale at the three shipped dictionaries', () => {
    expect(CONFIG).toMatch(/default_locale:\s*'en'/);
    for (const locale of ['en', 'vi', 'ja']) {
      const path = join(process.cwd(), 'src/public/_locales', locale, 'messages.json');
      const messages: unknown = JSON.parse(readFileSync(path, 'utf8'));
      expect(messages, `${locale}/messages.json`).toHaveProperty('appName');
      expect(messages, `${locale}/messages.json`).toHaveProperty('appDesc');
    }
  });
});
