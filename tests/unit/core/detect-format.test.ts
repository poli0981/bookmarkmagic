import { describe, expect, it } from 'vitest';
import { jsonFormatOf, sniffFormat } from '@/lib/core/detect-format';
import { expectBmError } from '../../helpers/errors';

const HTML = '<!DOCTYPE NETSCAPE-Bookmark-file-1>\n<DL><p></DL><p>';
const CSV = 'folder_path,title,url,add_date\r\n,"A",https://a.example/,\r\n';

describe('sniffFormat — content, never the extension', () => {
  it('identifies each kind of text', () => {
    expect(sniffFormat(HTML)).toBe('netscape-html');
    expect(sniffFormat(CSV)).toBe('csv');
    expect(sniffFormat('{"format":"bookmarkmagic"}')).toBe('json');
    expect(sniffFormat('  \n[1, 2]')).toBe('json');
  });

  it('is case-insensitive about the doctype, and looks past leading comments', () => {
    expect(sniffFormat('<!doctype netscape-bookmark-file-1>\n<dl><p></dl>')).toBe('netscape-html');
    expect(sniffFormat('<!-- written by hand -->\n<!DOCTYPE NETSCAPE-Bookmark-file-1>')).toBe(
      'netscape-html',
    );
  });

  it('only trusts the doctype at the start — a CSV title quoting it is still CSV', () => {
    const csv = `${CSV},"<!DOCTYPE NETSCAPE-Bookmark-file-1>",https://b.example/,\r\n`;
    expect(sniffFormat(csv)).toBe('csv');
  });

  it('never reads a JSON title that quotes the doctype as HTML', () => {
    expect(sniffFormat('{"title":"<!DOCTYPE NETSCAPE-Bookmark-file-1>"}')).toBe('json');
  });

  it('accepts a <DL> document with no doctype and lets the parser judge it', () => {
    expect(sniffFormat('<html><body><DL><p><DT><A HREF="x">t</A></DL></body></html>')).toBe(
      'netscape-html',
    );
  });

  it('throws UNKNOWN_FORMAT on anything else', () => {
    expectBmError(() => sniffFormat('just some text\nwith lines\n'), 'UNKNOWN_FORMAT');
    expectBmError(
      () => sniffFormat('<!-- never closed <!DOCTYPE NETSCAPE-Bookmark-file-1>'),
      'UNKNOWN_FORMAT',
    );
  });
});

describe('jsonFormatOf — routes a parsed document by shape', () => {
  it('recognises each dialect', () => {
    expect(jsonFormatOf({ format: 'bookmarkmagic', roots: [] })).toBe('bm-json');
    expect(jsonFormatOf({ checksum: 'x', roots: { bookmark_bar: {} } })).toBe('chrome-json');
    expect(jsonFormatOf({ type: 'text/x-moz-place-container', children: [] })).toBe('firefox-json');
    expect(jsonFormatOf({ root: 'placesRoot', children: [] })).toBe('firefox-json');
  });

  it('answers undefined for anything else, arrays and primitives included', () => {
    for (const doc of [null, 1, 'x', [], {}, { roots: [] }, { roots: { custom_root: {} } }]) {
      expect(jsonFormatOf(doc)).toBeUndefined();
    }
  });
});
