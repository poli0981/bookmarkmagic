import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseBookmarkFile } from '@/lib/core/parse-file';
import { expectBmError } from '../../helpers/errors';

const HTML =
  '<!DOCTYPE NETSCAPE-Bookmark-file-1>\n<DL><p><DT><A HREF="https://a.example/">a</A></DL>';
const CSV = 'folder_path,title,url,add_date\r\n,"A",https://a.example/,\r\n';
const BM =
  '{"format":"bookmarkmagic","version":1,"roots":[{"title":"a","url":"https://a.example/"}]}';
const CHROME =
  '{"roots":{"bookmark_bar":{"type":"folder","name":"Bar","children":[{"type":"url","name":"a","url":"https://a.example/"}]}}}';
const FIREFOX =
  '{"type":"text/x-moz-place-container","root":"placesRoot","children":[{"type":"text/x-moz-place-container","root":"toolbarFolder","title":"toolbar","children":[{"type":"text/x-moz-place","title":"a","uri":"https://a.example/"}]}]}';

afterEach(() => {
  vi.restoreAllMocks();
});

/** The single read entry point — docs/03 §1 steps 3-4. */
describe('parseBookmarkFile', () => {
  it.each([
    ['netscape-html', HTML],
    ['csv', CSV],
    ['bm-json', BM],
    ['chrome-json', CHROME],
    ['firefox-json', FIREFOX],
  ])('reads %s and reports the format it chose', (format, text) => {
    const parsed = parseBookmarkFile(text);
    expect(parsed.format).toBe(format);
    expect(parsed.result.stats.bookmarks).toBe(1);
  });

  it('tolerates a BOM the read layer did not strip, on every format', () => {
    for (const text of [HTML, CSV, BM, CHROME, FIREFOX]) {
      expect(parseBookmarkFile(`﻿${text}`).result.stats.bookmarks).toBe(1);
    }
  });

  it('parses JSON exactly once, however many dialects it has to try', () => {
    const spy = vi.spyOn(JSON, 'parse');
    parseBookmarkFile(FIREFOX);
    expect(spy).toHaveBeenCalledOnce();
  });

  it('passes localized titles through to the roots a file names only by key', () => {
    const { result } = parseBookmarkFile(FIREFOX, { rootTitles: { toolbar: 'Thanh dấu trang' } });
    expect(result.roots[0]?.title).toBe('Thanh dấu trang');
  });

  it('tells malformed JSON apart from JSON that is simply not a bookmark file', () => {
    expectBmError(() => parseBookmarkFile('{"format": "bookmarkmagic",'), 'MALFORMED_JSON');
    expectBmError(() => parseBookmarkFile('{"some":"settings file"}'), 'NOT_BM_JSON');
    expectBmError(() => parseBookmarkFile('[{"title":"a"}]'), 'NOT_BM_JSON');
  });

  it('refuses text that is no format at all', () => {
    expectBmError(() => parseBookmarkFile('hello\nworld\n'), 'UNKNOWN_FORMAT');
  });
});
