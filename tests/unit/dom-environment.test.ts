import { describe, expect, it } from 'vitest';

/**
 * Environment canary — docs/02 §3, docs/11 §1.
 *
 * The whole Netscape parser walk rests on two DOM behaviours: HTML5 "generate
 * implied end tags", which nests a folder's child <DL> INSIDE the unclosed
 * <DT> before it, and `:scope >` selectors evaluated from an element root.
 * jsdom (parse5) implements both; happy-dom does not.
 *
 * If someone swaps the test environment, this fails loudly here instead of
 * every folder silently parsing as childless in the real suite.
 */
const CHROME_SHAPE = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<DL><p>
    <DT><H3 PERSONAL_TOOLBAR_FOLDER="true">Bookmarks bar</H3>
    <DL><p>
        <DT><A HREF="https://example.com/">Example</A>
    </DL><p>
</DL><p>`;

describe('DOM environment', () => {
  const doc = new DOMParser().parseFromString(CHROME_SHAPE, 'text/html');

  it('nests a folder child <DL> inside the preceding unclosed <DT>', () => {
    const dt = doc.querySelector('dl > dt');
    expect(dt).not.toBeNull();
    expect(dt?.querySelector(':scope > dl')).not.toBeNull();
  });

  it('supports :scope > selectors from an element root', () => {
    const dt = doc.querySelector('dl > dt');
    expect(dt?.querySelector(':scope > h3')?.textContent).toBe('Bookmarks bar');
  });

  it('produces an inert document — scripts never execute (docs/09 T1)', () => {
    const hostile = new DOMParser().parseFromString(
      '<!DOCTYPE NETSCAPE-Bookmark-file-1><DL><p><DT><A HREF="https://x.test/" ' +
        'onerror="globalThis.__pwned = true">t</A><script>globalThis.__pwned = true;</script></DL>',
      'text/html',
    );
    expect(hostile.querySelector('a')?.textContent).toBe('t');
    expect((globalThis as Record<string, unknown>).__pwned).toBeUndefined();
  });
});
