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
  'declarative_net_request',
  'devtools_page',
  'chrome_url_overrides',
];

describe('manifest', () => {
  it('declares the permissions array exactly once', () => {
    // Two arrays (e.g. a browser-specific override) would mean this file only
    // ever checks the first, which might not be the one that ships.
    expect(CONFIG.match(/(?<![a-z_])permissions:/gi)?.length ?? 0).toBe(1);
  });

  it('builds the permissions array from string literals only', () => {
    // Without this, a spread, an identifier or a `.concat()` tail would be
    // dropped by the literal-harvesting regex below and the assertion would
    // still pass while extra permissions shipped.
    const match = CONFIG.match(/permissions:\s*\[([^\]]*)\]/);
    const residue = (match?.[1] ?? '').replace(/'[^']*'|"[^"]*"|[\s,]/g, '');
    expect(residue, 'permissions array contains non-literal entries').toBe('');
  });

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

  it('states one runtime floor: Chrome 136, the first with every ES2025 built-in', () => {
    // The manifest floor, Vite's transpile target and tsconfig's lib must agree.
    // A lib newer than the floor lets the compiler accept APIs (RegExp.escape,
    // Float16Array) that throw on the oldest Chrome still allowed to install.
    expect(CONFIG).toMatch(/const CHROME_FLOOR = 136;/);
    expect(CONFIG).toMatch(/minimum_chrome_version:\s*String\(CHROME_FLOOR\)/);
    expect(CONFIG).toMatch(/target:\s*`chrome\$\{CHROME_FLOOR\}`/);
    // SAFETY: tsconfig.json is a committed file with exactly this shape; a
    // missing key fails the expectations below rather than passing silently.
    const tsconfig = JSON.parse(readFileSync(join(process.cwd(), 'tsconfig.json'), 'utf8')) as {
      compilerOptions: { target: string; lib: string[] };
    };
    expect(tsconfig.compilerOptions.target).toBe('ES2025');
    expect(tsconfig.compilerOptions.lib).toEqual(['ES2025', 'DOM', 'DOM.Iterable']);
  });

  it('declares the extension-page CSP once, production-only, and only ever stricter', () => {
    // docs/08 §3: the CSP is what makes the zero-network promise browser-
    // enforced. check-manifest.mjs pins the exact built string; this pins the
    // shape of the config that produces it.
    expect(CONFIG.match(/content_security_policy/g)?.length ?? 0).toBe(1);
    expect(CONFIG).toMatch(/command === 'build' && \{\s*content_security_policy:/);
    // From the comment-stripped config: the explanatory comments beside the
    // directives mention default-src on purpose.
    const csp = CONFIG.slice(
      CONFIG.indexOf('const EXTENSION_PAGE_CSP'),
      CONFIG.indexOf("].join('; ')"),
    );
    for (const directive of [
      "script-src 'self'",
      "object-src 'none'",
      "connect-src 'none'",
      "img-src 'self' data: blob:",
      "form-action 'none'",
    ]) {
      expect(csp).toContain(`"${directive}"`);
    }
    // Loosening is what MV3 forbids and what this test exists to stop. The one
    // 'unsafe-inline' allowed is for STYLE (Svelte sets style attributes) —
    // never for script.
    expect(csp).toContain(`"style-src 'self' 'unsafe-inline'"`);
    const withoutInlineStyle = csp.replace(`"style-src 'self' 'unsafe-inline'"`, '');
    expect(withoutInlineStyle).not.toMatch(/unsafe-|https?:|\*|default-src/);
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
