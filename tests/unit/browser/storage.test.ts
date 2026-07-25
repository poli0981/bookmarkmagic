import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import {
  DEFAULT_SETTINGS,
  readLegal,
  readSettings,
  writeLegal,
  writeSettings,
} from '@/lib/browser/storage';

// fakeBrowser DOES implement storage.local, so no hand-rolled mock is needed
// here (unlike bookmarks — docs/11 §4).
beforeEach(() => {
  fakeBrowser.reset();
});

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
