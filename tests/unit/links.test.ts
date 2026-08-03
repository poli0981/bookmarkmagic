import { existsSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { getAppVersion } from '@/lib/browser/app-info';
import { setLocale, t } from '@/lib/i18n/index.svelte';
import type { Locale } from '@/lib/i18n/resolve-locale';
import {
  CHANGELOG_URL,
  DONATE_LINKS,
  ISSUES_URL,
  LEGAL_URLS,
  REPO_URL,
  STORE_URL,
} from '@/lib/links';

const LOCALES: Locale[] = ['en', 'vi', 'ja'];
/** Vitest runs with cwd at the project root, which is where `legal/` lives. */
const REPO_ROOT = process.cwd();

afterEach(() => {
  setLocale('en');
});

describe('outbound links', () => {
  it('are all absolute https URLs', () => {
    const urls = [
      REPO_URL,
      ISSUES_URL,
      CHANGELOG_URL,
      ...LEGAL_URLS.map((link) => link.url),
      ...DONATE_LINKS.map((link) => link.url),
    ];
    for (const url of urls) {
      expect(() => new URL(url)).not.toThrow();
      expect(new URL(url).protocol).toBe('https:');
    }
  });

  it('points every legal link at a file that exists in the repo', () => {
    // A rename would otherwise ship four dead links from inside a legal gate,
    // and nothing else in the build would notice.
    for (const link of LEGAL_URLS) {
      const path = new URL(link.url).pathname.replace('/poli0981/bookmarkmagic/blob/main/', '');
      expect(existsSync(join(REPO_ROOT, path)), `missing ${path}`).toBe(true);
      expect(basename(path)).not.toBe('');
    }
  });

  it('labels every legal link in all three locales', () => {
    const missing: string[] = [];
    for (const locale of LOCALES) {
      setLocale(locale);
      for (const link of LEGAL_URLS) {
        if (t(link.labelKey) === link.labelKey) missing.push(`${locale}: ${link.labelKey}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('lists exactly the four documents docs/14 §2 requires', () => {
    expect(LEGAL_URLS.map((link) => link.labelKey)).toEqual([
      'legal.eula',
      'legal.license',
      'legal.disclaimer',
      'legal.privacy',
    ]);
  });

  it('lists all five funding handles from .github/FUNDING.yml (docs/14 §5)', () => {
    expect(DONATE_LINKS).toHaveLength(5);
    expect(DONATE_LINKS.map((link) => link.label)).toEqual([
      'GitHub Sponsors',
      'Ko-fi',
      'Buy Me a Coffee',
      'Patreon',
      'PayPal',
    ]);
  });

  it('links a CHANGELOG.md that actually exists', () => {
    // It pointed at /releases through Phase 4 because the file did not exist.
    // Same check as the legal documents: a link from inside the product must
    // not 404 because someone renamed or deleted the target.
    expect(CHANGELOG_URL.endsWith('/blob/main/CHANGELOG.md')).toBe(true);
    expect(existsSync(join(REPO_ROOT, 'CHANGELOG.md'))).toBe(true);
  });

  it('links a README the badges and install steps live in', () => {
    expect(existsSync(join(REPO_ROOT, 'README.md'))).toBe(true);
  });
});

describe('store listing', () => {
  it('is the published item, and is the only in-product route to a review', () => {
    // docs/13 §6 counts store ratings as a post-launch channel; before this
    // there was no way to reach the listing from inside the extension at all.
    expect(STORE_URL.startsWith('https://chromewebstore.google.com/detail/')).toBe(true);
    // The item id doubles as the CHROME_EXTENSION_ID secret (docs/00 §9), so a
    // typo here is a typo in two places.
    expect(STORE_URL).toContain('eghnciphhegekmnofffpgbdfefckdhmg');
  });

  it('puts no email address on any in-product surface', () => {
    // Deliberate — docs/15 decision log, 2026-08-03. An address inside the
    // extension invites users to mail their real bookmarks file, which is the
    // receipt of personal data legal/PRIVACY.md exists to bound. The address
    // belongs in SECURITY.md and CONTRIBUTING.md, where it arrives alongside
    // the instruction to sanitize first.
    const source = readFileSync(join(REPO_ROOT, 'src', 'lib', 'links.ts'), 'utf8');
    const code = source.replace(/\/\*\*[\s\S]*?\*\//g, '');
    expect(code).not.toMatch(/mailto:/);
    expect(code).not.toMatch(/@poli0981\.dev/);
  });
});

describe('getAppVersion', () => {
  it('returns an empty string rather than throwing when the manifest is unreadable', () => {
    // fakeBrowser has no packaged manifest, so this exercises the fallback.
    // A wrong-but-plausible version in a footer users quote in bug reports is
    // worse than no version at all.
    expect(() => getAppVersion()).not.toThrow();
    expect(typeof getAppVersion()).toBe('string');
  });
});
