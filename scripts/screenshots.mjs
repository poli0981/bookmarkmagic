#!/usr/bin/env node
// @ts-check
/**
 * Screenshot harness — docs/13 §5, docs/11 §5.
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
 * install paths) in headless mode: every route × theme × language at 1280×800
 * into `capture/`, plus the store set into `store/screenshots/`. Dev tool only:
 * nothing here ships, and it never touches the network beyond localhost.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const OUT = join(ROOT, '.output', 'chrome-mv3');
const PORT = Number(process.env.PORT ?? 4318);
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
    tabs: { create: async () => ({}), update: async () => ({}) },
    windows: { update: async () => ({}) },
  };
})();`;
}

function serve() {
  const csp = productionCsp();
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
    if (url.pathname === '/__shim.js') {
      res.writeHead(200, { 'content-type': TYPES['.js'] ?? '' }).end(shim());
      return;
    }
    const path = normalize(join(OUT, decodeURIComponent(url.pathname)));
    if (!path.startsWith(OUT) || !existsSync(path)) {
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
  server.listen(PORT, () => console.log(`harness: http://localhost:${PORT}/manager.html#import`));
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

/** @param {string} chrome @param {string} url @param {string} file @param {string} size */
function shoot(chrome, url, file, size) {
  execFileSync(chrome, [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    `--window-size=${size}`,
    '--virtual-time-budget=4000',
    `--screenshot=${file}`,
    url,
  ]);
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
      const capture = join(ROOT, 'capture');
      const store = join(ROOT, 'store', 'screenshots');
      mkdirSync(capture, { recursive: true });
      mkdirSync(store, { recursive: true });
      for (const lang of ['en', 'vi', 'ja']) {
        for (const theme of ['light', 'dark']) {
          for (const route of ['import', 'export', 'edit', 'settings', 'about']) {
            const url = `http://localhost:${PORT}/manager.html?theme=${theme}&lang=${lang}#${route}`;
            shoot(chrome, url, join(capture, `${route}-${theme}-${lang}.png`), '1280,800');
          }
        }
      }
      for (const route of ['import', 'edit', 'export']) {
        const url = `http://localhost:${PORT}/manager.html?theme=light&lang=en#${route}`;
        shoot(chrome, url, join(store, `${route}.png`), '1280,800');
      }
      console.log(`harness: screenshots in ${capture} and ${store}`);
      server.close();
    }
  }
}
