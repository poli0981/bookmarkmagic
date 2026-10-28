import { defineConfig } from 'wxt';

/**
 * WXT configuration.
 *
 * Hard constraints encoded here (docs/08 §1, CLAUDE.md hard rules):
 * - Permissions are exactly ["bookmarks", "storage"] — forever, for v1.
 *   No host_permissions, no content_scripts, no background service worker.
 * - No remote code: everything ships in the package. The extension-page CSP
 *   below only ever TIGHTENS the MV3 default; it never loosens it.
 * - srcDir: 'src' so entrypoints/, public/ and lib/ all live under src/ and
 *   the `@` alias resolves there (docs/02 §2).
 * - One runtime floor, stated three times on purpose: `minimum_chrome_version`
 *   below, Vite's `build.target`, and tsconfig's `ES2025` lib. Chrome 136 is
 *   the first release with every ES2025 built-in (RegExp.escape landed in 136,
 *   Float16Array in 135), so the types the compiler allows are exactly the
 *   APIs the oldest supported browser has (docs/01 §1, docs/08 §7).
 */
const CHROME_FLOOR = 136;

/**
 * The zero-network promise, enforced by the browser — docs/08 §3.
 *
 * MV3's default extension-page CSP restricts code execution only; it has no
 * connect-src or img-src at all, so until v1.1.0 a grep gate was the only
 * thing between the product and its "no network" claim. `connect-src 'none'`
 * makes Chrome itself refuse every fetch, XHR, WebSocket, EventSource and
 * beacon; the other directives close remote images, fonts, media, frames and
 * form posts. There is deliberately no `default-src`, so Svelte's styles are
 * untouched. `scripts/check-manifest.mjs` pins this exact string in the built
 * manifest.
 *
 * Production builds only: the dev server (`wxt`, command "serve") reloads the
 * extension over a localhost websocket that `connect-src 'none'` would block.
 */
const EXTENSION_PAGE_CSP = [
  "script-src 'self'",
  "object-src 'none'",
  "connect-src 'none'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "media-src 'none'",
  "frame-src 'none'",
  "worker-src 'self'",
  "form-action 'none'",
  "base-uri 'none'",
].join('; ');

export default defineConfig({
  srcDir: 'src',
  vite: () => ({
    build: {
      target: `chrome${CHROME_FLOOR}`,
      // Vite's modulepreload polyfill is a network call (it fetches each chunk
      // ahead of time) for browsers without native `<link rel=modulepreload>`.
      // Every Chrome at or above the floor has it, so the polyfill is dead code
      // that would leave the one network API in the shipped bundle.
      modulePreload: { polyfill: false },
    },
  }),
  // publicDir is resolved against the project ROOT, not srcDir — WXT's default
  // is `<root>/public`, so this line is required to keep _locales/ and icon/
  // under src/. Without it they are silently omitted from the build and Chrome
  // refuses to load the extension (missing __MSG_appName__ and icons).
  publicDir: 'src/public',
  modules: ['@wxt-dev/module-svelte'],
  manifest: ({ command }) => ({
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
    ...(command === 'build' && {
      content_security_policy: { extension_pages: EXTENSION_PAGE_CSP },
    }),
  }),
});
