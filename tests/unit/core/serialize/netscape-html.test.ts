import { describe, expect, it } from 'vitest';
import type { BookmarkNode } from '@/lib/core/model';
import { parseNetscapeHtml } from '@/lib/core/parse/netscape-html';
import { escapeHtml, serializeNetscapeHtml } from '@/lib/core/serialize/netscape-html';

/** docs/11 §3 names this suite; it did not exist before v1.1.0. */
const TREE: BookmarkNode[] = [
  {
    title: 'Bookmarks bar',
    toolbar: true,
    addDate: 1700000000,
    lastModified: 1700000100,
    children: [{ title: 'A & <B>', url: 'https://a.example/?x=1&y="2"', addDate: 1700000001 }],
  },
  {
    title: 'Other bookmarks',
    root: 'other',
    children: [{ title: 'O', url: 'https://o.example/' }],
  },
  { title: 'Mobile bookmarks', root: 'mobile', children: [] },
  { title: 'Loose', url: 'https://loose.example/' },
];

const GOLDEN = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<!-- This is an automatically generated file. It will be read and overwritten. DO NOT EDIT! -->
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
    <DT><H3 ADD_DATE="1700000000" LAST_MODIFIED="1700000100" PERSONAL_TOOLBAR_FOLDER="true">Bookmarks bar</H3>
    <DL><p>
        <DT><A HREF="https://a.example/?x=1&amp;y=&quot;2&quot;" ADD_DATE="1700000001">A &amp; &lt;B&gt;</A>
    </DL><p>
    <DT><H3 UNFILED_BOOKMARKS_FOLDER="true">Other bookmarks</H3>
    <DL><p>
        <DT><A HREF="https://o.example/">O</A>
    </DL><p>
    <DT><H3 MOBILE_BOOKMARKS_FOLDER="true">Mobile bookmarks</H3>
    <DL><p>
    </DL><p>
    <DT><A HREF="https://loose.example/">Loose</A>
</DL><p>
`;

describe('serializeNetscapeHtml', () => {
  it('matches the golden file: 4-space indent, attributes only when present', () => {
    expect(serializeNetscapeHtml(TREE)).toBe(GOLDEN);
  });

  it('writes exactly one root marker per folder, the toolbar winning', () => {
    const html = serializeNetscapeHtml([
      { title: 'both', toolbar: true, root: 'other', children: [] },
    ]);
    expect(html).toContain('PERSONAL_TOOLBAR_FOLDER="true"');
    expect(html).not.toContain('UNFILED_BOOKMARKS_FOLDER');
  });

  it('round-trips the markers through our own parser', () => {
    const back = parseNetscapeHtml(serializeNetscapeHtml(TREE)).roots;
    expect(back.map((n) => [n.title, n.toolbar, n.root])).toEqual([
      ['Bookmarks bar', true, undefined],
      ['Other bookmarks', undefined, 'other'],
      ['Mobile bookmarks', undefined, 'mobile'],
      ['Loose', undefined, undefined],
    ]);
  });

  it('escapes the four markup characters and CR, nothing else', () => {
    expect(escapeHtml(`a&b<c>d"e'f\r\n`)).toBe(`a&amp;b&lt;c&gt;d&quot;e'f&#13;\n`);
  });
});
