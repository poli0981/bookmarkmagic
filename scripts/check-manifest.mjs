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
 *      (WXT drops `_locales/` and `icon/` silently when publicDir is wrong);
 *   3. the bundle: no network API anywhere in the shipped JavaScript.
 *
 * Usage: node scripts/check-manifest.mjs [<extension dir>]
 *   default: <repo>/.output/chrome-mv3 (resolved from this file, not the cwd)
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(fileURLToPath(new URL('..', import.meta.url)));

/** Exactly this, in any order. Adding one is a minor-version event (docs/09 §4). */
const ALLOWED_PERMISSIONS = ['bookmarks', 'storage'];

/** The ES2025 floor (docs/01 §1). Must equal CHROME_FLOOR in wxt.config.ts. */
const CHROME_FLOOR = '136';

/**
 * The production extension-page CSP (docs/08 §3), character for character.
 * It may only ever get stricter. Never add 'unsafe-eval' or a remote source.
 */
const EXPECTED_CSP =
  "script-src 'self'; object-src 'none'; connect-src 'none'; img-src 'self' data: blob:; " +
  "style-src 'self' 'unsafe-inline'; font-src 'self'; media-src 'none'; frame-src 'none'; " +
  "worker-src 'self'; form-action 'none'; base-uri 'none'";

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
  '_locales/en/messages.json',
  '_locales/vi/messages.json',
  '_locales/ja/messages.json',
];

/**
 * Network APIs that must not appear in the shipped JavaScript — including code
 * that arrived through a dependency, which `npm run guard` (source only) never
 * sees. The CSP would refuse these at runtime; this refuses to ship them.
 */
const NETWORK_IN_BUNDLE =
  /\bfetch\s*\(|\bXMLHttpRequest\b|\bWebSocket\b|\bEventSource\b|\bsendBeacon\b|\bWebTransport\b/;

/** @param {string} a @param {string} b */
const byName = (a, b) => a.localeCompare(b, 'en');

/**
 * The directory to check. An argument is accepted only inside this repository
 * or the OS temp directory (where its own tests build fake extensions): the
 * script reads every file below it, so it must never be pointed elsewhere.
 *
 * @param {string | undefined} arg
 * @returns {string | undefined}
 */
function outDirFrom(arg) {
  const dir = resolve(arg ?? join(REPO, '.output', 'chrome-mv3'));
  const bases = [REPO, resolve(tmpdir())];
  return bases.some((base) => dir === base || dir.startsWith(base + sep)) ? dir : undefined;
}

/** @param {string} dir @returns {string[]} */
function listFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    return entry.isDirectory() ? listFiles(full) : [full];
  });
}

/**
 * @param {string} outDir
 * @returns {Record<string, unknown> | undefined}
 */
function readManifest(outDir) {
  const path = join(outDir, 'manifest.json');
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (cause) {
    console.error(`check-manifest: cannot read ${path} — run \`npm run build\` first.`);
    console.error(`  ${cause instanceof Error ? cause.message : cause}`);
    return undefined;
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

/** @param {string} outDir @param {Record<string, unknown>} manifest @param {string[]} problems */
function checkInventory(outDir, manifest, problems) {
  for (const file of [...REQUIRED_FILES, ...referencedFiles(manifest)]) {
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

/** @param {string} outDir @returns {number} the exit code */
function run(outDir) {
  const manifest = readManifest(outDir);
  if (manifest === undefined) return 1;

  /** @type {string[]} */
  const problems = [];
  checkManifest(manifest, problems);
  checkInventory(outDir, manifest, problems);
  checkBundle(outDir, problems);

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

const outDir = outDirFrom(process.argv[2]);
if (outDir === undefined) {
  console.error('check-manifest: refusing to read outside this repository or the temp directory.');
  process.exitCode = 1;
} else {
  // exitCode, not exit(): exit() can cut off piped stderr before CI reads it.
  process.exitCode = run(outDir);
}
