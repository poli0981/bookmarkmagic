import { defineConfig } from 'wxt';

/**
 * WXT configuration.
 *
 * Hard constraints encoded here (docs/08 §1, CLAUDE.md hard rules):
 * - Permissions are exactly ["bookmarks", "storage"] — forever, for v1.
 *   No host_permissions, no content_scripts, no background service worker.
 * - No remote code: everything ships in the package, and the MV3 default CSP
 *   is never loosened.
 * - srcDir: 'src' so entrypoints/, public/ and lib/ all live under src/ and
 *   the `@` alias resolves there (docs/02 §2).
 * - One runtime floor, stated three times on purpose: `minimum_chrome_version`
 *   below, Vite's `build.target`, and tsconfig's `ES2025` lib. Chrome 136 is
 *   the first release with every ES2025 built-in (RegExp.escape landed in 136,
 *   Float16Array in 135), so the types the compiler allows are exactly the
 *   APIs the oldest supported browser has (docs/01 §1, docs/08 §7).
 */
const CHROME_FLOOR = 136;

export default defineConfig({
  srcDir: 'src',
  vite: () => ({ build: { target: `chrome${CHROME_FLOOR}` } }),
  // publicDir is resolved against the project ROOT, not srcDir — WXT's default
  // is `<root>/public`, so this line is required to keep _locales/ and icon/
  // under src/. Without it they are silently omitted from the build and Chrome
  // refuses to load the extension (missing __MSG_appName__ and icons).
  publicDir: 'src/public',
  modules: ['@wxt-dev/module-svelte'],
  manifest: {
    name: '__MSG_appName__',
    description: '__MSG_appDesc__',
    default_locale: 'en',
    minimum_chrome_version: String(CHROME_FLOOR),
    permissions: ['bookmarks', 'storage'],
    // Deep-link lands on #settings only when no Manager tab is open — with
    // open_in_tab Chrome matches the singleton tab ignoring the fragment,
    // so route.svelte.ts must react to hashchange (docs/02 §5).
    options_ui: { page: 'manager.html#settings', open_in_tab: true },
    icons: {
      16: '/icon/16.png',
      32: '/icon/32.png',
      48: '/icon/48.png',
      128: '/icon/128.png',
    },
    homepage_url: 'https://github.com/poli0981/bookmarkmagic',
  },
});
