import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

/**
 * scripts/sanitize-bookmarks.mjs — the cases the fixture corpus cannot reach:
 * the two browser JSON formats (no committed fixture yet when these were
 * written), the leaks a 2026-10-28 audit found, and the CLI's own safety rules.
 *
 * Every personal string in these samples is something the output must NOT
 * contain, and each assertion checks the raw output text.
 */

const SCRIPT = join(process.cwd(), 'scripts', 'sanitize-bookmarks.mjs');
const dirs: string[] = [];

function tempFile(name: string, content: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'sanitize-'));
  dirs.push(dir);
  const path = join(dir, name);
  writeFileSync(path, content);
  return path;
}

function run(args: string[]): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

function sanitizeText(name: string, content: string): { status: number | null; out: string } {
  const { status, stdout } = run([tempFile(name, content), '--stdout']);
  return { status, out: stdout };
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const CHROME_PROFILE = `{
   "checksum": "4f3c2b1a0e9d8c7b6a5f4e3d2c1b0a99",
   "roots": {
      "bookmark_bar": {
         "children": [ {
            "date_added": "13344473600000000",
            "date_last_used": "0",
            "guid": "5e1d9a62-1c3e-4c41-9d0b-6f2b8a1e7c33",
            "id": "5",
            "meta_info": { "Nickname": "oncology-portal", "Thumbnail": "https://thumbs.clinic.internal/1.png" },
            "name": "Dr Smith oncology results portal",
            "type": "url",
            "url": "https://portal.clinic.internal/results?patient=8812"
         } ],
         "date_added": "13344473600000000",
         "date_modified": "13344473700000000",
         "guid": "0bc5d13f-2cba-5d74-951f-3f233fe6c908",
         "id": "1",
         "name": "Bookmarks bar",
         "type": "folder"
      },
      "other": { "children": [], "date_added": "0", "guid": "82b081ec-3dd3-529c-8475-ab6c344590dd", "id": "2", "name": "Other bookmarks", "type": "folder" },
      "synced": { "children": [], "date_added": "0", "guid": "4cf2e351-0e85-532b-bb37-df045d8f8d0f", "id": "3", "name": "Mobile bookmarks", "type": "folder" }
   },
   "sync_metadata": "Q2hBSkVMa0JBdVlWa1Z3QmxBZ0xpbnVzLnRvcnZhbGRz",
   "version": 1
}
`;

const FIREFOX_BACKUP = JSON.stringify({
  guid: 'root________',
  title: '',
  index: 0,
  dateAdded: 1700000000000000,
  lastModified: 1700000000000000,
  id: 1,
  typeCode: 2,
  type: 'text/x-moz-place-container',
  root: 'placesRoot',
  children: [
    {
      guid: 'toolbar_____',
      title: 'toolbar',
      index: 1,
      typeCode: 2,
      type: 'text/x-moz-place-container',
      root: 'toolbarFolder',
      children: [
        {
          guid: 'Xk2pQ9vLm3Ta',
          title: 'Divorce lawyer shortlist',
          index: 0,
          dateAdded: 1700000000000000,
          typeCode: 1,
          type: 'text/x-moz-place',
          uri: 'https://lawyers.example-private.net/shortlist',
          iconUri: 'fake-favicon-uri:https://lawyers.example-private.net/favicon.ico',
          keyword: 'lawyerkw',
          tags: 'custody,urgent',
          charset: 'UTF-8',
          annos: [
            {
              name: 'bookmarkProperties/description',
              flags: 0,
              expires: 4,
              value: 'call before Friday hearing',
            },
          ],
        },
      ],
    },
  ],
});

describe('sanitizer — browser JSON formats', () => {
  it("rewrites every personal value in Chrome's profile Bookmarks file", () => {
    const { status, out } = sanitizeText('Bookmarks', CHROME_PROFILE);
    expect(status).toBe(0);
    for (const secret of [
      'Dr Smith',
      'oncology',
      'clinic.internal',
      'patient=8812',
      '5e1d9a62-1c3e-4c41-9d0b-6f2b8a1e7c33',
      'Q2hBSkVMa0JBdVlWa1Z3QmxBZ0xpbnVzLnRvcnZhbGRz',
      '4f3c2b1a0e9d8c7b6a5f4e3d2c1b0a99',
    ]) {
      expect(out, secret).not.toContain(secret);
    }
  });

  it('keeps the Chrome structure: keys, types, ids, timestamps and layout', () => {
    const { out } = sanitizeText('Bookmarks', CHROME_PROFILE);
    const before = JSON.parse(CHROME_PROFILE);
    const after = JSON.parse(out);
    expect(Object.keys(after)).toEqual(Object.keys(before));
    const node = after.roots.bookmark_bar.children[0];
    expect(node.type).toBe('url');
    expect(node.id).toBe('5');
    expect(node.date_added).toBe('13344473600000000');
    expect(after.roots.bookmark_bar.date_modified).toBe('13344473700000000');
    expect(after.version).toBe(1);
    expect(out.split('\n').length).toBe(CHROME_PROFILE.split('\n').length);
    expect(after.checksum).toMatch(/^0+$/);
  });

  it('rewrites every personal value in a Firefox backup and keeps the root GUIDs', () => {
    const { status, out } = sanitizeText('bookmarks-2026-10-28.json', FIREFOX_BACKUP);
    expect(status).toBe(0);
    for (const secret of [
      'Divorce',
      'lawyer',
      'example-private.net',
      'lawyerkw',
      'custody',
      'Friday hearing',
      'Xk2pQ9vLm3Ta',
    ]) {
      expect(out, secret).not.toContain(secret);
    }
    const after = JSON.parse(out);
    expect(after.guid).toBe('root________');
    expect(after.root).toBe('placesRoot');
    expect(after.children[0].guid).toBe('toolbar_____');
    const bookmark = after.children[0].children[0];
    expect(bookmark.type).toBe('text/x-moz-place');
    expect(bookmark.dateAdded).toBe(1700000000000000);
    expect(bookmark.tags).toBe('tag1,tag2');
    expect(bookmark.annos[0].name).toBe('bookmarkProperties/description');
  });

  it('refuses JSON that is none of the three known formats', () => {
    const { status, out } = sanitizeText(
      'x.json',
      '{"items":[{"label":"Dr Smith","href":"https://clinic.internal/"}]}',
    );
    expect(status).toBe(1);
    expect(out).toBe('');
  });
});

describe('sanitizer — HTML leaks found by the audit', () => {
  const html = (body: string) => `<!DOCTYPE NETSCAPE-Bookmark-file-1>\n${body}\n`;

  it('sanitizes a <DD> that carries attributes', () => {
    const { status, out } = sanitizeText(
      'dd.html',
      html(
        '<DL><p>\n<DT><A HREF="https://a.invalid/">x</A>\n<DD class="n">Private note about my therapist\n</DL><p>',
      ),
    );
    expect(status).toBe(0);
    expect(out).not.toContain('therapist');
  });

  it('sanitizes a file: ICON_URI that names a local user', () => {
    const { out } = sanitizeText(
      'icon.html',
      html(
        '<DL><p>\n<DT><A HREF="https://a.invalid/" ICON_URI="file:///C:/Users/JaneDoe/icons/x.ico">x</A>\n</DL><p>',
      ),
    );
    expect(out).not.toContain('JaneDoe');
  });

  it('sanitizes a document heading that names its owner', () => {
    const { out } = sanitizeText(
      'h1.html',
      html(
        '<TITLE>Jane Doe bookmarks</TITLE>\n<H1>Jane Doe personal bookmarks</H1>\n<DL><p>\n<DT><A HREF="https://a.invalid/">x</A>\n</DL><p>',
      ),
    );
    expect(out).not.toContain('Jane');
    expect(out).toContain('<TITLE>Title ');
  });

  it('keeps the generic "Bookmarks" heading as it is', () => {
    const { out } = sanitizeText(
      'plain.html',
      html(
        '<TITLE>Bookmarks</TITLE>\n<H1>Bookmarks Menu</H1>\n<DL><p>\n<DT><A HREF="https://a.invalid/">x</A>\n</DL><p>',
      ),
    );
    expect(out).toContain('<TITLE>Bookmarks</TITLE>');
    expect(out).toContain('<H1>Bookmarks Menu</H1>');
  });

  it('refuses when personal text sits where no rewriting rule looks', () => {
    // Loose text in a <DT> is reached by no rule. The text check catches it
    // anyway — that independence is what makes the rules trustworthy.
    const { status, out } = sanitizeText(
      'loose.html',
      html(
        '<DL><p>\n<DT>Notes from Jane about the custody case\n<DT><A HREF="https://a.invalid/">x</A>\n</DL><p>',
      ),
    );
    expect(status).toBe(1);
    expect(out).toBe('');
  });

  it('decodes an attribute value once, never twice', () => {
    // `&amp;lt;` is "&lt;" after ONE decode. The old chained replaces turned it
    // into "<", which changed how many query parameters the URL had.
    const { out } = sanitizeText(
      'amp.html',
      html('<DL><p>\n<DT><A HREF="https://a.invalid/p?x=&amp;lt;b">t</A>\n</DL><p>'),
    );
    expect(out).toContain('HREF="https://a.example/p1?q1=v1&amp;q2"');
  });
});

describe('sanitizer — CLI safety', () => {
  it('refuses to overwrite the input file', () => {
    const content =
      '<!DOCTYPE NETSCAPE-Bookmark-file-1>\n<DL><p>\n<DT><A HREF="https://real.example.org/">Mine</A>\n</DL><p>\n';
    const path = tempFile('bookmarks.html', content);
    const { status, stderr } = run([path, path]);
    expect(status).toBe(1);
    expect(stderr).toContain('refusing to overwrite');
    expect(readFileSync(path, 'utf8')).toBe(content);
  });

  it('reports the output size in bytes, not characters', () => {
    const path = tempFile(
      'b.html',
      '<!DOCTYPE NETSCAPE-Bookmark-file-1>\n<DL><p>\n<DT><A HREF="https://a.invalid/">ブックマーク</A>\n</DL><p>\n',
    );
    const { stderr, stdout } = run([path, '--stdout']);
    expect(stderr).toContain(`${Buffer.byteLength(stdout)} bytes out`);
  });
});

describe('sanitizer — leaks found by the v1.1.0 review', () => {
  it('rewrites a CSV row whose unquoted comma shifted every later field', () => {
    // The exact row that makes the extension report CSV_ROW_MISMATCH — the
    // file most likely to be sanitized — put the address in `add_date`.
    const csv =
      'folder_path,title,url,add_date\n' +
      'Work,Smith, Jane - payslip March,file:///C:/Users/jsmith/Documents/Payroll/payslip.pdf,1700000000\n' +
      'Work,ok,https://ok.example.org/,1700000001,call Jane Doe re visa 555-0199\n';
    const { status, out } = sanitizeText('misaligned.csv', csv);
    expect(status).toBe(0);
    for (const secret of [
      'jsmith',
      'Payroll',
      'payslip',
      'Jane',
      'visa',
      'Smith',
      'ok.example.org',
    ]) {
      expect(out).not.toContain(secret);
    }
    // Dates survive, and so does every row's field count — the bug itself.
    expect(out).toContain('1700000000');
    expect(out.split('\n').map((line) => line.split(',').length)).toEqual([4, 5, 5, 1]);
  });

  it('rewrites attributes no rule knows, like Firefox POST_DATA', () => {
    const html =
      '<!DOCTYPE NETSCAPE-Bookmark-file-1>\n<DL><p>\n' +
      '<DT><A HREF="https://intranet.example.org/s?q=%s" ADD_DATE="1700000000" POST_DATA="q=%s&amp;user=jane.doe&amp;employee_id=E48213">HR</A>\n' +
      '<DT><A HREF="https://bank.example.org/" DATA-NOTE="Jane Doe joint account 4421">x</A>\n' +
      '</DL><p>\n';
    const { status, out } = sanitizeText('postdata.html', html);
    expect(status).toBe(0);
    for (const secret of ['jane', 'E48213', 'joint', '4421']) expect(out).not.toContain(secret);
    expect(out).toContain('ADD_DATE="1700000000"');
  });

  it('refuses without repeating what leaked, and says not to paste it', () => {
    const html =
      '<!DOCTYPE NETSCAPE-Bookmark-file-1>\n<DL><p>\n<DT><A HREF="https://a.example.org/">Title</A>\n' +
      '<P>Nguyen private payroll</P>\n</DL><p>\n';
    const { status, stderr } = run([tempFile('leaky.html', html), '--stdout']);
    expect(status).toBe(1);
    for (const secret of ['Nguyen', 'private', 'payroll']) expect(stderr).not.toContain(secret);
    expect(stderr).toMatch(/do not paste/i);
  });
});
