import { describe, expect, it } from 'vitest';
import { classifyHref } from '@/lib/core/href';

describe('classifyHref — what is worth importing (docs/05 §1)', () => {
  it.each([
    ['https://example.com/', 'ok'],
    ['http://例え.jp/パス', 'ok'],
    ['ftp://files.example.org/pub', 'ok'],
    ['file:///C:/notes.txt', 'ok'],
    ['javascript:void(0)', 'ok'],
    ['data:text/html,<b>x</b>', 'ok'],
    ['about:blank', 'ok'],
    ['chrome://settings', 'ok'],
    ['  https://padded.example/  ', 'ok'],
    ['', 'missing'],
    ['   ', 'missing'],
    [null, 'missing'],
    [undefined, 'missing'],
    ['www.no-scheme.example/', 'invalid'],
    ['example.com', 'invalid'],
    ['https://bad host.example/', 'invalid'],
    ['http://[::1', 'invalid'],
    ['place:sort=8&maxResults=10', 'place-query'],
    ['  PLACE:folder=TOOLBAR', 'place-query'],
  ] as const)('%j → %s', (raw, verdict) => {
    expect(classifyHref(raw)).toBe(verdict);
  });
});
