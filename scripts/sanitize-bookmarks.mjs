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

/** The docs/04 §3 CSV header, in order. A file is CSV only if it says so. */
const CSV_HEADER = ['folder_path', 'title', 'url', 'add_date'];

/**
 * Identify the format, or refuse.
 *
 * @param {string} text
 * @returns {'html' | 'json' | 'csv' | null} `null` when nothing matched.
 *
 * Returning `null` rather than guessing is load-bearing. Every sanitizer below
 * finds what it must destroy *by format*, so a wrong guess destroys nothing and
 * emits the input verbatim — and the file would still be handed to the user as
 * "sanitized". The old `return 'csv'` fallback did exactly that for a truncated
 * JSON export, an HTML excerpt with no doctype, or a CSV with foreign headers:
 * byte-identical output, exit code 0, real hostnames intact.
 *
 * The people who run this tool are, by definition, the ones whose file did not
 * import — so a malformed or hand-trimmed file is the *typical* input here, not
 * an edge case. `src/lib/core/detect-format.ts` refuses these same inputs with
 * `UNKNOWN_FORMAT`; this must not be weaker than the parser it fronts.
 */
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
  const firstLine = body.split(/\r?\n/, 1)[0] ?? '';
  for (const delimiter of [',', ';']) {
    const columns = firstLine
      .split(delimiter)
      .map((h) => h.trim().replace(/^"|"$/g, '').toLowerCase());
    if (columns.length === CSV_HEADER.length && CSV_HEADER.every((c, i) => columns[i] === c)) {
      return 'csv';
    }
  }
  if (/<\s*dl[\s>]/i.test(body)) return 'html';
  return null;
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
  // Overlaps are dropped, outermost first. Two patterns can legitimately claim
  // the same bytes — an <A> title containing `x="http://…"` matches both the
  // title rule and the generic attribute sweep — and applying both would splice
  // already-rewritten text using an `end` measured against the original,
  // silently eating or stranding bytes. The widest span sanitizes the most.
  const ordered = [...spans].sort((a, b) => a.start - b.start || b.end - a.end);
  const out = [];
  let cursor = 0;
  for (const span of ordered) {
    if (span.start < cursor) continue;
    out.push(text.slice(cursor, span.start), span.value);
    cursor = span.end;
  }
  out.push(text.slice(cursor));
  // Joined once rather than spliced per span: the old loop rebuilt the whole
  // string for every replacement, which is O(spans x file) and takes minutes on
  // a large export.
  return out.join('');
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
  // The `d` flag gives exact per-group offsets. The previous version searched
  // the match text for the captured substring, which lands on the wrong copy
  // whenever the capture also appears earlier in the match — e.g. a bookmark
  // whose title equals part of its own URL.
  const indexed = new RegExp(re.source, re.flags.includes('d') ? re.flags : `${re.flags}d`);
  const spans = [];
  for (const m of text.matchAll(indexed)) {
    const captured = m[group] ?? '';
    const at = m.indices?.[group];
    if (captured === '' || at === undefined) continue;
    spans.push({ start: at[0], end: at[1], value: map(captured) });
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

/**
 * `name = value`, where the value is double-quoted, single-quoted or bare.
 *
 * Group 2/3/4 is the value, whichever quoting was used. Matching only `"…"`
 * left `HREF='https://…'` completely untouched — real exports in the wild use
 * single quotes, and that one is a straight leak.
 */
const ANY_ATTR = /\b([a-z_][a-z0-9_-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'<>=`]+))/dgi;

/**
 * Spans for every attribute whose name matches, at any quoting.
 *
 * @param {string} text
 * @param {RegExp} nameRe tested against the lower-cased attribute name
 * @param {(value: string) => string} map
 */
function attrSpans(text, nameRe, map) {
  const spans = [];
  for (const m of text.matchAll(ANY_ATTR)) {
    if (!nameRe.test((m[1] ?? '').toLowerCase())) continue;
    const at = m.indices?.[2] ?? m.indices?.[3] ?? m.indices?.[4];
    const value = m[2] ?? m[3] ?? m[4] ?? '';
    if (at === undefined || value === '') continue;
    spans.push({ start: at[0], end: at[1], value: map(value) });
  }
  return spans;
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
  for (const m of text.matchAll(ANY_ATTR)) {
    const name = (m[1] ?? '').toLowerCase();
    const value = m[2] ?? m[3] ?? m[4] ?? '';
    if (HANDLED_ATTRS.has(name) || value === '') continue;
    try {
      if (new URL(value).host === '') continue;
    } catch {
      continue;
    }
    const at = m.indices?.[2] ?? m.indices?.[3] ?? m.indices?.[4];
    if (at === undefined) continue;
    spans.push({ start: at[0], end: at[1], value: rewrite(value) });
  }
  return spans;
}

function sanitizeHtml(text, mapUrl, mapTitle) {
  let descriptions = 0;
  let keywords = 0;
  const spans = [
    // HREF and ICON, at any quoting — attribute name case is left as found.
    ...attrSpans(text, /^href$/, attrRewriter(mapUrl)),
    ...attrSpans(text, /^icon$/, () => BLANK_ICON),
    ...urlAttrSpans(text, mapUrl),
    // Firefox keywords and tags are user-authored text, so they are personal
    // too. Tag count is preserved because it is the only part a parser sees.
    ...attrSpans(text, /^shortcuturl$/, () => `kw${++keywords}`),
    ...attrSpans(text, /^tags$/, (v) =>
      v
        .split(',')
        .map((_, i) => `tag${i + 1}`)
        .join(','),
    ),
    // Bookmark titles: the text between <A …> and </A>.
    // `[\s\S]*?` and not `[^<]*`: a title containing a raw `<` made the whole
    // match fail, so that bookmark's title was left in the output untouched.
    ...spansFrom(text, new RegExp(`<a\\b${TAG_INNARDS}>([\\s\\S]*?)</a>`, 'gi'), mapTitle),
    // Folder titles.
    ...spansFrom(text, new RegExp(`<h3\\b${TAG_INNARDS}>([\\s\\S]*?)</h3>`, 'gi'), mapTitle),
    // Folder/bookmark descriptions.
    // Runs to the next element, not to the end of the line: a description that
    // wrapped onto a second line left everything after the first newline in
    // place, and a `<DD>` is exactly where someone writes a private note.
    ...spansFrom(
      text,
      // The `\s*` belongs in the lookahead, not the capture: leaving it inside
      // eats the newline and indentation before the next tag, which is exactly
      // the byte-level shape this tool promises not to touch.
      /<dd>([\s\S]*?)(?=\s*<\s*(?:dt|dd|dl|\/dl)\b|\s*$)/gi,
      () => `Description ${++descriptions}`,
    ),
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
 * Everything in the OUTPUT that still looks like a real address.
 *
 * This is the backstop, and it is the only reason the rules above can be
 * trusted. They are regexes over untrusted markup, so each one has a shape it
 * does not match — a single-quoted attribute, a title containing `<`, a JSON
 * key nobody enumerated, a `<DD>` that wraps onto a second line. Every one of
 * those is a silent leak, and the only way to find them all by inspection is to
 * be sure you have thought of every one, which nobody is.
 *
 * So instead of trusting the rules, the output is checked: any host that is not
 * one of our own `*.example` aliases means something got through, and the file
 * is refused rather than handed over. A rule this misses degrades into a
 * refusal — annoying — instead of into a published browsing history.
 *
 * @param {string} text sanitized output
 * @returns {string[]} distinct suspicious hosts, empty when clean
 */
export function findLeakedHosts(text) {
  const leaked = new Set();
  for (const m of text.matchAll(/\b[a-z][a-z0-9+.-]*:\/\/([^\s"'<>)\]}\\]+)/gi)) {
    const authority = (m[1] ?? '').split(/[/?#]/, 1)[0] ?? '';
    // Strip credentials and port; what remains is the host.
    const host = authority.split('@').pop()?.replace(/:\d+$/, '').toLowerCase() ?? '';
    if (host === '' || /^[a-z]\d*\.example$/.test(host)) continue;
    leaked.add(host);
  }
  return [...leaked];
}

/**
 * Sanitize a bookmark file's text.
 *
 * @param {string} text
 * @returns {{ text: string | null, kind: 'html' | 'json' | 'csv' | null, leaked: string[] }}
 *   `text` is null when the format was not recognised, or when the output
 *   failed its own leak check. Both mean: write nothing.
 */
export function sanitize(text) {
  const kind = detectKind(text);
  if (kind === null) return { text: null, kind: null, leaked: [] };

  const mapUrl = makeUrlMapper();
  const mapTitle = makeTitleMapper();
  const out =
    kind === 'html'
      ? sanitizeHtml(text, mapUrl, mapTitle)
      : kind === 'json'
        ? sanitizeJson(text, mapUrl, mapTitle)
        : sanitizeCsv(text, mapUrl, mapTitle);

  const leaked = findLeakedHosts(out);
  return { text: leaked.length > 0 ? null : out, kind, leaked };
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
  const { text: out, kind, leaked } = sanitize(text);

  if (kind === null) {
    console.error(
      `${basename(input)} is not a bookmark file this tool recognises, so NOTHING WAS WRITTEN.\n` +
        '  Expected: a Netscape HTML export (the usual bookmarks.html), a BookmarkMagic JSON\n' +
        '  export, or a CSV whose header is exactly "folder_path,title,url,add_date".\n' +
        '  Refusing to hand you a file it cannot promise is clean. Please attach the export\n' +
        '  exactly as your browser wrote it, or describe the problem in the issue instead.',
    );
    return 1;
  }

  if (out === null) {
    console.error(
      `${basename(input)}: NOTHING WAS WRITTEN — the result still contained ${leaked.length} real ` +
        `address(es), so this file is not safe to attach.\n  Leaked: ${leaked.slice(0, 5).join(', ')}` +
        `${leaked.length > 5 ? `, and ${leaked.length - 5} more` : ''}\n` +
        '  This is a bug in the sanitizer, not in your file. Please report it (without the file)\n' +
        '  at https://github.com/poli0981/bookmarkmagic/issues — the address above is enough.',
    );
    return 1;
  }

  const eol = text.includes('\r\n') ? 'CRLF' : 'LF';
  const bom = text.charCodeAt(0) === 0xfeff ? ', BOM' : '';
  console.error(`${basename(input)}: ${kind}, ${eol}${bom} — ${out.length} bytes out, no leaks`);

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
