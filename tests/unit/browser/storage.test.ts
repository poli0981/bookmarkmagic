import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import {
  DEFAULT_SETTINGS,
  readLegal,
  readSettings,
  type StorageChange,
  subscribeStorage,
  writeLegal,
  writeSettings,
} from '@/lib/browser/storage';

// fakeBrowser DOES implement storage.local — and, verified before this suite
// was written, storage.onChanged too. No hand-rolled mock is needed here
// (unlike bookmarks — docs/11 §4).
beforeEach(() => {
  fakeBrowser.reset();
  // reset() clears stored data but leaves spies in place, so one test that
  // mocks a storage call would otherwise leak into every later test.
  vi.restoreAllMocks();
});

/** Let the storage event dispatch. */
const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve));

describe('settings', () => {
  it('returns the documented defaults on a fresh profile', async () => {
    expect(await readSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('round-trips a full settings object', async () => {
    const settings = {
      locale: 'vi',
      theme: 'dark',
      defaultExportFormat: 'csv',
      defaultMergeMode: 'merge',
      csvDelimiter: ';',
      markdownStyle: 'flat',
    } as const;
    await writeSettings({ ...settings });
    expect(await readSettings()).toEqual(settings);
  });

  it('falls back per field when a stored value is not a legal option', async () => {
    // A corrupt blob must not brick the Manager — each bad field degrades alone.
    await fakeBrowser.storage.local.set({
      settings: { locale: 'klingon', theme: 'dark', csvDelimiter: '|' },
    });
    const settings = await readSettings();
    expect(settings.locale).toBe(DEFAULT_SETTINGS.locale);
    expect(settings.csvDelimiter).toBe(DEFAULT_SETTINGS.csvDelimiter);
    expect(settings.theme).toBe('dark');
  });

  it('survives a stored value that is not an object at all', async () => {
    await fakeBrowser.storage.local.set({ settings: 'nonsense' });
    expect(await readSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('uses storage.local, never storage.sync (docs/09 §1.3)', async () => {
    await writeSettings({ ...DEFAULT_SETTINGS, theme: 'light' });
    expect(await fakeBrowser.storage.local.get('settings')).toHaveProperty('settings');
    expect(await fakeBrowser.storage.sync.get('settings')).toEqual({});
  });
});

describe('legal acceptance', () => {
  it('is null before anything is accepted', async () => {
    expect(await readLegal()).toBeNull();
  });

  it('records the version and the timestamp it was handed', async () => {
    await writeLegal(1, '2026-07-25T10:00:00.000Z');
    expect(await readLegal()).toEqual({
      acceptedVersion: 1,
      acceptedAt: '2026-07-25T10:00:00.000Z',
    });
  });

  it('rejects a malformed record rather than trusting it', async () => {
    await fakeBrowser.storage.local.set({ legal: { acceptedVersion: 'yes' } });
    expect(await readLegal()).toBeNull();
  });

  it('keeps settings and legal in separate namespaced keys (docs/14 §2)', async () => {
    await writeSettings({ ...DEFAULT_SETTINGS });
    await writeLegal(2, '2026-07-25T10:00:00.000Z');
    const all = await fakeBrowser.storage.local.get(null);
    expect(Object.keys(all).sort()).toEqual(['legal', 'settings']);
  });
});

/**
 * `subscribeStorage` — docs/03 §4.
 *
 * The event fires in every extension context including the one that wrote, so
 * this layer only decodes and hands over; deciding what is an echo belongs to
 * the store, which is the only thing that knows what it was about to write.
 */
describe('subscribeStorage', () => {
  it('reports a settings write made elsewhere, already coerced', async () => {
    const seen: StorageChange[] = [];
    const stop = subscribeStorage((change) => seen.push(change));

    await fakeBrowser.storage.local.set({ settings: { ...DEFAULT_SETTINGS, theme: 'dark' } });
    await settle();

    expect(seen).toHaveLength(1);
    expect(seen[0]?.settings?.theme).toBe('dark');
    stop();
  });

  it('coerces a malformed value field by field rather than passing it through', async () => {
    // A second tab is not a more trustworthy source than disk. It is the disk.
    const seen: StorageChange[] = [];
    const stop = subscribeStorage((change) => seen.push(change));

    await fakeBrowser.storage.local.set({ settings: { theme: 'chartreuse', locale: 'vi' } });
    await settle();

    expect(seen[0]?.settings).toEqual({ ...DEFAULT_SETTINGS, locale: 'vi' });
    stop();
  });

  it('reports a legal acceptance, and a cleared one as null', async () => {
    const seen: StorageChange[] = [];
    const stop = subscribeStorage((change) => seen.push(change));

    await writeLegal(1, '2026-08-03T00:00:00.000Z');
    await settle();
    expect(seen.at(-1)?.legal?.acceptedVersion).toBe(1);

    await fakeBrowser.storage.local.remove('legal');
    await settle();
    expect(seen.at(-1)?.legal).toBeNull();
    stop();
  });

  it('ignores keys this extension does not own', async () => {
    const seen: StorageChange[] = [];
    const stop = subscribeStorage((change) => seen.push(change));

    await fakeBrowser.storage.local.set({ somethingElse: 1 });
    await settle();

    expect(seen).toHaveLength(0);
    stop();
  });

  it('stops delivering once unsubscribed', async () => {
    const seen: StorageChange[] = [];
    const stop = subscribeStorage((change) => seen.push(change));
    stop();

    await writeSettings({ ...DEFAULT_SETTINGS, theme: 'dark' });
    await settle();

    expect(seen).toHaveLength(0);
  });

  it('swallows a throwing handler', async () => {
    // An exception inside a chrome.* listener surfaces as an extension error in
    // chrome://extensions, which docs/11 §5 treats as a failed QA pass.
    const stop = subscribeStorage(() => {
      throw new Error('handler blew up');
    });

    await expect(writeSettings({ ...DEFAULT_SETTINGS })).resolves.toBeUndefined();
    await settle();
    stop();
  });
});
