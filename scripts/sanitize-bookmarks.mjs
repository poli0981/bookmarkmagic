#!/usr/bin/env node
/**
 * Strip personal data from a bookmark file, keeping the bug.
 *
 * Purpose: make "attach a sanitized sample" (SECURITY.md, the parser issue
 *   form) something a reporter can actually do, instead of an instruction they
 *   have to interpret.
 * Inputs: a Netscape HTML, BookmarkMagic JSON, or CSV bookmark file.
 * Guarantees: every byte outside a replaced address or title is untouched —
 *   including the BOM, the doctype, line endings, tag and attribute case,
 *   quoting style, indentation, and every timestamp. Replacements are stable
 *   per distinct input value, so "how many distinct hosts" and "which two
 *   bookmarks are duplicates" survive.
 *
 * Zero dependencies, Node stdlib only, no network. It has to run from a fresh
 * clone with nothing installed, which is also why it re-implements a three-line
 * format sniff rather than importing `src/lib/core/detect-format.ts`.
 *
 * Usage:
 *   node scripts/sanitize-bookmarks.mjs <input> [output]
 *   node scripts/sanitize-bookmarks.mjs <input> --stdout
 *   node scripts/sanitize-bookmarks.mjs <input> --check     # report, write nothing
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Matches docs/09's parse cap. A 25 MB attachment helps nobody anyway. */
const MAX_BYTES = 25 * 1024 * 1024;

/** 1×1 transparent PNG. Keeps ICON= present, which is what the parser reacts to. */
const BLANK_ICON =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

// ---------------------------------------------------------------- format sniff

/** @param {string} text */
export function detectKind(text) {
  const body = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  if (/NETSCAPE-Bookmark-file-1/i.test(body.slice(0, 512))) return 'html';
  const trimmed = body.trimStart();
  if (trimmed.startsWith('{')) {
    try {
      JSON.parse(trimmed);
      return 'json';
    } catch {
      // Not JSON after all; fall through.
    }
  }
  if (/<\s*dl[\s>]/i.test(body)) return 'html';
  return 'csv';
}

// ------------------------------------------------------------------- mappers

/**
 * Replace addresses while preserving everything a parser branches on: the
 * scheme, whether there is a port, how deep the path is, whether it ends in a
 * slash, how many query parameters there are and in what order, and whether
 * there is a fragment. Percent-escapes are carried across literally, so a
 * decoding bug still reproduces.
 */
function makeUrlMapper() {
  const seen = new Map();
  const hosts = new Map();

  const hostAlias = (host) => {
    let alias = hosts.get(host);
    if (alias === undefined) {
      const n = hosts.size;
      // a.example … z.example, then a1.example, a2.example …
      const letter = String.fromCharCode(97 + (n % 26));
      const round = Math.floor(n / 26);
      alias = round === 0 ? `${letter}.example` : `${letter}${round}.example`;
      hosts.set(host, alias);
    }
    return alias;
  };

  const escapesIn = (segment) => (segment.match(/%[0-9a-fA-F]{2}/g) ?? []).join('');

  const mapPath = (pathname) => {
    if (pathname === '' || pathname === '/') return pathname;
    const trailing = pathname.endsWith('/');
    const parts = pathname.replace(/^\//, '').replace(/\/$/, '').split('/');
    const mapped = parts.map((p, i) => (p === '' ? '' : `p${i + 1}${escapesIn(p)}`));
    return `/${mapped.join('/')}${trailing ? '/' : ''}`;
  };

  const mapQuery = (search) => {
    if (search === '') return '';
    return `?${search
      .slice(1)
      .split('&')
      .map((pair, i) => (pair.includes('=') ? `q${i + 1}=v${i + 1}` : `q${i + 1}`))
      .join('&')}`;
  };

  return (raw) => {
    if (raw === '') return raw;
    const cached = seen.get(raw);
    if (cached !== undefined) return cached;

    let out;
    let url;
    try {
      url = new URL(raw);
    } catch {
      url = undefined;
    }

    if (url === undefined) {
      // Keep it unparseable, and keep distinct values distinct — the dedupe
      // path treats an unparseable URL as its own trimmed self.
      out = `not-a-url-${seen.size + 1}`;
    } else if (url.host === '') {
      // Opaque scheme (javascript:, data:, mailto:). The scheme is the whole
      // point for the T1/T3 threat cases; the payload is not ours to keep.
      out = `${url.protocol}sanitized-${seen.size + 1}`;
    } else {
      // Credentials are never round-tripped, not even as placeholders.
      const port = url.port === '' ? '' : `:${url.port}`;
      const hash = url.hash === '' ? '' : '#frag';
      out = `${url.protocol}//${hostAlias(url.host.replace(/:\d+$/, ''))}${port}${mapPath(url.pathname)}${mapQuery(url.search)}${hash}`;
    }

    seen.set(raw, out);
    return out;
  };
}

/**
 * Replace titles while preserving what encoding bugs live in: emptiness, the
 * scripts present (so a CJK or RTL or emoji bug still reproduces), and any HTML
 * entity references, which are carried across verbatim.
 */
function makeTitleMapper() {
  const seen = new Map();
  const SCRIPTS = [
    [/[一-鿿぀-ヿ]/, '文字'],
    [/[֐-ࣿ]/, 'شيء'],
    [/[\p{Extended_Pictographic}]/u, '🌸'],
  ];

  return (raw) => {
    if (raw.trim() === '') return raw;
    const cached = seen.get(raw);
    if (cached !== undefined) return cached;

    const entities = (raw.match(/&(?:#\d+|#x[0-9a-fA-F]+|[a-zA-Z]+);/g) ?? []).join('');
    const extras = SCRIPTS.filter(([re]) => re.test(raw))
      .map(([, sample]) => sample)
      .join('');
    const out = `Title ${seen.size + 1}${extras === '' ? '' : ` ${extras}`}${entities}`;
    seen.set(raw, out);
    return out;
  };
}

// ------------------------------------------------------------ span rewriting

/**
 * Apply replacements by character span, right to left.
 *
 * Everything this tool does is expressed as spans so that the bytes between
 * them are provably untouched — that is the property the whole exercise rests
 * on, and rebuilding the file from a parsed model would quietly lose it.
 *
 * @param {string} text
 * @param {{start: number, end: number, value: string}[]} spans
 */
function replaceSpans(text, spans) {
  let out = text;
  for (const span of [...spans].sort((a, b) => b.start - a.start)) {
    out = out.slice(0, span.start) + span.value + out.slice(span.end);
  }
  return out;
}

/**
 * Collect spans for one capture group of a global regex. `map` receives the
 * captured text.
 *
 * The group's offset is computed by re-scanning the match, so the regex must
 * capture a span that appears only once within it — true for every pattern
 * here, since each captures an attribute value or an element's text.
 *
 * @param {string} text
 * @param {RegExp} re
 * @param {(captured: string) => string} map
 * @param {number} [group]
 */
function spansFrom(text, re, map, group = 1) {
  const spans = [];
  for (const m of text.matchAll(re)) {
    const captured = m[group] ?? '';
    if (captured === '') continue;
    const start = m.index + m[0].lastIndexOf(captured);
    spans.push({ start, end: start + captured.length, value: map(captured) });
  }
  return spans;
}

/**
 * The inside of an opening tag, tolerating `>` within quoted attribute values.
 *
 * `data:text/html,<h1>hi</h1>` is a legal HREF and appears in the T1/T3
 * fixtures. A naive `[^>]*` stops inside it, silently leaving that bookmark's
 * title unsanitized — which is the one failure mode this tool must not have.
 */
const TAG_INNARDS = '(?:"[^"]*"|\'[^\']*\'|[^>"\'])*';

// ------------------------------------------------------------------ formats

/**
 * Decode an HTML attribute value, then re-encode the result the way the source
 * file encoded it.
 *
 * Netscape exports write `&amp;` inside HREF, but not all of them do, and
 * whether a parser unescapes attribute values is itself something people report
 * bugs about. Emitting a bare `&` where the source had `&amp;` would silently
 * repair the file being reported.
 */
function attrRewriter(map) {
  return (captured) => {
    const decoded = captured
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"');
    const mapped = map(decoded);
    const escapesAmp = /&amp;/i.test(captured) || !captured.includes('&');
    return escapesAmp ? mapped.replace(/&/g, '&amp;') : mapped;
  };
}

/** Attributes handled explicitly; the generic URL sweep must not touch them. */
const HANDLED_ATTRS = new Set(['href', 'icon']);

/**
 * Scrub any *other* attribute whose value is a URL with a host.
 *
 * Firefox alone writes `ICON_URI`, and `FEEDURL` and friends exist in the wild.
 * Enumerating them was already wrong once — `ICON_URI` leaked a real hostname
 * through a file that had passed every other check — so this sweeps by value
 * shape instead, and covers attributes nobody has thought of yet.
 */
function urlAttrSpans(text, mapUrl) {
  const spans = [];
  const rewrite = attrRewriter(mapUrl);
  for (const m of text.matchAll(/\b([a-z_][a-z0-9_-]*)\s*=\s*"([^"]*)"/gi)) {
    const name = (m[1] ?? '').toLowerCase();
    const value = m[2] ?? '';
    if (HANDLED_ATTRS.has(name) || value === '') continue;
    try {
      if (new URL(value).host === '') continue;
    } catch {
      continue;
    }
    const start = m.index + m[0].lastIndexOf(value);
    spans.push({ start, end: start + value.length, value: rewrite(value) });
  }
  return spans;
}

function sanitizeHtml(text, mapUrl, mapTitle) {
  let descriptions = 0;
  let keywords = 0;
  const spans = [
    // HREF="…" and ICON="…" — attribute name case is left exactly as found.
    ...spansFrom(text, /\bhref\s*=\s*"([^"]*)"/gi, attrRewriter(mapUrl)),
    ...spansFrom(text, /\bicon\s*=\s*"([^"]*)"/gi, () => BLANK_ICON),
    ...urlAttrSpans(text, mapUrl),
    // Firefox keywords and tags are user-authored text, so they are personal
    // too. Tag count is preserved because it is the only part a parser sees.
    ...spansFrom(text, /\bshortcuturl\s*=\s*"([^"]*)"/gi, () => `kw${++keywords}`),
    ...spansFrom(text, /\btags\s*=\s*"([^"]*)"/gi, (v) =>
      v
        .split(',')
        .map((_, i) => `tag${i + 1}`)
        .join(','),
    ),
    // Bookmark titles: the text between <A …> and </A>.
    ...spansFrom(text, new RegExp(`<a\\b${TAG_INNARDS}>([^<]*)</a>`, 'gi'), mapTitle),
    // Folder titles.
    ...spansFrom(text, new RegExp(`<h3\\b${TAG_INNARDS}>([^<]*)</h3>`, 'gi'), mapTitle),
    // Folder/bookmark descriptions.
    ...spansFrom(text, /<dd>([^\n<]*)/gi, () => `Description ${++descriptions}`),
  ];
  return replaceSpans(text, spans);
}

/**
 * Rewrite only the *values* of `url` and `title` string properties, by walking
 * the raw text. Parsing and re-stringifying would normalize the indentation and
 * line endings, which is exactly what a whitespace-sensitive report needs kept.
 */
function sanitizeJson(text, mapUrl, mapTitle) {
  const spans = [];
  const re = /"(url|title)"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
  for (const m of text.matchAll(re)) {
    const key = m[1];
    const rawValue = m[2] ?? '';
    const start = m.index + m[0].length - 1 - rawValue.length;
    let decoded;
    try {
      decoded = JSON.parse(`"${rawValue}"`);
    } catch {
      decoded = rawValue;
    }
    const mapped = key === 'url' ? mapUrl(decoded) : mapTitle(decoded);
    spans.push({ start, end: start + rawValue.length, value: JSON.stringify(mapped).slice(1, -1) });
  }
  return replaceSpans(text, spans);
}

/**
 * Walk the CSV with a minimal RFC 4180 reader that records the span of each
 * field's *content* (inside the quotes, when quoted). Replacements never
 * contain a delimiter, quote or newline, so the original quoting survives
 * untouched — which matters, because CSV quoting is itself a common bug.
 */
function sanitizeCsv(text, mapUrl, mapTitle) {
  const delimiter = (text.split('\n', 1)[0] ?? '').includes(';') ? ';' : ',';
  const fields = [];
  let row = 0;
  let col = 0;
  let i = 0;

  while (i < text.length) {
    const quoted = text[i] === '"';
    if (quoted) i++;
    const start = i;
    while (i < text.length) {
      const ch = text[i];
      if (quoted) {
        if (ch === '"') {
          if (text[i + 1] === '"') {
            i += 2;
            continue;
          }
          break;
        }
        i++;
        continue;
      }
      if (ch === delimiter || ch === '\n' || ch === '\r') break;
      i++;
    }
    fields.push({ row, col, start, end: i, quoted });
    if (quoted && text[i] === '"') i++;

    if (text[i] === delimiter) {
      col++;
      i++;
    } else {
      if (text[i] === '\r') i++;
      if (text[i] === '\n') i++;
      row++;
      col = 0;
    }
  }

  // Column names per docs/04 §3 — `folder_path`, not `folder`.
  const header = fields.filter((f) => f.row === 0).map((f) => text.slice(f.start, f.end).trim());
  const at = (name) => header.findIndex((h) => h.toLowerCase().replace(/^﻿/, '') === name);
  const [folderCol, titleCol, urlCol] = [at('folder_path'), at('title'), at('url')];

  const spans = [];
  for (const f of fields) {
    if (f.row === 0 || f.start === f.end) continue;
    const raw = text.slice(f.start, f.end);
    const value = raw.replace(/""/g, '"');
    let mapped;
    if (f.col === urlCol) mapped = mapUrl(value);
    else if (f.col === titleCol) mapped = mapTitle(value);
    else if (f.col === folderCol) mapped = mapFolderPath(value, mapTitle);
    else continue;
    spans.push({ start: f.start, end: f.end, value: mapped.replace(/"/g, '""') });
  }
  return replaceSpans(text, spans);
}

/**
 * Map each path segment separately so `\/` and `\\` escapes keep their meaning.
 *
 * A segment that contained a literal slash or backslash keeps one, so the
 * escape survives into the output. Without that, `Escaped\/slash` sanitizes to
 * a plain name and the escape branch of the CSV path parser — a real reason
 * someone would file a report — stops being exercised by the sample.
 */
function mapFolderPath(path, mapTitle) {
  const segments = [];
  let current = '';
  for (let i = 0; i < path.length; i++) {
    const ch = path[i];
    if (ch === '\\' && (path[i + 1] === '/' || path[i + 1] === '\\')) {
      current += path[i + 1];
      i++;
      continue;
    }
    if (ch === '/') {
      segments.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  segments.push(current);
  return segments
    .map((s) => {
      if (s === '') return '';
      const kept = `${s.includes('/') ? '/' : ''}${s.includes('\\') ? '\\' : ''}`;
      return `${mapTitle(s)}${kept}`.replace(/\\/g, '\\\\').replace(/\//g, '\\/');
    })
    .join('/');
}

// -------------------------------------------------------------- entry points

/**
 * Sanitize a bookmark file's text.
 *
 * @param {string} text
 * @returns {{ text: string, kind: 'html' | 'json' | 'csv' }}
 */
export function sanitize(text) {
  const kind = detectKind(text);
  const mapUrl = makeUrlMapper();
  const mapTitle = makeTitleMapper();
  if (kind === 'html') return { text: sanitizeHtml(text, mapUrl, mapTitle), kind };
  if (kind === 'json') return { text: sanitizeJson(text, mapUrl, mapTitle), kind };
  return { text: sanitizeCsv(text, mapUrl, mapTitle), kind };
}

function main(argv) {
  const flags = argv.filter((a) => a.startsWith('--'));
  const [input, maybeOutput] = argv.filter((a) => !a.startsWith('--'));

  if (input === undefined) {
    console.error('usage: node scripts/sanitize-bookmarks.mjs <input> [output] [--stdout|--check]');
    return 1;
  }

  const raw = readFileSync(input);
  if (raw.byteLength > MAX_BYTES) {
    console.error(
      `${input} is ${(raw.byteLength / 1024 / 1024).toFixed(1)} MB. The extension itself refuses ` +
        'anything over 25 MB, and a smaller file that still reproduces the bug is more useful. ' +
        'Please trim it first.',
    );
    return 1;
  }

  const text = raw.toString('utf8');
  const { text: out, kind } = sanitize(text);
  const eol = text.includes('\r\n') ? 'CRLF' : 'LF';
  const bom = text.charCodeAt(0) === 0xfeff ? ', BOM' : '';
  console.error(`${basename(input)}: ${kind}, ${eol}${bom} — ${out.length} bytes out`);

  if (flags.includes('--check')) return 0;
  if (flags.includes('--stdout')) {
    process.stdout.write(out);
    return 0;
  }

  const ext = extname(input);
  const target = maybeOutput ?? `${input.slice(0, input.length - ext.length)}.sanitized${ext}`;
  writeFileSync(target, out);
  console.error(`wrote ${target}`);
  return 0;
}

if (process.argv[1] !== undefined && process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
