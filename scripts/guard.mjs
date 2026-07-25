/**
 * The canonical grep gate — docs/08_MV3_COMPLIANCE.md §3.
 *
 * This file is the single implementation of that pattern. It runs both locally
 * (`npm run verify`) and in CI (`npm run guard`), so the gate cannot drift
 * between the two. Zero dependencies, Node stdlib only.
 *
 * Why a grep and not a lint rule: MV3's default CSP blocks remote code, but it
 * has no connect-src at all and does not restrict network egress. And no Biome
 * rule sees Svelte's {@html} — noDangerouslySetInnerHtml is a React rule. This
 * script plus review is the entire enforcement of the zero-network and
 * no-raw-HTML promises.
 */
import { readFileSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const SCAN_DIRS = ['src'];
const SCAN_EXTS = new Set(['.ts', '.js', '.mjs', '.svelte']);
const SKIP_DIRS = new Set(['node_modules', '.output', '.wxt', '.git']);

/** Each entry: [human-readable name, pattern]. Keep in sync with docs/08 §3. */
const BANNED = [
  ['network: fetch', /\bfetch\s*\(/],
  ['network: XMLHttpRequest', /\bXMLHttpRequest\b/],
  ['network: WebSocket', /\bWebSocket\b/],
  ['network: EventSource', /\bEventSource\b/],
  ['network: sendBeacon', /\bsendBeacon\b/],
  ['remote code: eval', /\beval\s*\(/],
  ['remote code: new Function', /\bnew\s+Function\s*\(/],
  ['remote code: dynamic import', /(^|[^.\w])import\s*\(/],
  ['raw HTML: {@html}', /\{@html\b/],
  ['raw HTML: innerHTML assignment', /\b(?:inner|outer)HTML\s*=/],
  ['raw HTML: insertAdjacentHTML', /\binsertAdjacentHTML\b/],
];

/** Test files may reference banned identifiers when asserting they are absent. */
const isExempt = (path) => /\.(test|spec)\.ts$/.test(path);

async function* walk(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return; // directory not created yet — nothing to scan
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) yield* walk(full);
    } else if (SCAN_EXTS.has(extname(entry.name))) {
      yield full;
    }
  }
}

const violations = [];

for (const dir of SCAN_DIRS) {
  for await (const file of walk(join(ROOT, dir))) {
    const rel = relative(ROOT, file).replace(/\\/g, '/');
    if (isExempt(rel)) continue;
    const lines = readFileSync(file, 'utf8').split(/\r?\n/);
    lines.forEach((line, i) => {
      for (const [name, pattern] of BANNED) {
        if (pattern.test(line)) violations.push({ rel, line: i + 1, name, text: line.trim() });
      }
    });
  }
}

if (violations.length > 0) {
  for (const v of violations) {
    console.error(`::error file=${v.rel},line=${v.line}::[${v.name}] ${v.text}`);
    console.error(`  ${v.rel}:${v.line}  ${v.name}\n    ${v.text}`);
  }
  console.error(
    `\nguard: ${violations.length} banned pattern(s) found. See docs/08_MV3_COMPLIANCE.md §3.`,
  );
  process.exit(1);
}

console.warn(`guard: clean — no banned patterns in ${SCAN_DIRS.join(', ')}`);
