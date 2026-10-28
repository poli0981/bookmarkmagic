import { describe, expect, it } from 'vitest';
import type { BookmarkNode } from '@/lib/core/model';
import {
  escapeMarkdown,
  formatUrl,
  type MarkdownStyle,
  serializeMarkdown,
} from '@/lib/core/serialize/markdown';

const TREE: BookmarkNode[] = [
  {
    title: 'Bookmarks bar',
    children: [
      { title: 'Dev tools', children: [{ title: 'GitHub', url: 'https://github.com/' }] },
      { title: 'Example', url: 'https://example.com/' },
    ],
  },
  { title: 'Loose', url: 'https://loose.example/' },
];

describe('serializeMarkdown — nested (default)', () => {
  const md = serializeMarkdown(TREE, { date: '2026-07-25' });

  it('renders a heading and an indented list', () => {
    expect(md).toBe(
      [
        '# Bookmarks — 2026-07-25',
        '',
        '- **Bookmarks bar**',
        '  - **Dev tools**',
        '    - [GitHub](https://github.com/)',
        '  - [Example](https://example.com/)',
        '- [Loose](https://loose.example/)',
        '',
      ].join('\n'),
    );
  });
});

describe('serializeMarkdown — flat', () => {
  it('uses ## per top-level folder and flattens the links beneath it', () => {
    const style: MarkdownStyle = 'flat';
    const md = serializeMarkdown(TREE, { date: '2026-07-25', style });
    expect(md).toBe(
      [
        '# Bookmarks — 2026-07-25',
        '',
        '- [Loose](https://loose.example/)',
        '',
        '## Bookmarks bar',
        '',
        '- [GitHub](https://github.com/)',
        '- [Example](https://example.com/)',
        '',
      ].join('\n'),
    );
  });
});

describe('markdown escaping', () => {
  it('escapes link syntax in titles', () => {
    expect(escapeMarkdown('a [b] (c) \\d')).toBe('a \\[b\\] \\(c\\) \\\\d');
  });

  it('angle-wraps URLs containing parens or spaces', () => {
    expect(formatUrl('https://a.example/x')).toBe('https://a.example/x');
    expect(formatUrl('https://a.example/a(b)')).toBe('<https://a.example/a(b)>');
    expect(formatUrl('https://a.example/a b')).toBe('<https://a.example/a b>');
  });

  it('percent-encodes what CommonMark forbids inside <...>', () => {
    // An unencoded < > or line ending inside the angle-bracket form makes the
    // whole link render as literal text.
    expect(formatUrl('https://a.example/<x>')).toBe('<https://a.example/%3Cx%3E>');
    expect(formatUrl('https://a.example/a\r\nb')).toBe('<https://a.example/a%0D%0Ab>');
    expect(formatUrl('https://a.example/<')).not.toContain('/<');
  });

  it('keeps a title with brackets from breaking the link', () => {
    const md = serializeMarkdown([{ title: '[x](y)', url: 'https://a.example/(z)' }], {
      date: '2026-07-25',
    });
    expect(md).toContain('- [\\[x\\]\\(y\\)](<https://a.example/(z)>)');
  });

  it('ends with exactly one newline, however the tree ends', () => {
    for (const style of ['nested', 'flat'] as const) {
      expect(serializeMarkdown([], { date: 'd', style })).toBe('# Bookmarks — d\n');
      const md = serializeMarkdown([{ title: 'Empty', children: [] }], { date: 'd', style });
      expect(md.endsWith('\n')).toBe(true);
      expect(md.endsWith('\n\n')).toBe(false);
    }
  });

  it('collapses a long newline run in a title, and still ends with one newline', () => {
    // The old `/\n+$/` re-scanned a run like this once per newline before
    // failing; line breaks in titles now collapse, so the run cannot reach it.
    const run = '\n'.repeat(20_000);
    const md = serializeMarkdown([{ title: `a${run}b`, children: [] }], { date: 'd' });
    expect(md).toContain(`- **a${' '.repeat(20_000)}b**`);
    expect(md.endsWith('**\n')).toBe(true);
  });

  it('makes raw HTML in a title inert text (docs/09 T1)', () => {
    const md = serializeMarkdown(
      [{ title: '<img src=x onerror=alert(1)>', url: 'https://a.example/' }],
      {
        date: 'd',
      },
    );
    expect(md).not.toMatch(/(?<!\\)</);
    expect(md).toContain('\\<img src=x onerror=alert\\(1\\)\\>');
  });

  it('escapes emphasis, code, heading and list markers', () => {
    expect(escapeMarkdown('**bold** _it_ `code` # h + - . ! | ~ &amp;')).toBe(
      '\\*\\*bold\\*\\* \\_it\\_ \\`code\\` \\# h \\+ \\- \\. \\! \\| \\~ \\&amp;',
    );
  });

  it('keeps a title with a line break on its own list line', () => {
    const md = serializeMarkdown([{ title: 'a\r\n\r\n# b\nc', url: 'https://a.example/' }], {
      date: 'd',
    });
    expect(md).toContain('- [a  \\# b c](https://a.example/)');
    expect(md.split('\n').filter((line) => line.startsWith('#'))).toHaveLength(1);
  });
});
