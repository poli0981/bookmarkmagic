import { afterEach, describe, expect, it, vi } from 'vitest';
import { MAX_DEPTH, MAX_NODES } from '@/lib/core/limits';
import { parseNetscapeHtml } from '@/lib/core/parse/netscape-html';
import { expectBmError } from '../../../helpers/errors';

/**
 * The tolerance rules added for v1.1.0 (docs/04 §1.2, docs/05 §1). Every case
 * here was a silent loss in v1.0.x: the parser returned a smaller tree than the
 * file held and said nothing.
 */
const DOCTYPE = '<!DOCTYPE NETSCAPE-Bookmark-file-1>\n';
const titles = (text: string): string[] => parseNetscapeHtml(text).roots.map((n) => n.title);

describe('lists after a loose bookmark', () => {
  it('keeps the list a bookmark <DT> swallowed (no </DT>)', () => {
    const text = `${DOCTYPE}<DT><A HREF="https://loose.example/">Loose</A>
<DL><p><DT><H3>F</H3><DL><p><DT><A HREF="https://in.example/">in</A></DL><p>
<DT><A HREF="https://after.example/">After</A></DL><p>`;
    const { roots } = parseNetscapeHtml(text);
    expect(roots.map((n) => n.title)).toEqual(['Loose', 'F', 'After']);
    expect(roots[1]?.children?.map((n) => n.title)).toEqual(['in']);
  });

  it('does not let a bookmark consume the next list (explicit </DT>)', () => {
    const text = `${DOCTYPE}<DT><A HREF="https://loose.example/">Loose</A></DT>
<DL><p><DT><H3>F</H3><DL><p><DT><A HREF="https://in.example/">in</A></DL><p></DL><p>`;
    expect(titles(text)).toEqual(['Loose', 'F']);
  });
});

describe('an unescaped formatting tag in a title', () => {
  it('reads every entry after it', () => {
    const text = `${DOCTYPE}<DL><p>
<DT><A HREF="https://a.example/">C++ <b>tips</A>
<DT><A HREF="https://b.example/">B</A>
<DT><H3>F</H3>
<DL><p><DT><A HREF="https://c.example/">C</A></DL><p>
</DL><p>`;
    const { roots, warnings } = parseNetscapeHtml(text);
    expect(roots.map((n) => n.title)).toEqual(['C++ tips', 'B', 'F']);
    expect(roots[2]?.children?.map((n) => n.title)).toEqual(['C']);
    expect(warnings).toEqual([]);
  });
});

describe('root markers (docs/04 §1.1)', () => {
  it('reads PERSONAL_TOOLBAR_FOLDER by value, not by presence', () => {
    const text = `${DOCTYPE}<DL><p>
<DT><H3 PERSONAL_TOOLBAR_FOLDER="false">Not the bar</H3><DL><p></DL><p>
<DT><H3 PERSONAL_TOOLBAR_FOLDER="true">Bar</H3><DL><p></DL><p>
</DL><p>`;
    const [notBar, bar] = parseNetscapeHtml(text).roots;
    expect(notBar?.toolbar).toBeUndefined();
    expect(bar?.toolbar).toBe(true);
  });

  it('reads UNFILED and MOBILE markers, and lets the toolbar win', () => {
    const text = `${DOCTYPE}<DL><p>
<DT><H3 UNFILED_BOOKMARKS_FOLDER="true">Other</H3><DL><p></DL><p>
<DT><H3 MOBILE_BOOKMARKS_FOLDER="true">Mobile</H3><DL><p></DL><p>
<DT><H3 PERSONAL_TOOLBAR_FOLDER="true" UNFILED_BOOKMARKS_FOLDER="true">Bar</H3><DL><p></DL><p>
<DT><H3 UNFILED_BOOKMARKS_FOLDER="false">Plain</H3><DL><p></DL><p>
</DL><p>`;
    const [other, mobile, bar, plain] = parseNetscapeHtml(text).roots;
    expect(other?.root).toBe('other');
    expect(mobile?.root).toBe('mobile');
    expect(bar).toMatchObject({ toolbar: true });
    expect(bar?.root).toBeUndefined();
    expect(plain?.root).toBeUndefined();
  });
});

describe('addresses (docs/05 §1)', () => {
  it('skips what chrome.bookmarks.create would reject, and counts it', () => {
    const text = `${DOCTYPE}<DL><p>
<DT><A HREF="https://ok.example/">ok</A>
<DT><A HREF="www.no-scheme.test/">no scheme</A>
<DT><A HREF="https://bad host.test/">bad host</A>
<DT><A HREF="place:sort=8">smart</A>
<DT><A HREF="   ">blank</A>
<DT><A HREF="javascript:void(0)">bookmarklet</A>
</DL><p>`;
    const { roots, warnings } = parseNetscapeHtml(text);
    expect(roots.map((n) => n.title)).toEqual(['ok', 'bookmarklet']);
    expect(warnings).toEqual(
      expect.arrayContaining([
        { code: 'INVALID_URL', count: 2 },
        { code: 'PLACE_QUERIES_SKIPPED', count: 1 },
        { code: 'MISSING_URL', count: 1 },
      ]),
    );
  });
});

describe('structure fallbacks', () => {
  it('finds a root list wrapped in a <div>', () => {
    const text = `${DOCTYPE}<div><DL><p><DT><A HREF="https://a.example/">A</A></DL><p></div>`;
    expect(titles(text)).toEqual(['A']);
  });

  it('accepts an empty list one level past the depth cap', () => {
    let text = DOCTYPE;
    for (let i = 0; i < MAX_DEPTH; i++) text += '<DL><p><DT><H3>f</H3>\n';
    text += '<DL><p></DL><p>';
    expect(() => parseNetscapeHtml(text)).not.toThrow();
  });

  it('still refuses an entry past the depth cap', () => {
    let text = DOCTYPE;
    for (let i = 0; i <= MAX_DEPTH; i++) text += '<DL><p><DT><H3>f</H3>\n';
    text += '<DL><p><DT><A HREF="https://deep.example/">deep</A></DL><p>';
    expectBmError(() => parseNetscapeHtml(text), 'TOO_DEEP');
  });
});

describe('the node cap is checked before the DOM is built', () => {
  afterEach(() => vi.restoreAllMocks());

  it('refuses more <DT>s than the cap without parsing the document', () => {
    const spy = vi.spyOn(DOMParser.prototype, 'parseFromString');
    const text = `${DOCTYPE}<DL><p>${'<DT><A HREF="https://a.example/">a</A>'.repeat(MAX_NODES + 1)}</DL><p>`;
    expectBmError(() => parseNetscapeHtml(text), 'TOO_MANY_NODES');
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('Netscape — an <h3> inside a bookmark title (v1.1.0 review)', () => {
  it('stays a bookmark with its whole title, not an empty folder', () => {
    const { roots, stats } = parseNetscapeHtml(
      '<!DOCTYPE NETSCAPE-Bookmark-file-1><DL><p><DT><A HREF="https://a.example/">Intro <h3>Heading</h3> tips</A></DL>',
    );
    expect(roots).toEqual([{ title: 'Intro Heading tips', url: 'https://a.example/' }]);
    expect(stats.folders).toBe(0);
  });
});
