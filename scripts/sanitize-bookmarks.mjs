#!/usr/bin/env node
// @ts-check
/**
 * Strip personal data from a bookmark file, keeping the bug.
 *
 * Purpose: make "attach a sanitized sample" (SECURITY.md, the parser issue
 *   form) something a reporter can actually do, instead of an instruction they
 *   have to interpret.
 * Inputs: a Netscape HTML export, BookmarkMagic JSON, Chrome's profile
 *   `Bookmarks` file (also Edge/Brave/Vivaldi), a Firefox `.json` backup, or a
 *   docs/04 §3 CSV.
 * Guarantees: every byte outside a replaced address, title or note is untouched
 *   — the BOM, the doctype, line endings, tag and attribute case, quoting style,
 *   indentation, JSON key order and escapes, and every timestamp. Replacements
 *   are stable per distinct input value, so "how many distinct hosts" and
 *   "which two bookmarks are duplicates" survive. When the output still looks
 *   personal, nothing is written at all.
 *
 * Zero dependencies, Node stdlib only, no network, plain JavaScript: it has to
 * run from a fresh clone with nothing installed, on whatever Node the reporter
 * has. The format modules live in scripts/sanitize/.
 *
 * Usage:
 *   node scripts/sanitize-bookmarks.mjs <input> [output]
 *   node scripts/sanitize-bookmarks.mjs <input> --stdout
 *   node scripts/sanitize-bookmarks.mjs <input> --check     # report, write nothing
 */
import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sanitizeCsv } from './sanitize/csv.mjs';
import { detectKind } from './sanitize/detect.mjs';
import { sanitizeHtml } from './sanitize/html.mjs';
import { sanitizeJson } from './sanitize/json.mjs';
import { findLeakedHosts, findLeakedWords } from './sanitize/leaks.mjs';
import { makeTitleMapper, makeUrlMapper } from './sanitize/mappers.mjs';

export { detectKind } from './sanitize/detect.mjs';
export { findLeakedHosts, findLeakedWords } from './sanitize/leaks.mjs';

/** Matches docs/09's parse cap. A 25 MB attachment helps nobody anyway. */
const MAX_BYTES = 25 * 1024 * 1024;

/**
 * Sanitize a bookmark file's text.
 *
 * @param {string} text
 * @returns {{ text: string | null, kind: import('./sanitize/detect.mjs').Kind | null, leaked: string[] }}
 *   `text` is null when the format was not recognised, or when the output
 *   failed its own leak check. Both mean: write nothing.
 */
export function sanitize(text) {
  const kind = detectKind(text);
  if (kind === null) return { text: null, kind: null, leaked: [] };

  const mapUrl = makeUrlMapper();
  const mapTitle = makeTitleMapper();
  let out;
  if (kind === 'html') out = sanitizeHtml(text, mapUrl, mapTitle);
  else if (kind === 'csv') out = sanitizeCsv(text, mapUrl, mapTitle);
  else out = sanitizeJson(text, mapUrl, mapTitle);

  const leaked = [
    ...findLeakedHosts(out),
    ...(kind === 'html' ? findLeakedWords(out).map((word) => `text "${word}"`) : []),
  ];
  return { text: leaked.length > 0 ? null : out, kind, leaked };
}

/** @param {string} input */
function refuseUnknown(input) {
  console.error(
    `${basename(input)} is not a bookmark file this tool recognises, so NOTHING WAS WRITTEN.\n` +
      '  Expected one of: a Netscape HTML export (the usual bookmarks.html), a BookmarkMagic\n' +
      '  JSON export, Chrome\'s profile "Bookmarks" file, a Firefox bookmarks-*.json backup,\n' +
      '  or a CSV whose header is exactly "folder_path,title,url,add_date".\n' +
      '  Refusing to hand you a file it cannot promise is clean. Please attach the export\n' +
      '  exactly as your browser wrote it, or describe the problem in the issue instead.',
  );
  return 1;
}

/** @param {string} input @param {string[]} leaked */
function refuseLeak(input, leaked) {
  console.error(
    `${basename(input)}: NOTHING WAS WRITTEN — the result still contained ${leaked.length} item(s) ` +
      `that look personal, so this file is not safe to attach.\n  Found: ${leaked.slice(0, 5).join(', ')}` +
      `${leaked.length > 5 ? `, and ${leaked.length - 5} more` : ''}\n` +
      '  This is a bug in the sanitizer, not in your file. Please report it (without the file)\n' +
      '  at https://github.com/poli0981/bookmarkmagic/issues — the list above is enough.',
  );
  return 1;
}

/** @param {string[]} argv */
function main(argv) {
  const flags = argv.filter((a) => a.startsWith('--'));
  const [input, maybeOutput] = argv.filter((a) => !a.startsWith('--'));

  if (input === undefined) {
    console.error('usage: node scripts/sanitize-bookmarks.mjs <input> [output] [--stdout|--check]');
    return 1;
  }

  // Size first, from the file system: reading a 2 GB file to learn it is too
  // big is how the old version ran out of memory before its own check.
  const size = statSync(input).size;
  if (size > MAX_BYTES) {
    console.error(
      `${input} is ${(size / 1024 / 1024).toFixed(1)} MB. The extension itself refuses ` +
        'anything over 25 MB, and a smaller file that still reproduces the bug is more useful. ' +
        'Please trim it first.',
    );
    return 1;
  }

  const text = readFileSync(input).toString('utf8');
  const { text: out, kind, leaked } = sanitize(text);
  if (kind === null) return refuseUnknown(input);
  if (out === null) return refuseLeak(input, leaked);

  const eol = text.includes('\r\n') ? 'CRLF' : 'LF';
  const bom = text.charCodeAt(0) === 0xfeff ? ', BOM' : '';
  console.error(
    `${basename(input)}: ${kind}, ${eol}${bom} — ${Buffer.byteLength(out)} bytes out, no leaks`,
  );

  if (flags.includes('--check')) return 0;
  if (flags.includes('--stdout')) {
    process.stdout.write(out);
    return 0;
  }

  const ext = extname(input);
  const target = maybeOutput ?? `${input.slice(0, input.length - ext.length)}.sanitized${ext}`;
  // Never over the original: an output path equal to the input used to replace
  // the user's only copy of their real bookmarks with the placeholder version.
  if (resolve(target) === resolve(input)) {
    console.error(
      `refusing to overwrite ${input} with its sanitized copy — pick another output path.`,
    );
    return 1;
  }
  writeFileSync(target, out);
  console.error(`wrote ${target}`);
  return 0;
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
