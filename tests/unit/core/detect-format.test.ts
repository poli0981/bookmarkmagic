import { describe, expect, it } from 'vitest';
import { detectFormat, stripBom } from '@/lib/core/detect-format';
import { BmParseError } from '@/lib/core/model';

const HTML = '<!DOCTYPE NETSCAPE-Bookmark-file-1>\n<DL><p></DL><p>';
const JSON_DOC = '{"format":"bookmarkmagic","version":1,"roots":[]}';
const CSV = 'folder_path,title,url,add_date\r\n,"A",https://a.example/,\r\n';

describe('detectFormat — sniffs content, never the extension', () => {
  it('identifies each format', () => {
    expect(detectFormat(HTML)).toBe('netscape-html');
    expect(detectFormat(JSON_DOC)).toBe('bm-json');
    expect(detectFormat(CSV)).toBe('csv');
  });

  it('is case-insensitive about the doctype', () => {
    expect(detectFormat('<!doctype netscape-bookmark-file-1>\n<dl><p></dl>')).toBe('netscape-html');
  });

  it('ignores a wrong extension — the caller never passes one', () => {
    // A .json file that is really HTML, and a .html file that is really CSV.
    expect(detectFormat(HTML)).toBe('netscape-html');
    expect(detectFormat(CSV)).toBe('csv');
  });

  it('tolerates a leading BOM on every format', () => {
    expect(detectFormat(`﻿${HTML}`)).toBe('netscape-html');
    expect(detectFormat(`﻿${JSON_DOC}`)).toBe('bm-json');
    expect(detectFormat(`﻿${CSV}`)).toBe('csv');
  });

  it('rejects JSON that is not ours', () => {
    // Chrome's internal Bookmarks file is explicitly out of scope for v1.
    expect(() => detectFormat('{"checksum":"x","roots":{"bookmark_bar":{}}}')).toThrow(
      BmParseError,
    );
  });

  it('accepts a <DL> document with no doctype and lets the parser judge it', () => {
    expect(detectFormat('<html><body><DL><p><DT><A HREF="x">t</A></DL></body></html>')).toBe(
      'netscape-html',
    );
  });

  it('throws UNKNOWN_FORMAT on anything else', () => {
    try {
      detectFormat('just some text\nwith lines\n');
      expect.unreachable('should have thrown');
    } catch (err) {
      expect((err as BmParseError).code).toBe('UNKNOWN_FORMAT');
    }
  });
});

describe('stripBom', () => {
  it('removes only a leading U+FEFF', () => {
    expect(stripBom('﻿abc')).toBe('abc');
    expect(stripBom('abc')).toBe('abc');
    expect(stripBom('a﻿b')).toBe('a﻿b');
  });
});
