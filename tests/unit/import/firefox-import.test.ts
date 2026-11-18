import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ImportMode } from '@/lib/browser/storage';
import { FakeBookmarks, FIREFOX_ROOTS } from '../../helpers/fake-bookmarks';

/**
 * The import, Replace and export on Firefox — docs/03 §1, docs/02 §4 (since
 * v1.3.0), against the Firefox flavour of the fake (docs/11 §4).
 *
 * Until v1.3.0 `getRoots` fell back to POSITION on Firefox, which lists the
 * Bookmarks Menu first: the Menu was taken for the bar, the bar for Other and
 * Other for Mobile. A Replace emptied the wrong roots and restored into them.
 */
let current = new FakeBookmarks({ flavour: 'firefox' });

vi.mock('wxt/browser', () => ({
  browser: {
    bookmarks: {
      getTree: () => current.getTree(),
      get: (id: string) => current.get(id),
      create: (details: Parameters<FakeBookmarks['create']>[0]) => current.create(details),
      removeTree: (id: string) => current.removeTree(id),
    },
  },
}));

const { getRoots, rootMarkersOf } = await import('@/lib/browser/roots');
const { prepareImport, runImport } = await import('@/lib/import/run-import');
const { buildExport, countSelected } = await import('@/lib/export/run-export');

type PickerHost = { showSaveFilePicker?: unknown };
let backups: string[] = [];

beforeEach(() => {
  current = new FakeBookmarks({ flavour: 'firefox' });
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
  vi.restoreAllMocks();
});

const { menu: MENU, toolbar: TOOLBAR, other: OTHER, mobile: MOBILE } = FIREFOX_ROOTS;

async function importText(text: string, mode: ImportMode) {
  const prepared = await prepareImport(new File([text], 'bookmarks'));
  const outcome = await runImport({
    prepared,
    mode,
    dedupe: false,
    newFolderTitle: 'Imported',
    now: new Date(2026, 10, 18, 12, 0),
    signal: new AbortController().signal,
    onProgress: () => undefined,
  });
  return { prepared, outcome };
}

/** Something in all four roots, and separators in two of them. */
function seedProfile(): void {
  current.seed(MENU, { title: 'm', url: 'https://m.example/' });
  current.addSeparator(MENU);
  current.seed(MENU, { title: 'm2', url: 'https://m2.example/' });
  current.seed(TOOLBAR, { title: 't', url: 'https://t.example/' });
  const dev = current.seed(TOOLBAR, { title: 'Dev' });
  current.addSeparator(dev);
  current.seed(dev, { title: 'd', url: 'https://d.example/' });
  current.seed(OTHER, { title: 'o', url: 'https://o.example/' });
  current.seed(MOBILE, { title: 'p', url: 'https://p.example/' });
}

/** A file with each kind of root, as a BookmarkMagic HTML export writes it. */
const HTML = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<DL><p>
    <DT><A HREF="https://loose.example/">loose</A>
    <DT><H3 PERSONAL_TOOLBAR_FOLDER="true">Bookmarks bar</H3>
    <DL><p>
        <DT><A HREF="https://bar.example/">bar</A>
    </DL><p>
    <DT><H3 UNFILED_BOOKMARKS_FOLDER="true">Other bookmarks</H3>
    <DL><p>
        <DT><A HREF="https://other.example/">other</A>
    </DL><p>
</DL><p>`;

describe('getRoots on Firefox', () => {
  it('finds each root by its GUID — never the Menu as the bar', async () => {
    const roots = await getRoots();
    expect(roots.toolbarId).toBe(TOOLBAR);
    expect(roots.otherId).toBe(OTHER);
    expect(roots.mobileId).toBe(MOBILE);
    expect(roots.menuId).toBe(MENU);
    expect(roots.replaceable.map((root) => root.id)).toEqual([TOOLBAR, OTHER, MOBILE, MENU]);
    expect(rootMarkersOf(roots)).toEqual({
      toolbarId: TOOLBAR,
      otherId: OTHER,
      mobileId: MOBILE,
      menuId: MENU,
    });
  });
});

describe('import on Firefox', () => {
  it('Merge puts each marked root in its own root and loose entries in the Menu', async () => {
    await importText(HTML, 'merge');
    expect(current.childTitles(MENU)).toEqual(['loose']);
    expect(current.childTitles(TOOLBAR)).toEqual(['bar']);
    expect(current.childTitles(OTHER)).toEqual(['other']);
  });

  it('New-folder mode puts the wrapper under Other Bookmarks', async () => {
    await importText(HTML, 'new-folder');
    expect(current.childTitles(OTHER)).toEqual(['Imported']);
    expect(current.childTitles(MENU)).toEqual([]);
  });

  it('counts separators apart, and never as bookmarks, for the Replace confirmation', async () => {
    seedProfile();
    const prepared = await prepareImport(new File([HTML], 'bookmarks'));
    expect(prepared.current).toEqual({ bookmarks: 6, folders: 1, separators: 2 });
  });

  it('Replace empties all four roots, separators included, and restores its backup twice', async () => {
    seedProfile();
    const withoutSeparators = JSON.stringify(current.outline()).replaceAll('"---",', '');

    await importText(HTML, 'replace');
    expect(JSON.stringify(current.outline())).not.toContain('---');
    expect(current.childTitles(MENU)).toEqual(['loose']);
    const backup = backups.at(-1) ?? '';
    // The backup holds the Menu as a marked root and no separator at all.
    expect(backup).toContain('"root":"menu"');
    expect(backup).not.toContain('data:');

    await importText(backup, 'replace');
    expect(JSON.stringify(current.outline())).toBe(withoutSeparators);
    await importText(backup, 'replace');
    expect(JSON.stringify(current.outline())).toBe(withoutSeparators);
  });
});

describe('export on Firefox', () => {
  it('writes no separator, counts none as a bookmark, and leaves the Menu loose in HTML', async () => {
    seedProfile();
    const roots = await getRoots();
    const live = (await current.getTree())[0]?.children ?? [];
    expect(countSelected(live, undefined)).toBe(6);

    const html = buildExport(
      live,
      { format: 'netscape-html', now: new Date() },
      rootMarkersOf(roots),
    );
    expect(html.content).not.toContain('data:');
    expect(html.content).not.toContain('Bookmarks Menu');
    expect(html.content.indexOf('https://m.example/')).toBeLessThan(
      html.content.indexOf('PERSONAL_TOOLBAR_FOLDER'),
    );

    const json = buildExport(live, { format: 'bm-json', now: new Date() }, rootMarkersOf(roots));
    expect(json.content).toContain('"root": "menu"');
  });
});
