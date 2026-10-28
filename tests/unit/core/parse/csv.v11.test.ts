import { describe, expect, it } from 'vitest';
import { parseCsv } from '@/lib/core/parse/csv';
import { serializeCsv } from '@/lib/core/serialize/csv';
import { expectBmError } from '../../../helpers/errors';

/** CSV rules added in v1.1.0 — docs/04 §3. */
const HEADER = 'folder_path,title,url,add_date\r\n';

describe('CSV — tolerance', () => {
  it('refuses an unterminated quote and names the line it opened on', () => {
    const text = `${HEADER}A,ok,https://a.example/,1\r\n,"broken,https://b.example/,2\r\nX,y,https://c.example/,3\r\n`;
    const err = expectBmError(() => parseCsv(text), 'CSV_UNCLOSED_QUOTE');
    expect(err.line).toBe(3);
  });

  it('skips whitespace-only and padding rows, and an Excel sep= line', () => {
    const text = `sep=,\r\n${HEADER}   \r\n,,,\r\nA,ok,https://a.example/,1\r\n`;
    const { roots, warnings } = parseCsv(text);
    expect(roots[0]?.children?.map((n) => n.title)).toEqual(['ok']);
    expect(warnings).toEqual([]);
  });

  it('keeps an empty title empty and counts it', () => {
    const { roots, warnings } = parseCsv(`${HEADER},,https://a.example/,\r\n`);
    expect(roots[0]?.title).toBe('');
    expect(warnings).toContainEqual({ code: 'EMPTY_TITLE', count: 1 });
  });

  it('skips addresses Chrome would reject, and keeps place:', () => {
    const { roots, warnings } = parseCsv(
      `${HEADER},bad,www.no-scheme.example,\r\n,smart,place:sort=8,\r\n`,
    );
    expect(roots.map((n) => n.url)).toEqual(['place:sort=8']);
    expect(warnings).toContainEqual({ code: 'INVALID_URL', count: 1 });
  });
});

describe('CSV — formula cells', () => {
  it('neutralizes them on export and restores them exactly on import', () => {
    const titles = [
      '=SUM(A1)',
      '+1 idea',
      '-20% off',
      '@user',
      "'=already quoted",
      "'plain",
      'normal',
    ];
    const tree = [
      {
        title: '=Folder',
        children: titles.map((title, i) => ({ title, url: `https://e.example/${i}` })),
      },
    ];
    const csv = serializeCsv(tree);
    expect(csv).toContain("'=SUM(A1)");
    expect(csv).toContain("''=already quoted");
    expect(csv).not.toMatch(/(?:^|[\r\n,])=/);
    const back = parseCsv(csv).roots;
    expect(back[0]?.title).toBe('=Folder');
    expect(back[0]?.children?.map((n) => n.title)).toEqual(titles);
  });
});

describe('CSV — folders', () => {
  it('merges same-named sibling folders — a documented CSV loss', () => {
    const tree = [
      { title: 'New folder', children: [{ title: 'a', url: 'https://a.example/' }] },
      { title: 'New folder', children: [{ title: 'b', url: 'https://b.example/' }] },
    ];
    const back = parseCsv(serializeCsv(tree)).roots;
    expect(back).toHaveLength(1);
    expect(back[0]?.children?.map((n) => n.title)).toEqual(['a', 'b']);
  });

  it('stays fast on one huge folder followed by its subfolder', () => {
    // The sibling lookup was a linear find, so every A/B row scanned all of A.
    const rows = [HEADER];
    for (let i = 0; i < 20_000; i++) rows.push(`A,t${i},https://a.example/${i},\r\n`);
    for (let i = 0; i < 20_000; i++) rows.push(`A/B,u${i},https://b.example/${i},\r\n`);
    const started = performance.now();
    const { stats } = parseCsv(rows.join(''));
    expect(stats.bookmarks).toBe(40_000);
    expect(performance.now() - started).toBeLessThan(5_000);
  });
});
