// @vitest-environment node
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { checkExtension } from '../../../scripts/check-manifest.mjs';

/**
 * scripts/check-manifest.mjs gates the BUILT extension (docs/08 §2–§3). It ran
 * in CI and on every tag with no test of its own. These build a fake
 * `.output/chrome-mv3` tree per case and call the script's `checkExtension`
 * on it — the CLI itself takes no path argument (SonarCloud S8707).
 */

const SCRIPT = join(process.cwd(), 'scripts', 'check-manifest.mjs');
const CSP =
  "script-src 'self'; object-src 'none'; connect-src 'none'; img-src 'self' data: blob:; " +
  "style-src 'self' 'unsafe-inline'; font-src 'self'; media-src 'none'; frame-src 'none'; " +
  "worker-src 'self'; form-action 'none'; base-uri 'none'";

const MANIFEST = {
  manifest_version: 3,
  name: '__MSG_appName__',
  description: '__MSG_appDesc__',
  version: '1.1.0',
  icons: { 16: '/icon/16.png', 32: '/icon/32.png', 48: '/icon/48.png', 128: '/icon/128.png' },
  default_locale: 'en',
  minimum_chrome_version: '136',
  permissions: ['bookmarks', 'storage'],
  options_ui: { page: 'manager.html#settings', open_in_tab: true },
  homepage_url: 'https://github.com/poli0981/bookmarkmagic',
  content_security_policy: { extension_pages: CSP },
  action: { default_title: 'BookmarkMagic', default_popup: 'popup.html' },
};

const FILES: Record<string, string> = {
  'manager.html': '<!doctype html>',
  'popup.html': '<!doctype html>',
  '_locales/en/messages.json': '{}',
  '_locales/vi/messages.json': '{}',
  '_locales/ja/messages.json': '{}',
  'icon/16.png': 'x',
  'icon/32.png': 'x',
  'icon/48.png': 'x',
  'icon/128.png': 'x',
  'chunks/manager.js': 'const a=document.createElement("div");a.textContent="ok";',
};

const dirs: string[] = [];

function build(manifest: unknown, overrides: Record<string, string | null> = {}): string {
  const dir = mkdtempSync(join(tmpdir(), 'check-manifest-'));
  dirs.push(dir);
  const files = { ...FILES, 'manifest.json': JSON.stringify(manifest), ...overrides };
  for (const [rel, content] of Object.entries(files)) {
    if (content === null) continue;
    mkdirSync(dirname(join(dir, rel)), { recursive: true });
    writeFileSync(join(dir, rel), content);
  }
  return dir;
}

function check(dir: string): { status: number; output: string } {
  const { problems, readError } = checkExtension(dir);
  const failed = readError !== undefined || problems.length > 0;
  return { status: failed ? 1 : 0, output: [readError ?? '', ...problems].join('\n') };
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('check-manifest.mjs', () => {
  it('passes a correct build', () => {
    const { status, output } = check(build(MANIFEST));
    expect(status, output).toBe(0);
  });

  it.each([
    ['an extra permission', { permissions: ['bookmarks', 'storage', 'tabs'] }, 'permissions are'],
    ['a missing permission', { permissions: ['bookmarks'] }, 'permissions are'],
    ['host_permissions', { host_permissions: ['<all_urls>'] }, 'declares "host_permissions"'],
    ['a background worker', { background: { service_worker: 'bg.js' } }, 'declares "background"'],
    [
      'an unexpected key',
      { side_panel: { default_path: 'x.html' } },
      'unexpected top-level key(s): side_panel',
    ],
    ['MV2', { manifest_version: 2 }, 'manifest_version is 2'],
    ['the old Chrome floor', { minimum_chrome_version: '120' }, 'minimum_chrome_version is "120"'],
    [
      'a loosened CSP',
      {
        content_security_policy: {
          extension_pages: "script-src 'self' 'unsafe-eval'; object-src 'self'",
        },
      },
      'content_security_policy is',
    ],
    [
      'a CSP with an extra key',
      { content_security_policy: { extension_pages: CSP, sandbox: 'sandbox allow-scripts' } },
      'content_security_policy is',
    ],
  ])('fails on %s', (_label, change, message) => {
    const { status, output } = check(build({ ...MANIFEST, ...change }));
    expect(status, output).toBe(1);
    expect(output).toContain(message);
  });

  it('fails when the CSP is missing (a dev build, or a config edit)', () => {
    const { content_security_policy: _dropped, ...noCsp } = MANIFEST;
    const { status, output } = check(build(noCsp));
    expect(status).toBe(1);
    expect(output).toContain('missing expected top-level key(s): content_security_policy');
  });

  it.each(['_locales/vi/messages.json', 'icon/128.png', 'popup.html'])(
    'fails when %s is missing from the build',
    (file) => {
      const { status, output } = check(build(MANIFEST, { [file]: null }));
      expect(status).toBe(1);
      expect(output).toContain(
        `missing file in the build: ${file.startsWith('icon') ? `/${file}` : file}`,
      );
    },
  );

  it.each([
    ['fetch', 'chunks/x.js', 'fetch("https://x.example")'],
    ['XMLHttpRequest', 'chunks/x.js', 'new XMLHttpRequest'],
    ['sendBeacon', 'assets/deep/y.js', 'navigator.sendBeacon(u)'],
  ])('fails on %s anywhere in the shipped JavaScript', (api, file, code) => {
    const { status, output } = check(build(MANIFEST, { [file]: code }));
    expect(status).toBe(1);
    expect(output).toContain(`network API "${api}`);
  });

  it('fails clearly when there is no build at all', () => {
    const empty = mkdtempSync(join(tmpdir(), 'check-manifest-empty-'));
    dirs.push(empty);
    const { status, output } = check(empty);
    expect(status).toBe(1);
    expect(output).toContain('cannot read manifest.json');
  });

  it('runs as a CLI with no arguments, against the repository build', () => {
    // Whatever state .output/ is in, the CLI must exit cleanly or explain why —
    // never crash, and never read a path it was handed.
    const result = spawnSync(process.execPath, [SCRIPT, '/etc'], { encoding: 'utf8' });
    const output = `${result.stdout}${result.stderr}`;
    expect([0, 1]).toContain(result.status);
    expect(output).toMatch(/check-manifest: (clean|cannot read|.*permissions)/);
    expect(output).not.toContain('/etc');
  });
});
