// @ts-check
/**
 * The zero-network / no-raw-HTML gate — docs/08 §3.
 *
 * This file IS the rule set; docs/08 §3 points here instead of restating it,
 * because two copies of a security pattern drift (they did: the doc's
 * `\{@html\}` matched only the literal `{@html}`, never `{@html x}`).
 *
 * It runs locally (`npm run verify`) and in CI (`npm run guard`), so the gate
 * cannot differ between the two. Zero dependencies, Node stdlib only.
 *
 * It is no longer the ONLY enforcement: since v1.1.0 the production manifest
 * declares a CSP with `connect-src 'none'` (docs/08 §3), so the browser itself
 * refuses fetch/XHR/WebSocket/EventSource/beacons. This gate catches the rest —
 * raw HTML sinks, code execution, remote resources in markup and CSS — and
 * keeps network code out of review in the first place.
 *
 * Matching runs over the WHOLE file, not line by line, so `\s*` spans newlines
 * and splitting a call across two lines no longer gets past a rule. Identifiers
 * are banned outright where an alias would otherwise slip through
 * (`const go = fetch; go(u)`), which means the bare words are banned in
 * comments too — write "network call", not the API name, in prose.
 *
 * Usage: node scripts/guard.mjs [--root <dir>]   (--root is for its own tests)
 */
import { readFileSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * fileURLToPath, never `new URL(...).pathname`: the pathname stays
 * percent-encoded, so a checkout under `C:\Users\Nguyễn\…` or `my dir` became a
 * path that does not exist — and the walker reported "clean" after scanning
 * nothing.
 */
const DEFAULT_ROOT = fileURLToPath(new URL('..', import.meta.url));

const SCAN_DIRS = ['src'];
const SCAN_EXTS = new Set([
  '.ts',
  '.mts',
  '.cts',
  '.js',
  '.mjs',
  '.cjs',
  '.svelte',
  '.html',
  '.css',
]);
const SKIP_DIRS = new Set(['node_modules', '.output', '.wxt', '.git']);

/** A URL that leaves the extension: `https://`, `http://` or protocol-relative `//`. */
const REMOTE = String.raw`(?:https?:)?\/\/`;

/**
 * [category, name, pattern, refine?]. Every pattern carries the `g` flag and is
 * run over the whole file; when `refine` is present, a match only counts if
 * `refine` also matches the matched text. Each rule has a positive and a
 * negative case in tests/unit/scripts/guard.test.ts — add both when adding one.
 *
 * No pattern may let two quantifiers compete for the same characters (a
 * `\s*` beside an optional quote beside another `\s*`): that backtracks
 * polynomially (SonarCloud S8786), and this script scans whatever lands in src/.
 */
const RULES = [
  // Network. Identifiers, not call shapes: aliasing, tagged templates and
  // `.call()` all start with the bare name.
  ['network', 'fetch', /\bfetch\b/g],
  ['network', 'XMLHttpRequest', /\bXMLHttpRequest\b/g],
  ['network', 'WebSocket', /\bWebSocket\b/g],
  ['network', 'WebTransport', /\bWebTransport\b/g],
  ['network', 'EventSource', /\bEventSource\b/g],
  ['network', 'sendBeacon', /\bsendBeacon\b/g],
  ['network', 'RTCPeerConnection', /\bRTCPeerConnection\b/g],
  ['network', 'importScripts', /\bimportScripts\b/g],
  // `globalThis['fe' + 'tch']` — computed access on a global is how every
  // identifier rule above is evaded, so it is banned as a shape, optional
  // chaining included (`globalThis?.['fe' + 'tch']` got through until v1.1.0).
  [
    'network',
    'computed global access',
    /\b(?:globalThis|window|self|navigator|document)(?:\s*\?\.)?\s*\[/g,
  ],
  // Resource hints fetch ahead of time. These words have no use in this
  // extension, so they are banned outright; `preload` is ordinary English, so
  // only as a rel value.
  [
    'network',
    'resource hint',
    /\b(?:prefetch|preconnect|prerender|dns-prefetch|modulepreload)\b|\brel\s*=\s*["'`]?preload\b/gi,
  ],
  // Two linear steps: find a resource-loading tag, then look inside it.
  [
    'network',
    'remote resource in markup',
    /<(?:img|script|iframe|frame|link|source|video|audio|embed|object|track|image)\b[^>]*>/gi,
    new RegExp(String.raw`\b(?:src|href|srcset|data|poster)\s*=\s*(?:["'{]\s*)?` + REMOTE, 'i'),
  ],
  ['network', 'remote url() in CSS', new RegExp(String.raw`url\(\s*(?:["']\s*)?` + REMOTE, 'gi')],
  [
    'network',
    'remote @import',
    new RegExp(String.raw`@import\s+(?:url\(\s*)?(?:["']\s*)?` + REMOTE, 'gi'),
  ],
  // Remote code.
  ['remote code', 'eval', /\beval\b/g],
  ['remote code', 'Function constructor', /\bFunction\s*\(/g],
  ['remote code', 'string timer', /\bset(?:Timeout|Interval)\s*\(\s*["'`]/g],
  // `[ \t]*`, not `\s*`: prose that ends a line with "import" and opens the
  // next with "(" is common in comments, and the MV3 CSP already refuses any
  // remote script, so this rule is a second line of defence, not the only one.
  ['remote code', 'dynamic import', /(?:^|[^.\w$])import[ \t]*\(/g],
  [
    'remote code',
    'import from URL',
    new RegExp(String.raw`\b(?:from|import)\s+["']` + REMOTE, 'g'),
  ],
  // Raw HTML sinks.
  ['raw HTML', '{@html}', /\{\s*@html\b/g],
  ['raw HTML', 'innerHTML / outerHTML', /\b(?:inner|outer)HTML\b/g],
  ['raw HTML', 'insertAdjacentHTML', /\binsertAdjacentHTML\b/g],
  ['raw HTML', 'setHTMLUnsafe / parseHTMLUnsafe', /\b(?:set|parse)HTMLUnsafe\b/g],
  ['raw HTML', 'createContextualFragment', /\bcreateContextualFragment\b/g],
  ['raw HTML', 'srcdoc', /\bsrcdoc\b/gi],
  ['raw HTML', 'document.write', /\bdocument\s*\.\s*write(?:ln)?\b/g],
  // Evasion. Every rule above matches a NAME; these are the ways of using a
  // member without writing its name. `Reflect.get(globalThis, 'fe' + 'tch')`
  // and `Reflect.set(el, 'outer' + 'HTML', h)` reach anything, and nothing
  // here needs Reflect at all.
  ['evasion', 'Reflect', /\bReflect\b/g],
  // `el['inner' + 'HTML']`, `el?.[`inner${x}`]`: a member name assembled at
  // runtime is only ever written to hide it. Only after something a member
  // access can follow (an identifier, `)`, `]`, `?.`), so array literals such
  // as `[`.${ext}`]` stay allowed.
  [
    'evasion',
    'assembled member name',
    /[\w$)\].]\s*\[\s*(?:(?:'[^'\n]*'|"[^"\n]*"|`[^`\n]*`)\s*\+|`[^`\n]*\$\{)/g,
  ],
];

/** @param {string[]} argv */
function rootFrom(argv) {
  const at = argv.indexOf('--root');
  if (at === -1) return DEFAULT_ROOT;
  const value = argv[at + 1];
  if (value === undefined || value.startsWith('--')) {
    console.error('guard: --root needs a directory');
    process.exit(2);
  }
  return resolve(value);
}

/**
 * @param {string} dir
 * @returns {AsyncGenerator<string>}
 */
async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) yield* walk(full);
    } else if (SCAN_EXTS.has(extname(entry.name))) {
      yield full;
    }
  }
}

/**
 * Every rule over one file's text.
 * @param {string} text
 * @returns {{ line: number, name: string, category: string, excerpt: string }[]}
 */
function scan(text) {
  const lines = text.split('\n');
  const lineStarts = [0];
  for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 0x0a) lineStarts.push(i + 1);
  /** @param {number} index */
  const lineOf = (index) => {
    let lo = 0;
    let hi = lineStarts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if ((lineStarts[mid] ?? 0) <= index) lo = mid;
      else hi = mid - 1;
    }
    return lo + 1;
  };

  const found = [];
  const seen = new Set();
  for (const [category, name, pattern, refine] of RULES) {
    for (const match of text.matchAll(/** @type {RegExp} */ (pattern))) {
      if (refine instanceof RegExp && !refine.test(match[0])) continue;
      const line = lineOf(match.index ?? 0);
      const key = `${line}\u0000${name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const excerpt = (lines[line - 1] ?? '').trim().slice(0, 120);
      found.push({
        line,
        name: /** @type {string} */ (name),
        category: /** @type {string} */ (category),
        excerpt,
      });
    }
  }
  return found;
}

const root = rootFrom(process.argv.slice(2));
const violations = [];
let scanned = 0;

for (const dir of SCAN_DIRS) {
  const base = join(root, dir);
  try {
    for await (const file of walk(base)) {
      scanned++;
      const rel = relative(root, file).replace(/\\/g, '/');
      const text = readFileSync(file, 'utf8').replace(/\r\n?/g, '\n');
      for (const hit of scan(text)) violations.push({ rel, ...hit });
    }
  } catch (cause) {
    // A missing src/ used to be "nothing to scan" and printed clean. A gate
    // that cannot see the code has not passed it.
    console.error(`guard: cannot scan ${base} — ${cause instanceof Error ? cause.message : cause}`);
    process.exitCode = 1;
  }
}

if (process.exitCode !== 1 && scanned === 0) {
  console.error(`guard: scanned 0 files under ${root} — refusing to report clean.`);
  process.exitCode = 1;
}

if (violations.length > 0) {
  for (const v of violations) {
    console.error(`::error file=${v.rel},line=${v.line}::[${v.category}: ${v.name}] ${v.excerpt}`);
    console.error(`  ${v.rel}:${v.line}  ${v.category}: ${v.name}\n    ${v.excerpt}`);
  }
  console.error(`\nguard: ${violations.length} banned pattern(s). See docs/08 §3.`);
  process.exitCode = 1;
}

if (process.exitCode !== 1) {
  console.warn(
    `guard: clean — ${scanned} files under ${SCAN_DIRS.join(', ')}, ${RULES.length} rules`,
  );
}
