import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import { openBookmarkUrl } from '@/lib/browser/open-url';

/**
 * The docs/09 T3 control: bookmark URLs come from someone's import file and are
 * stored verbatim, so this allowlist is the only thing between a crafted
 * `javascript:` bookmark and the browser acting on it. It had no test.
 */

let created: { url?: string }[] = [];

beforeEach(() => {
  fakeBrowser.reset();
  vi.restoreAllMocks();
  created = [];
  // fakeBrowser stubs tabs.* with "not implemented" throws.
  vi.spyOn(fakeBrowser.tabs, 'create').mockImplementation(async (props) => {
    created.push(props);
    // SAFETY: the caller ignores the return value; only the recorded call
    // matters, and building a full Tab here would assert nothing.
    return {} as Awaited<ReturnType<typeof fakeBrowser.tabs.create>>;
  });
});

describe('openBookmarkUrl', () => {
  it.each([
    'https://example.com/',
    'http://example.com/path?q=1',
    'https://example.com:8443/#frag',
  ])('opens %s', async (url) => {
    expect(await openBookmarkUrl(url)).toBe(true);
    expect(created).toEqual([{ url }]);
  });

  it.each([
    ['javascript:alert(1)', 'the classic bookmarklet payload'],
    ['data:text/html,<script>alert(1)</script>', 'inline document'],
    ['file:///etc/passwd', 'local file read'],
    ['chrome://settings', 'privileged browser page'],
    ['ftp://example.com/', 'not in the allowlist'],
    ['vbscript:msgbox(1)', 'legacy script scheme'],
  ])('refuses %s (%s)', async (url) => {
    expect(await openBookmarkUrl(url)).toBe(false);
    expect(created).toEqual([]);
  });

  it('refuses an unparseable URL without throwing', async () => {
    for (const url of ['', 'not a url', '///', 'http://']) {
      await expect(openBookmarkUrl(url)).resolves.toBe(false);
    }
    expect(created).toEqual([]);
  });

  it('is case-insensitive about the scheme, as the URL parser is', async () => {
    // `new URL('JavaScript:…').protocol` normalizes to lowercase, so an
    // attacker cannot dodge the allowlist by shouting.
    expect(await openBookmarkUrl('JaVaScRiPt:alert(1)')).toBe(false);
    expect(await openBookmarkUrl('HTTPS://example.com/')).toBe(true);
    expect(created).toEqual([{ url: 'HTTPS://example.com/' }]);
  });
});
