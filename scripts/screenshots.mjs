#!/usr/bin/env node
// @ts-check
/**
 * Screenshot harness — docs/13 §2, docs/11 §5.
 *
 * Serves the BUILT extension (`.output/chrome-mv3`) over localhost with a fake
 * `chrome` object and neutral sample bookmarks, so every page can be looked at
 * — and photographed for the store listing — without loading the extension or
 * exposing anyone's real bookmarks. Each HTML response also carries the
 * production CSP as a meta tag, so a violation shows up in the console here
 * exactly as it would in the extension.
 *
 *   npm run build && node scripts/screenshots.mjs           # serve on :4318
 *   node scripts/screenshots.mjs --shoot                    # also capture PNGs
 *
 * Page URLs take `?theme=light|dark&lang=en|vi|ja&legal=0|1`, and the route as
 * the hash: http://localhost:4318/manager.html?theme=dark&lang=vi#edit
 *
 * `--shoot` drives a locally installed Chrome (CHROME_PATH, or the usual
 * install paths) headless, on a throwaway profile — never the user's own:
 * every route × theme × language at 1280×800 into `.output/qa-screens/` (for
 * review, git-ignored), the README set into `capture/`, and the store set into
 * `store/screenshots/`. Dev tool only: nothing here ships, the server listens
 * on 127.0.0.1 alone, and it never touches the network beyond it.
 */
import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const OUT = join(ROOT, '.output', 'chrome-mv3');
const PORT = Number(process.env.PORT ?? 4318);
/** Loopback only: the harness serves the build and a fake API to this machine, nobody else. */
const HOST = '127.0.0.1';
const TYPES = /** @type {Record<string, string>} */ ({
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
});

/** The CSP the production manifest declares, read from the build itself. */
function productionCsp() {
  const manifest = JSON.parse(readFileSync(join(OUT, 'manifest.json'), 'utf8'));
  return String(manifest.content_security_policy?.extension_pages ?? "script-src 'self'");
}

/** The fake `chrome`, as a classic script that runs before the page's modules. */
function shim() {
  const manifest = readFileSync(join(OUT, 'manifest.json'), 'utf8');
  return `(() => {
  const q = new URLSearchParams(location.search);
  const manifest = ${manifest};
  const listeners = () => { const set = new Set(); return { addListener: (f) => set.add(f), removeListener: (f) => set.delete(f), fire: (...a) => set.forEach((f) => f(...a)) }; };
  let next = 100;
  const day = 86400000, base = Date.UTC(2026, 6, 1);
  const b = (title, url, age = 1) => ({ id: String(next++), title, url, dateAdded: base - age * day });
  const f = (title, children, age = 30) => ({ id: String(next++), title, dateAdded: base - age * day, dateGroupModified: base, children });
  const tree = [{ id: '0', title: '', children: [
    { id: '1', title: 'Bookmarks bar', children: [
      b('Docs', 'https://docs.example.org/'), b('Calendar', 'https://calendar.example.com/'),
      f('Dev', [b('Repository', 'https://code.example.dev/project'), b('CI dashboard', 'https://ci.example.dev/'),
        f('Reference', [b('Language spec', 'https://spec.example.org/latest'), b('Style guide', 'https://style.example.org/'), b('Repository', 'https://code.example.dev/project')])]),
      f('Reading', [b('Long read about distributed systems and the people who keep them running', 'https://essays.example.net/systems'), b('Weekly notes', 'https://notes.example.net/week-27')]),
      b('', 'https://untitled.example.com/'),
    ] },
    { id: '2', title: 'Other bookmarks', children: [
      f('Recipes', [b('Bread', 'https://kitchen.example.com/bread'), b('Soup', 'https://kitchen.example.com/soup')]),
      f('Travel', [b('Rail map', 'https://rail.example.org/map'), b('Hostels', 'https://stay.example.org/')]),
      b('Bookmarklet', 'javascript:void(0)'), b('Docs', 'https://docs.example.org/'),
    ] },
    { id: '3', title: 'Mobile bookmarks', children: [b('Read later', 'https://later.example.com/')] },
  ] }];
  const byId = (id, nodes = tree) => { for (const n of nodes) { if (n.id === id) return n; const hit = n.children && byId(id, n.children); if (hit) return hit; } };
  const parentOf = (id, nodes = tree) => { for (const n of nodes) { if (n.children?.some((c) => c.id === id)) return n; const hit = n.children && parentOf(id, n.children); if (hit) return hit; } };
  const clone = (v) => structuredClone(v);
  const events = { onCreated: listeners(), onRemoved: listeners(), onChanged: listeners(), onMoved: listeners(), onChildrenReordered: listeners(), onImportBegan: listeners(), onImportEnded: listeners() };
  const bookmarks = { ...events,
    getTree: async () => clone(tree),
    create: async ({ parentId, title, url, index }) => { const p = byId(parentId); const n = url ? { id: String(next++), parentId, title, url, dateAdded: Date.now() } : { id: String(next++), parentId, title, dateAdded: Date.now(), children: [] }; const at = index ?? p.children.length; p.children.splice(at, 0, n); events.onCreated.fire(n.id, clone({ ...n, index: at })); return clone(n); },
    update: async (id, changes) => { Object.assign(byId(id), changes); events.onChanged.fire(id, changes); },
    move: async (id, { parentId, index }) => { const from = parentOf(id); const n = byId(id); const old = from.children.indexOf(n); from.children.splice(old, 1); const to = byId(parentId ?? from.id); let at = index ?? to.children.length; if (to === from && at > old) at--; to.children.splice(at, 0, n); events.onMoved.fire(id, { parentId: to.id, index: at, oldParentId: from.id, oldIndex: old }); },
    remove: async (id) => { const p = parentOf(id); p.children = p.children.filter((c) => c.id !== id); events.onRemoved.fire(id, {}); },
  };
  bookmarks.removeTree = bookmarks.remove;
  const area = (seed = {}) => { const data = { ...seed }; const changed = listeners(); return { data, changed,
    get: async (keys) => { if (keys == null) return clone(data); const list = typeof keys === 'string' ? [keys] : Array.isArray(keys) ? keys : Object.keys(keys); return Object.fromEntries(list.filter((k) => k in data).map((k) => [k, clone(data[k])])); },
    set: async (items) => { Object.assign(data, clone(items)); }, remove: async (keys) => { for (const k of [].concat(keys)) delete data[k]; }, clear: async () => { for (const k of Object.keys(data)) delete data[k]; } }; };
  const lang = q.get('lang') ?? 'en';
  const local = area({
    settings: { theme: q.get('theme') ?? 'light', locale: lang, defaultExportFormat: 'netscape-html', defaultMergeMode: 'new-folder', csvDelimiter: ',', markdownStyle: 'nested' },
    ...(q.get('legal') === '0' ? {} : { legal: { acceptedVersion: 1, acceptedAt: '2026-07-26T09:00:00.000Z' } }),
  });
  const storage = { local, sync: area(), session: area(), onChanged: listeners() };
  globalThis.chrome = {
    bookmarks, storage,
    runtime: { id: 'harness', getManifest: () => manifest, getURL: (p) => location.origin + (p.startsWith('/') ? p : '/' + p), getContexts: async () => [], lastError: undefined },
    i18n: { getUILanguage: () => lang, getMessage: (k) => k },
    tabs: { create: async () => ({}), update: async () => ({}), getCurrent: async () => ({ id: 1 }) },
    windows: { update: async () => ({}) },
  };
})();`;
}

/**
 * Every file of the build, by the URL path that serves it. A request is looked
 * up here and never joined onto a directory, so no request can name a file
 * outside the build — `..`, encoded separators and prefix tricks included.
 * (A prefix check after `join` did the same job, but SonarCloud's taint
 * analysis, S2083, cannot see it; an allowlist it can.)
 *
 * @returns {Map<string, string>}
 */
function buildIndex() {
  const index = new Map();
  /** @param {string} dir */
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else index.set(`/${relative(OUT, full).split(sep).join('/')}`, full);
    }
  };
  walk(OUT);
  return index;
}

function serve() {
  const csp = productionCsp();
  let files = buildIndex();
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', `http://${HOST}:${PORT}`);
    if (url.pathname === '/__shim.js') {
      res.writeHead(200, { 'content-type': TYPES['.js'] ?? '' }).end(shim());
      return;
    }
    let decoded;
    try {
      decoded = decodeURIComponent(url.pathname);
    } catch {
      // A malformed escape (`%E0%A4%A`) used to throw out of the handler.
      res.writeHead(400).end('bad request');
      return;
    }
    // A rebuild while the harness runs renames the hashed chunks: re-list once.
    if (!files.has(decoded)) files = buildIndex();
    const path = files.get(decoded);
    if (path === undefined) {
      res.writeHead(404).end('not found');
      return;
    }
    const type = TYPES[extname(path)] ?? 'application/octet-stream';
    let body = readFileSync(path);
    if (type.startsWith('text/html')) {
      const tags = `<meta http-equiv="Content-Security-Policy" content="${csp}"><script src="/__shim.js"></script>`;
      body = Buffer.from(body.toString('utf8').replace('<head>', `<head>${tags}`));
    }
    res.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' }).end(body);
  });
  server.listen(PORT, HOST, () =>
    console.log(`harness: http://${HOST}:${PORT}/manager.html#import`),
  );
  return server;
}

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ];
  return candidates.find((path) => path !== undefined && existsSync(path));
}

/**
 * One headless screenshot. Asynchronous on purpose: the server answering
 * Chrome's requests runs in this same process, and 1.1.0's first cut used
 * `execFileSync`, which blocked the event loop — Chrome waited for a page the
 * blocked server could never send, and `--shoot` hung forever.
 *
 * @param {string} chrome @param {string} profile @param {string} url
 * @param {string} file @param {string} size
 */
async function shoot(chrome, profile, url, file, size) {
  await run(
    chrome,
    [
      '--headless=new',
      `--user-data-dir=${profile}`,
      '--no-first-run',
      '--disable-gpu',
      '--hide-scrollbars',
      `--window-size=${size}`,
      '--virtual-time-budget=4000',
      `--screenshot=${file}`,
      url,
    ],
    { timeout: 60_000 },
  );
}

if (!existsSync(join(OUT, 'manifest.json'))) {
  console.error('harness: no build found — run `npm run build` first.');
  process.exitCode = 1;
} else {
  const server = serve();
  if (process.argv.includes('--shoot')) {
    const chrome = findChrome();
    if (chrome === undefined) {
      console.error('harness: no Chrome found — set CHROME_PATH.');
      process.exitCode = 1;
      server.close();
    } else {
      const qa = join(OUT, '..', 'qa-screens');
      const capture = join(ROOT, 'capture');
      const store = join(ROOT, 'store', 'screenshots');
      for (const dir of [qa, capture, store]) mkdirSync(dir, { recursive: true });
      const profile = mkdtempSync(join(tmpdir(), 'bookmarkmagic-harness-'));
      const page = (/** @type {string} */ query, /** @type {string} */ route) =>
        `http://${HOST}:${PORT}/manager.html?${query}#${route}`;
      const ROUTES = ['import', 'export', 'edit', 'settings', 'about'];
      try {
        for (const lang of ['en', 'vi', 'ja']) {
          for (const theme of ['light', 'dark']) {
            for (const route of ROUTES) {
              const file = join(qa, `${route}-${theme}-${lang}.png`);
              await shoot(
                chrome,
                profile,
                page(`theme=${theme}&lang=${lang}`, route),
                file,
                '1280,800',
              );
            }
          }
        }
        for (const route of ROUTES) {
          await shoot(
            chrome,
            profile,
            page('theme=light&lang=en', route),
            join(capture, `${route}.png`),
            '1280,800',
          );
        }
        for (const route of ['edit', 'export', 'import']) {
          await shoot(
            chrome,
            profile,
            page('theme=dark&lang=en', route),
            join(store, `${route}.png`),
            '1280,800',
          );
        }
        await shoot(
          chrome,
          profile,
          `http://${HOST}:${PORT}/popup.html?theme=light&lang=en`,
          join(capture, 'popup.png'),
          '360,420',
        );
      } finally {
        rmSync(profile, { recursive: true, force: true });
        server.close();
      }
      console.log(`harness: screenshots in ${qa}, ${capture} and ${store}`);
    }
  }
}
