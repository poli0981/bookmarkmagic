/**
 * Assert the BUILT manifest — CLAUDE.md hard rule 1, docs/08 §2.
 *
 * The unit test in `tests/unit/manifest.test.ts` reads `wxt.config.ts`, which
 * proves what we ASKED for. It cannot prove what WXT emitted. Those differ:
 * a dev build of this exact config produces
 *   "permissions": ["bookmarks","storage","tabs","scripting"]
 *   "host_permissions": ["http://localhost/*"]
 * because WXT injects them for its dev server. Production is clean today, but
 * that is a property of WXT's dev/prod branch, not of anything this repo
 * enforces — so the shipped artifact needs its own gate.
 *
 * Run after `npm run build` (or `npm run zip`). Zero dependencies, Node stdlib.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const MANIFEST = join(process.cwd(), '.output', 'chrome-mv3', 'manifest.json');

/** Exactly this, in any order. Adding one is a minor-version event (docs/09 §4). */
const ALLOWED_PERMISSIONS = ['bookmarks', 'storage'];

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

let manifest;
try {
  manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
} catch (cause) {
  console.error(`check-manifest: cannot read ${MANIFEST} — run \`npm run build\` first.`);
  console.error(`  ${cause.message}`);
  process.exit(1);
}

const problems = [];

if (manifest.manifest_version !== 3) {
  problems.push(`manifest_version is ${manifest.manifest_version}, expected 3`);
}

const permissions = [...(manifest.permissions ?? [])].sort();
if (permissions.join(',') !== [...ALLOWED_PERMISSIONS].sort().join(',')) {
  problems.push(
    `permissions are ${JSON.stringify(manifest.permissions)}, expected ${JSON.stringify(ALLOWED_PERMISSIONS)}`,
  );
}

for (const key of FORBIDDEN_KEYS) {
  if (key in manifest) problems.push(`declares "${key}": ${JSON.stringify(manifest[key])}`);
}

if (problems.length > 0) {
  for (const problem of problems) {
    console.error(`::error::check-manifest: ${problem}`);
    console.error(`  ${problem}`);
  }
  console.error('\nSee CLAUDE.md hard rule 1 and docs/09 §4 before changing this.');
  process.exit(1);
}

console.warn(
  `check-manifest: clean — MV3, permissions ${JSON.stringify(manifest.permissions)}, no reach-widening keys.`,
);
