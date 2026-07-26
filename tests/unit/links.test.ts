import { existsSync } from 'node:fs';
import { basename, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { getAppVersion } from '@/lib/browser/app-info';
import { setLocale, t } from '@/lib/i18n/index.svelte';
import type { Locale } from '@/lib/i18n/resolve-locale';
import { CHANGELOG_URL, DONATE_LINKS, ISSUES_URL, LEGAL_URLS, REPO_URL } from '@/lib/links';

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

  it('avoids linking a CHANGELOG.md that does not exist yet', () => {
    // Phase 5 authors it; until then the releases page is the honest target.
    expect(CHANGELOG_URL.endsWith('/releases')).toBe(true);
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
