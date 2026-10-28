// @ts-check
/**
 * Assert the BUILT extension — CLAUDE.md hard rule 1, docs/08 §2–§3.
 *
 * `tests/unit/manifest.test.ts` reads `wxt.config.ts`, which proves what we
 * ASKED for. It cannot prove what WXT emitted, and those differ: a dev build of
 * this exact config produces
 *   "permissions": ["bookmarks","storage","tabs","scripting"]
 *   "host_permissions": ["http://localhost/*"]
 * because WXT injects them for its dev server. So the shipped artifact gets its
 * own gate, run after `npm run build` (or `npm run zip`):
 *
 *   1. the manifest: MV3, the exact permission list, the exact top-level key
 *      set, the Chrome floor, and the exact extension-page CSP;
 *   2. the file inventory: every file the manifest or the pages point at exists
 *      (WXT drops `_locales/` and `icon/` silently when publicDir is wrong),
 *      and no page points anywhere but inside the package;
 *   3. the bundle: none of the network identifiers `npm run guard` bans in the
 *      source, anywhere in the shipped JavaScript.
 *
 * Usage: node scripts/check-manifest.mjs — checks <repo>/.output/chrome-mv3,
 * resolved from this file, not the cwd. It takes no arguments on purpose: a
 * path from the command line flowed straight into file reads (SonarCloud
 * S8707). Its tests call `checkExtension(dir)` directly instead.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Exactly this, in any order. Adding one is a minor-version event (docs/09 §4). */
const ALLOWED_PERMISSIONS = ['bookmarks', 'storage'];

/** The ES2025 floor (docs/01 §1). Must equal CHROME_FLOOR in wxt.config.ts. */
const CHROME_FLOOR = '136';

/**
 * The production extension-page CSP (docs/08 §3), character for character.
 * It may only ever get stricter. Never add 'unsafe-eval' or a remote source.
 */
const EXPECTED_CSP =
  "default-src 'none'; script-src 'self'; object-src 'none'; connect-src 'none'; " +
  "img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; font-src 'self'; " +
  "media-src 'none'; frame-src 'none'; worker-src 'self'; form-action 'none'; base-uri 'none'";

/**
 * The exact top-level key set the build is expected to emit.
 *
 * The forbidden list below can only catch reach-widening keys someone thought
 * to enumerate. This catches the other direction — a build tool that starts
 * emitting a key nobody asked for, or stops emitting one the store requires.
 * WXT is a 0.x dependency, so a routine minor bump is exactly when that
 * happens. `version_name` would appear if package.json ever carried a
 * prerelease version (WXT splits it out); release versions never do.
 *
 * Adding a key here is a deliberate act. Check docs/08 §1 first.
 */
const EXPECTED_KEYS = [
  'action',
  'content_security_policy',
  'default_locale',
  'description',
  'homepage_url',
  'icons',
  'manifest_version',
  'minimum_chrome_version',
  'name',
  'options_ui',
  'permissions',
  'version',
];

/** Keys that would widen the extension's reach. None may be present. */
const FORBIDDEN_KEYS = [
  'host_permissions',
  'optional_permissions',
  'optional_host_permissions',
  'content_scripts',
  'background',
  'web_accessible_resources',
  'externally_connectable',
  'declarative_net_request',
  'devtools_page',
  'chrome_url_overrides',
];

/** Files every build must contain besides what the manifest references. */
const REQUIRED_FILES = [
  'manager.html',
  'popup.html',
  // The MIT notices for the code the build compiles in (legal/THIRD_PARTY_NOTICES.md).
  'THIRD_PARTY_NOTICES.txt',
  '_locales/en/messages.json',
  '_locales/vi/messages.json',
  '_locales/ja/messages.json',
];

/**
 * Network APIs that must not appear in the shipped JavaScript — including code
 * that arrived through a dependency, which `npm run guard` (source only) never
 * sees. The same identifiers the source gate bans, matched as bare words: until
 * v1.1.0 only `fetch(` counted, so `fetch.call(…)`, an alias, WebRTC and
 * `importScripts` shipped unseen. WebRTC matters most — no CSP directive Chrome
 * enforces governs it.
 */
const NETWORK_IN_BUNDLE =
  /\b(?:fetch|XMLHttpRequest|WebSocket|WebTransport|EventSource|sendBeacon|RTCPeerConnection|importScripts)\b/;

/** `src`/`href` values in a built page. Vite writes them double-quoted. */
const PAGE_REFS = /\b(?:src|href)="([^"]*)"/g;

/** @param {string} a @param {string} b */
const byName = (a, b) => a.localeCompare(b, 'en');

/** @param {string} dir @returns {string[]} */
function listFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    return entry.isDirectory() ? listFiles(full) : [full];
  });
}

/**
 * @param {string} outDir
 * @returns {Record<string, unknown> | string} the manifest, or why it could not be read
 */
function readManifest(outDir) {
  try {
    return JSON.parse(readFileSync(join(outDir, 'manifest.json'), 'utf8'));
  } catch (cause) {
    return `cannot read manifest.json (${cause instanceof Error ? cause.message : cause})`;
  }
}

/** @param {Record<string, unknown>} manifest @param {string[]} problems */
function checkManifest(manifest, problems) {
  if (manifest.manifest_version !== 3) {
    problems.push(`manifest_version is ${manifest.manifest_version}, expected 3`);
  }

  const permissions = Array.isArray(manifest.permissions) ? manifest.permissions : [];
  const actualPermissions = [...permissions].sort(byName).join(',');
  if (actualPermissions !== [...ALLOWED_PERMISSIONS].sort(byName).join(',')) {
    problems.push(
      `permissions are ${JSON.stringify(manifest.permissions)}, expected ${JSON.stringify(ALLOWED_PERMISSIONS)}`,
    );
  }

  for (const key of FORBIDDEN_KEYS) {
    if (key in manifest) problems.push(`declares "${key}": ${JSON.stringify(manifest[key])}`);
  }

  const actualKeys = Object.keys(manifest);
  const unexpected = actualKeys.filter((key) => !EXPECTED_KEYS.includes(key)).sort(byName);
  const missing = EXPECTED_KEYS.filter((key) => !actualKeys.includes(key));
  if (unexpected.length > 0) {
    problems.push(`unexpected top-level key(s): ${unexpected.join(', ')} — see docs/08 §1`);
  }
  if (missing.length > 0) problems.push(`missing expected top-level key(s): ${missing.join(', ')}`);

  if (manifest.minimum_chrome_version !== CHROME_FLOOR) {
    problems.push(
      `minimum_chrome_version is ${JSON.stringify(manifest.minimum_chrome_version)}, expected "${CHROME_FLOOR}" (docs/01 §1)`,
    );
  }

  const csp = /** @type {{ extension_pages?: unknown } | undefined} */ (
    manifest.content_security_policy
  );
  if (csp?.extension_pages !== EXPECTED_CSP || Object.keys(csp).length !== 1) {
    problems.push(
      `content_security_policy is ${JSON.stringify(csp)}, expected exactly { extension_pages: "${EXPECTED_CSP}" } (docs/08 §3)`,
    );
  }
}

/** @param {Record<string, unknown>} manifest @returns {string[]} */
function referencedFiles(manifest) {
  const icons = /** @type {Record<string, string>} */ (manifest.icons ?? {});
  const action = /** @type {{ default_popup?: string }} */ (manifest.action ?? {});
  const options = /** @type {{ page?: string }} */ (manifest.options_ui ?? {});
  return [...Object.values(icons), action.default_popup, options.page?.split('#')[0]].filter(
    (p) => typeof p === 'string',
  );
}

/**
 * What the built pages load: every `src`/`href` must be a path inside the
 * package. A page pointing outside it would be a remote load (which the CSP
 * refuses at runtime) or a file the build forgot (a blank page).
 *
 * @param {string} outDir @param {string[]} problems @returns {string[]}
 */
function pageReferences(outDir, problems) {
  const refs = [];
  for (const page of listFiles(outDir).filter((f) => f.endsWith('.html'))) {
    const rel = relative(outDir, page).replace(/\\/g, '/');
    for (const [, ref = ''] of readFileSync(page, 'utf8').matchAll(PAGE_REFS)) {
      if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(ref)) {
        problems.push(`${rel} loads "${ref}" from outside the package (docs/08 §3)`);
      } else if (ref !== '' && !ref.startsWith('#')) {
        refs.push(ref.split(/[?#]/)[0] ?? '');
      }
    }
  }
  return refs;
}

/** @param {string} outDir @param {Record<string, unknown>} manifest @param {string[]} problems */
function checkInventory(outDir, manifest, problems) {
  const files = [
    ...REQUIRED_FILES,
    ...referencedFiles(manifest),
    ...pageReferences(outDir, problems),
  ];
  for (const file of new Set(files)) {
    const path = join(outDir, file.replace(/^\//, ''));
    if (!existsSync(path)) problems.push(`missing file in the build: ${file}`);
  }
}

/** @param {string} outDir @param {string[]} problems */
function checkBundle(outDir, problems) {
  for (const file of listFiles(outDir).filter((f) => f.endsWith('.js'))) {
    const match = readFileSync(file, 'utf8').match(NETWORK_IN_BUNDLE);
    if (match) {
      const rel = relative(outDir, file).replace(/\\/g, '/');
      problems.push(`network API "${match[0]}" in the shipped bundle: ${rel} (docs/08 §3)`);
    }
  }
}

/**
 * Check one built extension directory.
 *
 * @param {string} outDir
 * @returns {{ problems: string[], readError?: string }} no problems and no read
 *   error means the build is clean
 */
export function checkExtension(outDir) {
  const manifest = readManifest(outDir);
  if (typeof manifest === 'string') return { problems: [], readError: manifest };
  /** @type {string[]} */
  const problems = [];
  checkManifest(manifest, problems);
  checkInventory(outDir, manifest, problems);
  checkBundle(outDir, problems);
  return { problems };
}

/** @returns {number} the exit code */
function main() {
  const repo = resolve(fileURLToPath(new URL('..', import.meta.url)));
  const { problems, readError } = checkExtension(join(repo, '.output', 'chrome-mv3'));
  if (readError !== undefined) {
    console.error(`check-manifest: ${readError} — run \`npm run build\` first.`);
    return 1;
  }
  if (problems.length > 0) {
    for (const problem of problems) {
      console.error(`::error::check-manifest: ${problem}`);
      console.error(`  ${problem}`);
    }
    console.error('\nSee CLAUDE.md hard rule 1 and docs/09 §4 before changing this.');
    return 1;
  }
  // Constants only: the manifest has just passed every check, so its values ARE
  // these — and nothing read from a file is echoed into the log.
  console.warn(
    `check-manifest: clean — MV3, permissions exactly ${ALLOWED_PERMISSIONS.join(' + ')}, Chrome ≥${CHROME_FLOOR}, CSP pinned, inventory complete, no network API in the bundle.`,
  );
  return 0;
}

// Run only as the entry point. Under a test runner `import.meta.url` may not
// even be a file: URL, so it is not resolved until it is known to be one.
const isEntry =
  import.meta.url.startsWith('file:') &&
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isEntry) {
  // exitCode, not exit(): exit() can cut off piped stderr before CI reads it.
  process.exitCode = main();
}
