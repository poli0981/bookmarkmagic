/**
 * Opening a bookmarked URL — the docs/09 T3 control.
 *
 * Purpose: the single gate between a URL that came out of someone's import file
 *   and the browser actually navigating to it.
 * Inputs: a URL string from untrusted file data.
 * Guarantees: only `http:` and `https:` ever reach `tabs.create`. Nothing is
 *   opened for an unparseable URL, and nothing throws.
 */
import { browser } from 'wxt/browser';

/** Schemes allowed to reach the browser. Everything else is display-only. */
const ALLOWED_SCHEMES = new Set(['http:', 'https:']);

/**
 * Whether this URL would be refused — so the row can warn BEFORE the click.
 *
 * docs/09 T3 asks for both halves: block the navigation, and mark the bookmark
 * so a `javascript:` entry titled "Your bank" does not look like an ordinary
 * link that simply does nothing.
 */
export function isBlockedUrl(url: string | undefined): boolean {
  if (url === undefined) return false;
  try {
    return !ALLOWED_SCHEMES.has(new URL(url).protocol);
  } catch {
    return true;
  }
}

/**
 * Open `url` in a new tab if its scheme is allowed.
 *
 * Returns whether it was opened, so callers and tests can tell "blocked" from
 * "opened" rather than inferring it.
 *
 * Chromium also refuses `javascript:` from `tabs.create`, but this allowlist is
 * the authoritative control: it is ours, it is testable, and it does not move
 * when a browser changes its mind. `data:`, `file:` and `chrome:` are blocked
 * here even though some are navigable, because a bookmark file is untrusted
 * input and none of them are worth the surface.
 */
export async function openBookmarkUrl(url: string): Promise<boolean> {
  let scheme: string;
  try {
    scheme = new URL(url).protocol;
  } catch {
    return false;
  }
  if (!ALLOWED_SCHEMES.has(scheme)) return false;

  await browser.tabs.create({ url });
  return true;
}
