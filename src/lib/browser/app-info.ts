/**
 * Runtime metadata about the built extension.
 *
 * Purpose: the ONE place the displayed version comes from (docs/06 §3.5). It
 *   used to be hardcoded in three files, which is three chances to ship a
 *   number that disagrees with the manifest.
 * Inputs: none — reads the packaged manifest.
 * Guarantees: synchronous, so there is no version race and no loading state;
 *   never throws.
 */
import { browser } from 'wxt/browser';

/**
 * The manifest version, or `''` when it cannot be read.
 *
 * Empty rather than a plausible fallback like `'0.0.0'`: callers hide the line
 * entirely, and no version at all is better than a wrong one in a footer users
 * quote in bug reports.
 */
export function getAppVersion(): string {
  try {
    return browser.runtime.getManifest().version;
  } catch {
    return '';
  }
}

/**
 * The `generator` string written into exported and backup BM JSON.
 *
 * Separate from `getAppVersion` because the UI and a file want different
 * fallbacks: the UI hides an unknown version, but a file field cannot be
 * hidden, and `"BookmarkMagic "` with a trailing space is a worse artifact
 * than the bare product name.
 */
export function getGeneratorVersion(): string {
  const version = getAppVersion();
  return version === '' ? 'unknown' : version;
}
