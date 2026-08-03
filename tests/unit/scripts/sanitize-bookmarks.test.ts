import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { detectFormat } from '@/lib/core/detect-format';
import { type BookmarkNode, computeStats, type ParseResult, walkTree } from '@/lib/core/model';
import { parseBmJson } from '@/lib/core/parse/bm-json';
import { parseCsv } from '@/lib/core/parse/csv';
import { parseNetscapeHtml } from '@/lib/core/parse/netscape-html';

/**
 * `scripts/sanitize-bookmarks.mjs` — docs/11 §2, docs/09 §6.
 *
 * The script makes exactly one promise: after sanitizing, the bug still
 * reproduces. That is directly assertable against the committed corpus — parse
 * both versions and require the parser to see the same thing — so this suite
 * asserts the promise rather than the implementation.
 *
 * The script is invoked as a subprocess rather than imported. It is a `.mjs`
 * with no type declarations, and it has to keep running from a fresh clone with
 * nothing installed; spawning it also exercises the real entry point, argument
 * parsing included.
 */
const root = process.cwd();
const script = join(root, 'scripts', 'sanitize-bookmarks.mjs');
const fixtures = join(root, 'tests', 'fixtures');

/**
 * Run the CLI. `text` is null when it refused — which is a supported outcome,
 * not a failure: refusing is what it does with anything it cannot positively
 * identify, or whose output still contains a real address.
 */
function sanitize(absPath: string): { text: string | null; status: number } {
  try {
    const text = execFileSync(process.execPath, [script, absPath, '--stdout'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 64 * 1024 * 1024,
    });
    return { text, status: 0 };
  } catch (err) {
    const status = (err as { status?: number }).status ?? 1;
    return { text: null, status };
  }
}

/** Hosts that appear anywhere in the raw text, however the file is structured. */
function hostsInText(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(/\b[a-z][a-z0-9+.-]*:\/\/([^\s"'<>)\]}\\]+)/gi)) {
    const authority = (m[1] ?? '').split(/[/?#]/, 1)[0] ?? '';
    const host = authority.split('@').pop()?.replace(/:\d+$/, '').toLowerCase() ?? '';
    if (host !== '') out.add(host);
  }
  return [...out];
}

/**
 * Every committed fixture file, as paths relative to `tests/fixtures/`.
 *
 * Discovered rather than listed, so a fixture added by a future bug report is
 * covered without anyone remembering to add it here. `generated/` is skipped:
 * it is git-ignored `gen-fixture.mjs` output, so it exists on some machines and
 * not others, and a suite whose corpus depends on that is not reproducible.
 */
function corpus(): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'generated') continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(html|json|csv)$/.test(entry.name)) out.push(relative(fixtures, full));
    }
  };
  walk(fixtures);
  return out.sort();
}

const FIXTURES = corpus();

/** Parse with whichever parser the sniffed format selects. */
function parseAny(text: string): ParseResult {
  const format = detectFormat(text);
  if (format === 'netscape-html') return parseNetscapeHtml(text);
  if (format === 'bm-json') return parseBmJson(text);
  return parseCsv(text);
}

/** Structure only: folder/bookmark shape and nesting, with no titles or URLs. */
function topology(roots: readonly BookmarkNode[]): string {
  const render = (nodes: readonly BookmarkNode[]): string =>
    nodes.map((n) => (n.url === undefined ? `F(${render(n.children ?? [])})` : 'B')).join(',');
  return render(roots);
}

it('the corpus is non-empty, so a broken walk cannot pass vacuously', () => {
  expect(FIXTURES.length).toBeGreaterThan(10);
});

describe.each(FIXTURES)('sanitize %s', (name) => {
  const original = readFileSync(join(fixtures, name), 'utf8');
  const { text: cleaned, status } = sanitize(join(fixtures, name));

  it('either sanitizes, or refuses — and refuses exactly what the parser rejects', () => {
    // The two must agree. A file the extension itself cannot read is one this
    // tool cannot promise to have cleaned, and the old fallback guessed "csv",
    // matched no columns, and emitted the input verbatim while reporting
    // success — publishing a real bookmark set to a public issue.
    let parserAccepts = true;
    try {
      detectFormat(original);
    } catch {
      parserAccepts = false;
    }
    if (parserAccepts) {
      expect(status).toBe(0);
      expect(cleaned).not.toBeNull();
    } else {
      expect(status).toBe(1);
      expect(cleaned).toBeNull();
    }
  });

  it('leaks no hostname from the original', () => {
    // Asserted on the raw TEXT, not on a parse. The previous version returned
    // early whenever the original failed to parse, so it passed vacuously on
    // precisely the inputs that leaked.
    if (cleaned === null) return;
    const before = hostsInText(original);
    expect(before.filter((host) => cleaned.includes(host))).toEqual([]);
  });

  it('keeps the file recognisable as the same format', () => {
    if (cleaned === null) return;
    expect(detectFormat(cleaned)).toBe(detectFormat(original));
  });

  it('parses to the same stats, warnings and structure', () => {
    if (cleaned === null) return;
    const before = parseAny(original);
    const after = parseAny(cleaned);
    expect(after.stats).toEqual(before.stats);
    expect(computeStats(after.roots)).toEqual(computeStats(before.roots));
    expect(topology(after.roots)).toBe(topology(before.roots));
    expect(after.warnings.map((w) => w.code).sort()).toEqual(
      before.warnings.map((w) => w.code).sort(),
    );
  });

  it('preserves byte-level shape: BOM, line endings and line count', () => {
    if (cleaned === null) return;
    expect(cleaned.charCodeAt(0) === 0xfeff).toBe(original.charCodeAt(0) === 0xfeff);
    expect(cleaned.includes('\r\n')).toBe(original.includes('\r\n'));
    expect(cleaned.split('\n').length).toBe(original.split('\n').length);
  });

  it('preserves every timestamp exactly', () => {
    if (cleaned === null) return;
    const stamps = (text: string): string[] =>
      (text.match(/(?:ADD_DATE|LAST_MODIFIED)="(\d*)"/gi) ?? []).sort();
    expect(stamps(cleaned)).toEqual(stamps(original));
  });

  it('keeps distinct URLs distinct, so dedupe behaviour is unchanged', () => {
    if (cleaned === null) return;
    const urls = (text: string): number => {
      const set = new Set<string>();
      for (const { node } of walkTree(parseAny(text).roots)) {
        if (node.url !== undefined) set.add(node.url);
      }
      return set.size;
    };
    expect(urls(cleaned)).toBe(urls(original));
  });
});

/**
 * The refusal paths — every one of these was a silent leak found by review.
 *
 * The shared property: when a rule does not reach some byte, the tool must
 * refuse rather than hand over a file the user has been told is clean. The
 * rules are regexes over untrusted markup, so "we thought of every shape" is
 * not a claim anyone can make honestly; the output check is what makes that
 * survivable.
 */
describe('refuses rather than leaking', () => {
  const tmp = join(root, 'tests', 'fixtures', 'generated');

  const run = (name: string, content: string): { text: string | null; status: number } => {
    mkdirSync(tmp, { recursive: true });
    const path = join(tmp, name);
    writeFileSync(path, content);
    try {
      return sanitize(path);
    } finally {
      rmSync(path, { force: true });
    }
  };

  it.each([
    [
      'a truncated JSON export',
      'broken.json',
      '{"format":"bookmarkmagic","roots":[{"title":"x","url":"https://clinic.internal/a"',
    ],
    [
      'an HTML excerpt with no doctype and no <DL>',
      'excerpt.html',
      '<DT><A HREF="https://clinic.internal/a">Appointment</A>',
    ],
    [
      'a CSV with foreign headers',
      'foreign.csv',
      'folder,name,link\n"m","x","https://clinic.internal/a"\n',
    ],
  ])('refuses %s', (_label, name, content) => {
    const { text, status } = run(name, content);
    expect(status).toBe(1);
    expect(text).toBeNull();
  });

  it('catches a leak the rewriting rules missed, instead of emitting it', () => {
    // Single-quoted attributes were not matched at all. The rule is fixed, but
    // the point of this test is the backstop: even with the rule removed, the
    // output check would refuse rather than publish `clinic.internal`.
    const { text, status } = run(
      'quoted.html',
      "<!DOCTYPE NETSCAPE-Bookmark-file-1>\n<DL><p>\n<DT><A HREF='https://clinic.internal/a'>x</A>\n</DL><p>\n",
    );
    expect(status).toBe(0);
    expect(text).not.toBeNull();
    expect(text).not.toContain('clinic.internal');
  });

  it('sanitizes a bookmark whose title contains a raw <', () => {
    // `[^<]*` made the whole match fail, so the title was left in place.
    const { text } = run(
      'angle.html',
      '<!DOCTYPE NETSCAPE-Bookmark-file-1>\n<DL><p>\n<DT><A HREF="https://a.invalid/">Dr Smith < oncology</A>\n</DL><p>\n',
    );
    expect(text).not.toBeNull();
    expect(text).not.toContain('oncology');
  });

  it('sanitizes a <DD> description that wraps onto a second line', () => {
    // The capture stopped at the first newline, publishing the rest.
    const { text } = run(
      'dd.html',
      '<!DOCTYPE NETSCAPE-Bookmark-file-1>\n<DL><p>\n<DT><H3>F</H3>\n<DD>first line\nsecond line with dr-smith\n<DL><p></DL><p>\n</DL><p>\n',
    );
    expect(text).not.toBeNull();
    expect(text).not.toContain('dr-smith');
  });
});
