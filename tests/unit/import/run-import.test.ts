import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ImportMode } from '@/lib/browser/storage';
import { FakeBookmarks } from '../../helpers/fake-bookmarks';

/**
 * The whole import pipeline against an in-memory `chrome.bookmarks` — docs/03 §1.
 *
 * These are the behaviours 1.0.x got wrong in shipped code: Merge that never
 * merged, restores that nested Other and Mobile one level deeper every time,
 * and one bad address aborting a Replace half-way through.
 */
let current = new FakeBookmarks();

vi.mock('wxt/browser', () => ({
  browser: {
    bookmarks: {
      getTree: () => current.getTree(),
      create: (details: Parameters<FakeBookmarks['create']>[0]) => current.create(details),
      removeTree: (id: string) => current.removeTree(id),
    },
  },
}));

const { prepareImport, runImport } = await import('@/lib/import/run-import');

type PickerHost = { showSaveFilePicker?: unknown };

/** The backups the save picker received, newest last. */
let backups: string[] = [];

beforeEach(() => {
  current = new FakeBookmarks();
  backups = [];
  (globalThis as PickerHost).showSaveFilePicker = async () => ({
    createWritable: async () => ({
      write: async (data: string) => {
        backups.push(data);
      },
      close: async () => undefined,
    }),
  });
});

afterEach(() => {
  delete (globalThis as PickerHost).showSaveFilePicker;
});

const fixture = (name: string): string =>
  readFileSync(join(process.cwd(), 'tests', 'fixtures', name), 'utf8');

async function importText(text: string, mode: ImportMode, dedupe = false) {
  const prepared = await prepareImport(new File([text], 'bookmarks'));
  return runImport({
    prepared,
    mode,
    dedupe,
    newFolderTitle: 'Imported',
    now: new Date(2026, 9, 29, 12, 0),
    signal: new AbortController().signal,
    onProgress: () => undefined,
  });
}

/** A profile with something in all three roots. */
function seedProfile(): void {
  current.seed('1', { title: 'a', url: 'https://a.example/' });
  const dev = current.seed('1', { title: 'Dev' });
  current.seed(dev, { title: 'b', url: 'https://b.example/' });
  current.seed('2', { title: 'c', url: 'https://c.example/' });
  const folder = current.seed('2', { title: 'Folder' });
  current.seed(folder, { title: 'd', url: 'https://d.example/' });
  current.seed('3', { title: 'm', url: 'https://m.example/' });
}

describe('Merge', () => {
  it('writes into the folders the user already has', async () => {
    const dev = current.seed('1', { title: 'Dev' });
    current.seed(dev, { title: 'GitHub', url: 'https://github.com/' });

    const outcome = await importText(fixture('chrome-131-export.html'), 'merge', true);

    expect(current.childTitles('1').filter((t) => t === 'Dev')).toHaveLength(1);
    expect(current.childTitles(dev)).toEqual(['GitHub', 'MDN Web Docs']);
    expect(outcome.plan.stats.reusedFolders).toBe(1);
  });

  it('creates nothing the second time, when dedupe is on', async () => {
    const text = fixture('chrome-156-Bookmarks');
    const first = await importText(text, 'merge', true);
    const second = await importText(text, 'merge', true);
    expect(first.created).toBeGreaterThan(0);
    expect(second.created).toBe(0);
    expect(second.plan.stats.skippedExisting).toBe(first.plan.stats.bookmarkCount);
  });

  it('dedupes against the tree as it is at Start, not as it was at preview', async () => {
    const prepared = await prepareImport(
      new File(
        ['<!DOCTYPE NETSCAPE-Bookmark-file-1><DL><DT><A HREF="https://late.example/">x</A></DL>'],
        'f',
      ),
    );
    current.seed('2', { title: 'added meanwhile', url: 'https://late.example/' });
    const outcome = await runImport({
      prepared,
      mode: 'merge',
      dedupe: true,
      newFolderTitle: 'Imported',
      now: new Date(),
      signal: new AbortController().signal,
      onProgress: () => undefined,
    });
    expect(outcome.created).toBe(0);
  });

  it('restores Chrome’s Mobile root from a profile file', async () => {
    await importText(fixture('chrome-156-Bookmarks'), 'merge');
    expect(current.childTitles('3')).toEqual(['Phone news']);
    expect(current.childTitles('2')).toEqual(['Example & friends', 'Reading']);
  });
});

describe('Replace', () => {
  it('restores its own safety backup exactly — twice in a row — with no nesting', async () => {
    seedProfile();
    const original = current.outline();

    await importText(fixture('csv-comma.csv'), 'replace');
    const backup = backups.at(-1) ?? '';
    expect(current.outline()).not.toEqual(original);

    await importText(backup, 'replace');
    expect(current.outline()).toEqual(original);
    await importText(backup, 'replace');
    expect(current.outline()).toEqual(original);
    // Mobile came back as Mobile, not as "Other bookmarks/Mobile bookmarks".
    expect(current.childTitles('3')).toEqual(['m']);
  });

  it('restores a 1.0.x backup into the roots instead of nesting them', async () => {
    await importText(fixture('weird/bm-legacy-1.0.1-backup.json'), 'replace');
    expect(current.childTitles('1')).toEqual(['Bar item']);
    expect(current.childTitles('2')).toEqual(['Other item']);
    expect(current.childTitles('3')).toEqual(['Phone item']);
  });

  it('keeps in-file duplicates, even with the dedupe preference on', async () => {
    const csv =
      'folder_path,title,url,add_date\r\n,a,https://same.example/,\r\n,b,https://same.example/,\r\n';
    const outcome = await importText(csv, 'replace', true);
    expect(outcome.plan.dedupe).toBe(false);
    expect(current.childTitles('2')).toEqual(['a', 'b']);
  });

  it('completes on a file full of addresses Chrome would reject', async () => {
    seedProfile();
    const outcome = await importText(fixture('weird/invalid-urls.html'), 'replace');
    expect(outcome.created).toBe(2);
    expect(current.childTitles('2')).toEqual(['Valid', 'Bookmarklet']);
  });

  it('writes a compact backup before deleting anything', async () => {
    seedProfile();
    const order: string[] = [];
    const removeTree = current.removeTree;
    current.removeTree = async (id) => {
      order.push(backups.length > 0 ? 'remove-after-backup' : 'remove-before-backup');
      await removeTree(id);
    };
    await importText(fixture('csv-comma.csv'), 'replace');
    expect(order.length).toBeGreaterThan(0);
    expect(new Set(order)).toEqual(new Set(['remove-after-backup']));
    expect(backups[0]?.trimEnd()).not.toContain('\n');
  });
});

describe('new folder', () => {
  it('wraps the whole file, root folders included, in one dated folder', async () => {
    await importText(fixture('chrome-156-Bookmarks'), 'new-folder');
    expect(current.childTitles('2')).toEqual(['Imported']);
    // Ids are handed out in creation order, so the wrapper is the first one.
    expect(current.childTitles('100')).toEqual([
      'Bookmarks bar',
      'Other bookmarks',
      'Mobile bookmarks',
    ]);
  });
});

describe('Firefox backups', () => {
  it('names Firefox’s internal roots with the titles the caller passes', async () => {
    const prepared = await prepareImport(
      new File([fixture('firefox-bookmarks-2026-07-25.json')], 'bookmarks-2026-07-25.json'),
      { rootTitles: { toolbar: 'Thanh dấu trang', mobile: 'Dấu trang di động' } },
    );
    expect(prepared.format).toBe('firefox-json');
    expect(prepared.result.roots.map((r) => r.title)).toEqual([
      'Thanh dấu trang',
      'Dấu trang di động',
    ]);
  });
});
