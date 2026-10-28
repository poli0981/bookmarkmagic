// @vitest-environment node
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

/**
 * scripts/guard.mjs is the zero-network / no-raw-HTML gate (docs/08 §3). Until
 * v1.1.0 nothing tested it: an audit ran its exact patterns against 28 bypasses
 * and every one got through, and a checkout path with a space or a diacritic
 * made it scan nothing and print "clean".
 *
 * Each case writes a throwaway src/ tree and runs the real script on it.
 */

const GUARD = join(process.cwd(), 'scripts', 'guard.mjs');
const roots: string[] = [];

function makeRoot(files: Record<string, string>, dirName = 'guard-'): string {
  const root = mkdtempSync(join(tmpdir(), dirName));
  roots.push(root);
  for (const [rel, content] of Object.entries(files)) {
    const path = join(root, rel);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  }
  return root;
}

function runGuard(root: string): { status: number | null; output: string } {
  const result = spawnSync(process.execPath, [GUARD, '--root', root], { encoding: 'utf8' });
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

/** [what it is, file name, content, rule name the output must mention]. */
const BANNED: readonly (readonly [string, string, string, string])[] = [
  ['a direct call', 'a.ts', 'fetch(u);', 'fetch'],
  ['an alias', 'a.ts', 'const go = fetch;\ngo(u);', 'fetch'],
  ['a tagged template', 'a.ts', 'fetch`https://x.example/`;', 'fetch'],
  ['.call()', 'a.ts', 'fetch.call(null, u);', 'fetch'],
  ['a call split over two lines', 'a.ts', 'fetch\n  (u);', 'fetch'],
  ['XMLHttpRequest', 'a.ts', 'new XMLHttpRequest();', 'XMLHttpRequest'],
  ['WebSocket', 'a.ts', "new WebSocket('wss://x.example');", 'WebSocket'],
  ['WebTransport', 'a.ts', 'new WebTransport(u);', 'WebTransport'],
  ['EventSource', 'a.ts', 'new EventSource(u);', 'EventSource'],
  ['sendBeacon', 'a.ts', 'navigator.sendBeacon(u, d);', 'sendBeacon'],
  ['RTCPeerConnection', 'a.ts', 'new RTCPeerConnection({ iceServers: [] });', 'RTCPeerConnection'],
  ['importScripts', 'a.ts', "importScripts('x.js');", 'importScripts'],
  ['computed globalThis access', 'a.ts', "globalThis['fe' + 'tch'](u);", 'computed global access'],
  [
    'computed navigator access',
    'a.ts',
    "navigator['send' + 'Beacon'](u);",
    'computed global access',
  ],
  [
    'computed window access',
    'a.ts',
    "new (window['XMLHttp' + 'Request'])();",
    'computed global access',
  ],
  ['a prefetch hint in markup', 'a.svelte', '<link rel="prefetch" href="/x">', 'resource hint'],
  ['a prefetch hint in code', 'a.ts', "link.rel = 'prefetch';", 'resource hint'],
  ['a preload rel', 'a.ts', "link.rel = 'preload';", 'resource hint'],
  ['a dns-prefetch hint', 'a.html', '<link rel="dns-prefetch" href="/x">', 'resource hint'],
  ['a remote <img>', 'a.svelte', '<img src="https://x.example/a.png" alt="">', 'remote resource'],
  [
    'a remote <img> padded inside its quotes',
    'a.svelte',
    '<img src=" https://x.example/a.png">',
    'remote resource',
  ],
  ['a protocol-relative <script>', 'a.html', '<script src="//x.example/a.js"></script>', 'remote'],
  ['a remote url() in CSS', 'a.css', 'a { background: url(https://x.example/a.png); }', 'url()'],
  ['a remote @import', 'a.css', '@import url("https://fonts.example/a.css");', '@import'],
  ['eval', 'a.ts', 'eval(s);', 'eval'],
  ['indirect eval', 'a.ts', '(0, eval)(s);', 'eval'],
  ['optional-chained eval', 'a.ts', 'globalThis.eval?.(s);', 'eval'],
  ['new Function', 'a.ts', "new Function('return 1');", 'Function constructor'],
  ['bare Function()', 'a.ts', "Function('return 1')();", 'Function constructor'],
  ['a string setTimeout', 'a.ts', "setTimeout('run()', 0);", 'string timer'],
  ['a dynamic import', 'a.ts', "await import('./x');", 'dynamic import'],
  ['an import from a URL', 'a.ts', "import x from 'https://x.example/m.js';", 'import from URL'],
  ['innerHTML assignment', 'a.ts', 'el.innerHTML = h;', 'innerHTML'],
  ['innerHTML +=', 'a.ts', 'el.innerHTML += h;', 'innerHTML'],
  ['bracket innerHTML', 'a.ts', "el['innerHTML'] = h;", 'innerHTML'],
  ['innerHTML via Object.assign', 'a.ts', 'Object.assign(el, { innerHTML: h });', 'innerHTML'],
  ['outerHTML', 'a.ts', 'el.outerHTML = h;', 'innerHTML / outerHTML'],
  ['insertAdjacentHTML', 'a.ts', "el.insertAdjacentHTML('beforeend', h);", 'insertAdjacentHTML'],
  ['setHTMLUnsafe', 'a.ts', 'el.setHTMLUnsafe(h);', 'setHTMLUnsafe'],
  [
    'createContextualFragment',
    'a.ts',
    'range.createContextualFragment(h);',
    'createContextualFragment',
  ],
  ['srcdoc', 'a.ts', 'frame.srcdoc = h;', 'srcdoc'],
  ['document.write', 'a.ts', 'document.write(h);', 'document.write'],
  ['{@html}', 'a.svelte', '<p>{@html h}</p>', '{@html}'],
  ['{ @html } with a space', 'a.svelte', '<p>{ @html h }</p>', '{@html}'],
];

describe('guard.mjs — banned patterns', () => {
  it.each(BANNED)('fails on %s', (_label, file, content, rule) => {
    const { status, output } = runGuard(makeRoot({ [`src/${file}`]: content }));
    expect(status, output).toBe(1);
    expect(output).toContain(rule);
  });

  it('scans test-named files inside src/ too (no exemption)', () => {
    // The old `*.test.ts` exemption could only ever skip files inside src/.
    const { status } = runGuard(makeRoot({ 'src/x.test.ts': 'fetch(u);' }));
    expect(status).toBe(1);
  });

  it('reports the line of a match', () => {
    const { output } = runGuard(makeRoot({ 'src/a.ts': 'const a = 1;\n\nel.innerHTML = h;\n' }));
    expect(output).toContain('src/a.ts:3');
  });
});

describe('guard.mjs — things that must stay allowed', () => {
  const ALLOWED: Record<string, string> = {
    'src/links.ts': "export const REPO = 'https://github.com/poli0981/bookmarkmagic';",
    'src/Link.svelte':
      '<a href="https://github.com/x" target="_blank" rel="noopener noreferrer">x</a>',
    'src/download.ts': "anchor.rel = 'noopener';\nlocation.hash = '#edit';",
    'src/base.css': "@import './tokens.css';\na { background: url(./icon.svg); }",
    'src/words.ts': [
      'const prefetched = 1;',
      'const evaluate = () => 0;',
      'const importance = 2;',
      'function myFunction() {}',
      'const transport = "web";',
      '// "network calls are banned" — prose without the API names',
    ].join('\n'),
  };

  it('passes a tree full of near-misses', () => {
    const { status, output } = runGuard(makeRoot(ALLOWED));
    expect(status, output).toBe(0);
    expect(output).toContain('guard: clean — 5 files');
  });
});

describe('guard.mjs — refuses to pass what it could not see', () => {
  it('fails when src/ is missing', () => {
    const { status, output } = runGuard(makeRoot({ 'README.md': 'x' }));
    expect(status).toBe(1);
    expect(output).toContain('cannot scan');
  });

  it('fails when src/ holds nothing it scans', () => {
    const { status, output } = runGuard(makeRoot({ 'src/notes.txt': 'fetch(u)' }));
    expect(status).toBe(1);
    expect(output).toContain('scanned 0 files');
  });

  it('scans a checkout whose path has a space and a diacritic', () => {
    // `new URL(...).pathname` stayed percent-encoded here, so the walker found
    // nothing and the gate printed "clean".
    const { status } = runGuard(makeRoot({ 'src/a.ts': 'fetch(u);' }, 'Nguyễn dir-'));
    expect(status).toBe(1);
  });

  it('passes the real src/ tree', () => {
    const result = spawnSync(process.execPath, [GUARD], { encoding: 'utf8' });
    expect(result.status, `${result.stdout}${result.stderr}`).toBe(0);
  });
});
