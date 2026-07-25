import { describe, expect, it } from 'vitest';
import { joinPath, splitPath } from '@/lib/core/csv-path';
import { BmParseError } from '@/lib/core/model';
import { parseCsv, parseCsvRows } from '@/lib/core/parse/csv';
import { CSV_BOM, type CsvDelimiter, serializeCsv } from '@/lib/core/serialize/csv';

const HEADER = 'folder_path,title,url,add_date';

describe('parseCsvRows — RFC 4180-style torture cases', () => {
  it('unescapes doubled quotes', () => {
    expect(parseCsvRows('a,"say ""hi""",c', ',')).toEqual([['a', 'say "hi"', 'c']]);
  });

  it('keeps delimiters and newlines inside quotes', () => {
    expect(parseCsvRows('"a,b","c\nd"', ',')).toEqual([['a,b', 'c\nd']]);
  });

  it('accepts CRLF, LF and a lone CR as record separators', () => {
    expect(parseCsvRows('a,b\r\nc,d\ne,f\rg,h', ',')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
      ['e', 'f'],
      ['g', 'h'],
    ]);
  });

  it('preserves CRLF inside a quoted field', () => {
    expect(parseCsvRows('"line1\r\nline2",b', ',')).toEqual([['line1\r\nline2', 'b']]);
  });

  it('does not add a phantom row for a trailing newline', () => {
    expect(parseCsvRows('a,b\r\n', ',')).toHaveLength(1);
  });

  it('handles empty fields', () => {
    expect(parseCsvRows('a,,c', ',')).toEqual([['a', '', 'c']]);
  });
});

describe('csv-path escaping', () => {
  it('round-trips slashes and backslashes in folder names', () => {
    for (const segments of [
      ['plain'],
      ['with/slash'],
      ['with\\backslash'],
      ['a/b', 'c\\d'],
      ['\\', '/'],
      ['trailing\\'],
    ]) {
      expect(splitPath(joinPath(segments))).toEqual(segments);
    }
  });

  it('treats an empty path as top level', () => {
    expect(splitPath('')).toEqual([]);
    expect(joinPath([])).toBe('');
  });

  it('distinguishes "no path" from "one folder with an empty title"', () => {
    // Both would serialize to '' naively, dissolving the folder on re-import.
    expect(joinPath([''])).not.toBe('');
    expect(splitPath(joinPath(['']))).toEqual(['']);
  });

  it('keeps an empty-titled folder through a full CSV cycle', () => {
    const tree = [{ title: '', children: [{ title: 'A', url: 'https://a.example/' }] }];
    expect(parseCsv(serializeCsv(tree, { bom: false })).roots).toEqual(tree);
  });
});

describe('parseCsv', () => {
  it('rebuilds folders from paths', () => {
    const csv = `${HEADER}\r\n"Bookmarks bar/Dev tools","GitHub","https://github.com/","1751500000"\r\n"","Example","https://example.com/",""\r\n`;
    const { roots } = parseCsv(csv);
    expect(roots).toEqual([
      {
        title: 'Bookmarks bar',
        children: [
          {
            title: 'Dev tools',
            children: [{ title: 'GitHub', url: 'https://github.com/', addDate: 1751500000 }],
          },
        ],
      },
      { title: 'Example', url: 'https://example.com/' },
    ]);
  });

  it('tolerates a UTF-8 BOM', () => {
    const { roots } = parseCsv(`﻿${HEADER}\r\n"","A","https://a.example/",""\r\n`);
    expect(roots[0]?.url).toBe('https://a.example/');
  });

  it('sniffs the semicolon delimiter from the header', () => {
    const delimiter: CsvDelimiter = ';';
    expect(serializeCsv([], { delimiter, bom: false }).trim()).toContain(delimiter);
    const csv = 'folder_path;title;url;add_date\r\n"";"A";"https://a.example/";""\r\n';
    expect(parseCsv(csv).roots[0]?.url).toBe('https://a.example/');
  });

  it('never sets toolbar — CSV has no column for it (docs/04 §3)', () => {
    const csv = `${HEADER}\r\n"Bookmarks bar","A","https://a.example/",""\r\n`;
    const folder = parseCsv(csv).roots[0];
    expect(folder?.title).toBe('Bookmarks bar');
    expect(Object.hasOwn(folder ?? {}, 'toolbar')).toBe(false);
  });

  it('warns on rows with no URL instead of inventing one', () => {
    const csv = `${HEADER}\r\n"","No link","",""\r\n"","A","https://a.example/",""\r\n`;
    const { roots, warnings } = parseCsv(csv);
    expect(roots).toHaveLength(1);
    expect(warnings.find((w) => w.code === 'MISSING_URL')?.count).toBe(1);
  });

  it('accepts a fully quoted header row', () => {
    const csv = `"folder_path","title","url","add_date"\r\n"","A","https://a.example/",""\r\n`;
    expect(parseCsv(csv).roots[0]?.url).toBe('https://a.example/');
  });

  it('counts synthesized folders against the node cap, not just rows', () => {
    // A file with few rows but very deep paths must not build an unbounded
    // tree: only counting bookmark rows let MAX_NODES be bypassed entirely.
    const deepPath = Array.from({ length: 60 }, (_, i) => `f${i}`).join('/');
    const { stats } = parseCsv(`${HEADER}\r\n"${deepPath}","A","https://a.example/",""\r\n`);
    expect(stats.folders).toBe(60);
  });

  it('throws BAD_CSV_HEADER when the header is missing or reordered', () => {
    expect(() => parseCsv('title,url\r\na,b\r\n')).toThrow(BmParseError);
    expect(() => parseCsv('title,folder_path,url,add_date\r\n')).toThrow(BmParseError);
  });

  it('throws CSV_ROW_MISMATCH with the offending line number', () => {
    const csv = `${HEADER}\r\n"","A","https://a.example/"\r\n`;
    try {
      parseCsv(csv);
      expect.unreachable('should have thrown');
    } catch (err) {
      expect((err as BmParseError).code).toBe('CSV_ROW_MISMATCH');
      expect((err as BmParseError).line).toBe(2);
    }
  });
});

describe('serializeCsv', () => {
  it('quotes only fields that need it, and escapes quotes', () => {
    const csv = serializeCsv(
      [
        { title: 'plain', url: 'https://a.example/' },
        { title: 'has, comma', url: 'https://b.example/' },
        { title: 'has "quote"', url: 'https://c.example/' },
        { title: 'has\nnewline', url: 'https://d.example/' },
      ],
      { bom: false },
    );
    const lines = csv.split('\r\n');
    expect(lines[1]).toBe(',plain,https://a.example/,');
    expect(lines[2]).toBe(',"has, comma",https://b.example/,');
    expect(lines[3]).toBe(',"has ""quote""",https://c.example/,');
  });

  it('writes CRLF records and a BOM by default', () => {
    const csv = serializeCsv([{ title: 'a', url: 'https://a.example/' }]);
    expect(csv.startsWith(CSV_BOM)).toBe(true);
    expect(csv.endsWith('\r\n')).toBe(true);
  });

  it('drops empty folders — the documented CSV loss', () => {
    const csv = serializeCsv([{ title: 'Empty', children: [] }], { bom: false });
    expect(csv.trim()).toBe(HEADER);
  });
});
