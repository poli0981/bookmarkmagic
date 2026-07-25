import { describe, expect, it } from 'vitest';
import { BmParseError } from '@/lib/core/model';
import { parseNetscapeHtml } from '@/lib/core/parse/netscape-html';
import { escapeHtml, serializeNetscapeHtml } from '@/lib/core/serialize/netscape-html';

const CHROME = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
    <DT><H3 ADD_DATE="1751500000" LAST_MODIFIED="1751500001" PERSONAL_TOOLBAR_FOLDER="true">Bookmarks bar</H3>
    <DL><p>
        <DT><A HREF="https://example.com/" ADD_DATE="1751500000">Example</A>
        <DT><H3 ADD_DATE="1751500000">Dev tools</H3>
        <DL><p>
            <DT><A HREF="https://github.com/" ADD_DATE="1751500000">GitHub</A>
        </DL><p>
    </DL><p>
    <DT><H3>Other</H3>
    <DL><p></DL><p>
</DL><p>`;

describe('parseNetscapeHtml — Chrome shape', () => {
  const result = parseNetscapeHtml(CHROME);

  it('reads the toolbar folder and its nested children', () => {
    expect(result.roots).toHaveLength(2);
    const bar = result.roots[0];
    expect(bar?.title).toBe('Bookmarks bar');
    expect(bar?.toolbar).toBe(true);
    expect(bar?.addDate).toBe(1751500000);
    expect(bar?.lastModified).toBe(1751500001);
    expect(bar?.children).toHaveLength(2);
    expect(bar?.children?.[1]?.children?.[0]?.url).toBe('https://github.com/');
  });

  it('preserves empty folders', () => {
    expect(result.roots[1]?.title).toBe('Other');
    expect(result.roots[1]?.children).toEqual([]);
  });

  it('computes stats over the whole tree', () => {
    expect(result.stats).toEqual({ bookmarks: 2, folders: 3, maxDepth: 3 });
  });

  it('marks non-toolbar folders by omitting the flag, not setting it false', () => {
    expect(Object.hasOwn(result.roots[1] ?? {}, 'toolbar')).toBe(false);
  });
});

describe('parseNetscapeHtml — tolerated shapes', () => {
  it('survives a <DD> between a folder and its child list (docs/04 §1.2)', () => {
    const withDd = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<DL><p>
    <DT><H3>Folder</H3>
    <DD>a description that closes the DT and swallows the DL
    <DL><p>
        <DT><A HREF="https://kept.example/">Kept</A>
    </DL><p>
</DL><p>`;
    const { roots, warnings } = parseNetscapeHtml(withDd);
    expect(roots[0]?.children?.[0]?.url).toBe('https://kept.example/');
    expect(warnings.map((w) => w.code)).toContain('DESCRIPTIONS_DROPPED');
  });

  it('handles an explicit </DT> producing a sibling <DL> (docs/05 §1 case 3)', () => {
    const explicitClose = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<DL><p>
    <DT><H3>Folder</H3></DT>
    <DL><p>
        <DT><A HREF="https://sibling.example/">Sibling</A></DT>
    </DL><p>
</DL><p>`;
    const { roots } = parseNetscapeHtml(explicitClose);
    expect(roots[0]?.children?.[0]?.url).toBe('https://sibling.example/');
  });

  it('skips <HR> separators silently and keeps both neighbours (docs/04 §1.2)', () => {
    const withHr = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<DL><p>
    <DT><A HREF="https://a.example/">A</A>
    <HR>
    <DT><A HREF="https://b.example/">B</A>
</DL><p>`;
    const { roots, warnings } = parseNetscapeHtml(withHr);
    expect(roots.map((r) => r.url)).toEqual(['https://a.example/', 'https://b.example/']);
    expect(warnings).toEqual([]);
  });

  it('looks past a <DD> that has no nested <DL> to a later sibling list', () => {
    // Some exporters close the DD explicitly, so the DL lands after it rather
    // than inside it — nextDlFor must keep walking siblings.
    const ddThenDl = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<DL><p>
    <DT><H3>Folder</H3>
    <DD>description</DD>
    <DL><p><DT><A HREF="https://after-dd.example/">After DD</A></DL><p>
</DL><p>`;
    const { roots } = parseNetscapeHtml(ddThenDl);
    expect(roots[0]?.children?.[0]?.url).toBe('https://after-dd.example/');
  });

  it('treats a folder followed straight by another entry as empty', () => {
    const emptyThenEntry = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<DL><p>
    <DT><H3>Empty</H3></DT>
    <DT><A HREF="https://next.example/">Next</A>
</DL><p>`;
    const { roots } = parseNetscapeHtml(emptyThenEntry);
    expect(roots[0]).toEqual({ title: 'Empty', children: [] });
    expect(roots[1]?.url).toBe('https://next.example/');
  });

  it('skips an <A> with no usable HREF and warns', () => {
    const noHref = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<DL><p>
    <DT><A>No href at all</A>
    <DT><A HREF="   ">Blank href</A>
    <DT><A HREF="https://ok.example/">OK</A>
</DL><p>`;
    const { roots, warnings } = parseNetscapeHtml(noHref);
    expect(roots).toHaveLength(1);
    expect(warnings.find((w) => w.code === 'MISSING_URL')?.count).toBe(2);
  });

  it('falls back to the href when a bookmark has no text', () => {
    const noTitle = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<DL><p><DT><A HREF="https://untitled.example/"></A></DL><p>`;
    const { roots, warnings } = parseNetscapeHtml(noTitle);
    expect(roots[0]?.title).toBe('https://untitled.example/');
    expect(warnings.map((w) => w.code)).toContain('EMPTY_TITLE');
  });

  it('ignores a <DT> that holds neither an <H3> nor an <A>', () => {
    const junk = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<DL><p>
    <DT>just text
    <DT><A HREF="https://ok.example/">OK</A>
</DL><p>`;
    expect(parseNetscapeHtml(junk).roots).toHaveLength(1);
  });

  it('aggregates favicon warnings into a single entry', () => {
    const icons = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<DL><p>
    <DT><A HREF="https://a.example/" ICON="data:image/png;base64,AAA">A</A>
    <DT><A HREF="https://b.example/" ICON_URI="https://b.example/f.ico">B</A>
</DL><p>`;
    const { warnings } = parseNetscapeHtml(icons);
    const favicon = warnings.filter((w) => w.code === 'FAVICONS_IGNORED');
    expect(favicon).toHaveLength(1);
    expect(favicon[0]?.count).toBe(2);
  });

  it('ignores unknown Firefox/Safari/IE attributes silently', () => {
    const extras = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<DL><p>
    <DT><A HREF="https://a.example/" SHORTCUTURL="a" TAGS="x,y" LAST_CHARSET="UTF-8" LAST_VISIT="123">A</A>
</DL><p>`;
    const { roots, warnings } = parseNetscapeHtml(extras);
    expect(roots[0]?.url).toBe('https://a.example/');
    expect(warnings.map((w) => w.code)).not.toContain('DESCRIPTIONS_DROPPED');
  });

  it('reads sibling folders inside a normal wrapper <DL>', () => {
    const wrapped = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<H1>Bookmarks</H1>
<DL><p>
    <DT><H3>A</H3>
    <DL><p><DT><A HREF="https://a.example/">a</A></DL><p>
    <DT><H3>B</H3>
    <DL><p><DT><A HREF="https://b.example/">b</A></DL><p>
</DL><p>`;
    const { roots } = parseNetscapeHtml(wrapped);
    expect(roots.map((r) => r.title)).toEqual(['A', 'B']);
  });

  it('handles top-level folders with NO wrapper <DL> (Mozilla bug 801450)', () => {
    // The real Safari shape: DT>H3 sit directly under <body>. Taking "the first
    // outermost DL" here returns folder A's *inner* list, silently reporting a
    // clean parse of one bookmark and dropping A, B and b entirely.
    const safari = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<H1>Bookmarks</H1>
<DT><H3>A</H3>
<DL><p><DT><A HREF="https://a.example/">a</A></DL><p>
<DT><H3>B</H3>
<DL><p><DT><A HREF="https://b.example/">b</A></DL><p>`;
    const { roots, stats } = parseNetscapeHtml(safari);
    expect(roots.map((r) => r.title)).toEqual(['A', 'B']);
    expect(roots[1]?.children?.[0]?.url).toBe('https://b.example/');
    expect(stats).toEqual({ bookmarks: 2, folders: 2, maxDepth: 2 });
  });

  it('handles a file that mixes a wrapper <DL> with loose top-level <DT>s', () => {
    const mixed = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<H1>Bookmarks</H1>
<DL><p>
    <DT><H3>Bookmarks bar</H3>
    <DL><p><DT><A HREF="https://in.example/">in</A></DL><p>
</DL><p>
<DT><H3>Other Bookmarks</H3>
<DL><p><DT><A HREF="https://out.example/">out</A></DL><p>`;
    const { roots } = parseNetscapeHtml(mixed);
    expect(roots.map((r) => r.title)).toEqual(['Bookmarks bar', 'Other Bookmarks']);
  });

  it('does not emit a body-level child <DL> twice when </DT> is explicit', () => {
    // Here the folder's child list is ALSO a body child. Naively treating every
    // body-level DL as a root list would duplicate the subtree.
    const explicit = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<DT><H3>X</H3></DT>
<DL><p><DT><A HREF="https://once.example/">once</A></DL><p>`;
    const { roots, stats } = parseNetscapeHtml(explicit);
    expect(roots).toHaveLength(1);
    expect(roots[0]?.title).toBe('X');
    expect(stats).toEqual({ bookmarks: 1, folders: 1, maxDepth: 2 });
  });

  it('treats ADD_DATE="0" as absent without warning (docs/05 §4)', () => {
    const zero = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<DL><p><DT><A HREF="https://a.example/" ADD_DATE="0">A</A></DL><p>`;
    const { roots, warnings } = parseNetscapeHtml(zero);
    expect(Object.hasOwn(roots[0] ?? {}, 'addDate')).toBe(false);
    expect(warnings.map((w) => w.code)).not.toContain('INVALID_DATE');
  });

  it('returns an empty result for a doctype-only file, not a crash', () => {
    const { roots, warnings } = parseNetscapeHtml('<!DOCTYPE NETSCAPE-Bookmark-file-1>\n');
    expect(roots).toEqual([]);
    expect(warnings.map((w) => w.code)).toContain('NO_BOOKMARKS');
  });

  it('keeps injected markup as inert text', () => {
    const hostile = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<DL><p><DT><A HREF="https://a.example/">&lt;script&gt;alert(1)&lt;/script&gt;</A></DL><p>`;
    const { roots } = parseNetscapeHtml(hostile);
    expect(roots[0]?.title).toBe('<script>alert(1)</script>');
  });
});

describe('parseNetscapeHtml — hard failures', () => {
  it('throws NOT_NETSCAPE when there is neither doctype nor <DL>', () => {
    expect(() => parseNetscapeHtml('<html><body><p>nope</p></body></html>')).toThrow(BmParseError);
    try {
      parseNetscapeHtml('<html><body><p>nope</p></body></html>');
    } catch (err) {
      expect((err as BmParseError).code).toBe('NOT_NETSCAPE');
    }
  });

  it('throws TOO_DEEP past the depth cap', () => {
    const open = '<DL><p><DT><H3>f</H3>'.repeat(205);
    const close = '</DL><p>'.repeat(205);
    try {
      parseNetscapeHtml(`<!DOCTYPE NETSCAPE-Bookmark-file-1>${open}${close}`);
      expect.unreachable('should have thrown');
    } catch (err) {
      expect((err as BmParseError).code).toBe('TOO_DEEP');
    }
  });
});

describe('escapeHtml', () => {
  it('escapes exactly the four characters that can break text or an attribute', () => {
    expect(escapeHtml('a & b < c > d " e')).toBe('a &amp; b &lt; c &gt; d &quot; e');
  });

  it('escapes & first so entities are not double-encoded into nonsense', () => {
    expect(escapeHtml('&lt;')).toBe('&amp;lt;');
  });

  it('leaves single quotes alone — we only ever emit double-quoted attributes', () => {
    expect(escapeHtml("it's")).toBe("it's");
  });
});

describe('round-trip HTML', () => {
  it('parse(serialize(parse(x))) is stable', () => {
    const once = parseNetscapeHtml(CHROME);
    const twice = parseNetscapeHtml(serializeNetscapeHtml(once.roots));
    expect(twice.roots).toEqual(once.roots);
  });

  it('escapes and restores the four special characters', () => {
    const tree = [{ title: 'a & b < c > d " e', url: 'https://x.test/?a=1&b=2' }];
    const back = parseNetscapeHtml(serializeNetscapeHtml(tree));
    expect(back.roots).toEqual(tree);
  });
});
