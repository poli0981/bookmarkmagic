import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import { DEFAULT_SETTINGS } from '@/lib/browser/storage';
import { getLocale } from '@/lib/i18n/index.svelte';
import {
  adoptExternalSettings,
  applyTheme,
  flushSettings,
  getSettings,
  isSettingsLoaded,
  loadSettings,
  resetSettings,
  updateSettings,
} from '@/lib/stores/settings.svelte';

beforeEach(async () => {
  fakeBrowser.reset();
  // fakeBrowser.reset() clears stored data but leaves spies in place, so a
  // rejecting storage.local.set would leak into every later test in the file.
  vi.restoreAllMocks();
  // fakeBrowser stubs i18n with a throwing "not implemented".
  vi.spyOn(fakeBrowser.i18n, 'getUILanguage').mockReturnValue('en-US');
  document.documentElement.removeAttribute('data-theme');
  await resetSettings();
});

describe('applyTheme', () => {
  it('stamps data-theme for an explicit choice', () => {
    applyTheme('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('REMOVES the attribute for "system" so prefers-color-scheme takes over', () => {
    // tokens.css scopes its dark block to :root:not([data-theme='light']),
    // so leaving a stale attribute would defeat the media query (docs/06 §1).
    applyTheme('light');
    applyTheme('system');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });
});

describe('settings store', () => {
  it('loads persisted values and marks itself ready', async () => {
    await fakeBrowser.storage.local.set({
      settings: { ...DEFAULT_SETTINGS, theme: 'dark', csvDelimiter: ';' },
    });
    await loadSettings();
    expect(isSettingsLoaded()).toBe(true);
    expect(getSettings().csvDelimiter).toBe(';');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('applies a theme change immediately, before the debounced save', () => {
    void updateSettings({ theme: 'light' });
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('debounces writes — rapid changes produce one save', async () => {
    vi.useFakeTimers();
    try {
      void updateSettings({ theme: 'dark' });
      void updateSettings({ theme: 'light' });
      void updateSettings({ csvDelimiter: ';' });

      // Storage still holds what the beforeEach reset wrote — none of the three
      // changes has been flushed yet.
      const pending = await fakeBrowser.storage.local.get('settings');
      expect(pending.settings).toMatchObject({ theme: 'system', csvDelimiter: ',' });

      await vi.advanceTimersByTimeAsync(250);
      const stored = await fakeBrowser.storage.local.get('settings');
      expect(stored.settings).toMatchObject({ theme: 'light', csvDelimiter: ';' });
    } finally {
      vi.useRealTimers();
    }
  });

  it('writes a plain object, not the $state proxy', async () => {
    // chrome.storage.local.set structured-clones its argument, and a Proxy is
    // not cloneable — passing the reactive object straight through throws
    // DataCloneError in a real browser. fakeBrowser stores the reference
    // without cloning, so only an explicit clone here reproduces Chrome.
    vi.useFakeTimers();
    try {
      void updateSettings({ theme: 'dark' });
      await vi.advanceTimersByTimeAsync(250);
      const stored = await fakeBrowser.storage.local.get('settings');
      expect(() => structuredClone(stored.settings)).not.toThrow();
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps a stable object identity so a captured reference cannot go stale', () => {
    // The store mutates in place rather than replacing. A replacement would
    // strand any component that read getSettings() into a local.
    const before = getSettings();
    void updateSettings({ theme: 'dark' });
    expect(getSettings()).toBe(before);
    expect(before.theme).toBe('dark');
  });

  it('resolves the outcome of the write, and never rejects, when storage fails', async () => {
    vi.useFakeTimers();
    try {
      vi.spyOn(fakeBrowser.storage.local, 'set').mockRejectedValue(
        new Error('QUOTA_BYTES quota exceeded'),
      );
      const saving = updateSettings({ theme: 'dark' });
      await vi.advanceTimersByTimeAsync(250);

      const outcome = await saving;
      expect(outcome.ok).toBe(false);
      expect(outcome.detail).toContain('QUOTA_BYTES');
      // The in-session choice is still honoured — only persistence failed.
      expect(getSettings().theme).toBe('dark');
    } finally {
      vi.useRealTimers();
    }
  });

  it('reports success once the debounced write lands', async () => {
    vi.useFakeTimers();
    try {
      const saving = updateSettings({ csvDelimiter: ';' });
      await vi.advanceTimersByTimeAsync(250);
      expect(await saving).toEqual({ ok: true });
    } finally {
      vi.useRealTimers();
    }
  });

  it('flushSettings writes immediately without waiting out the debounce', async () => {
    vi.useFakeTimers();
    try {
      const saving = updateSettings({ csvDelimiter: ';' });
      expect(await flushSettings()).toEqual({ ok: true });

      const stored = await fakeBrowser.storage.local.get('settings');
      expect(stored.settings).toMatchObject({ csvDelimiter: ';' });
      // The caller awaiting the debounced promise is settled by the flush too.
      expect(await saving).toEqual({ ok: true });
    } finally {
      vi.useRealTimers();
    }
  });

  it('flushSettings is a no-op when nothing is pending', async () => {
    expect(await flushSettings()).toEqual({ ok: true });
  });

  it('resolves "auto" against the browser UI language', async () => {
    vi.spyOn(fakeBrowser.i18n, 'getUILanguage').mockReturnValue('ja-JP');
    await updateSettings({ locale: 'auto' });
    expect(getLocale()).toBe('ja');
  });

  it('keeps <html lang> in step with the UI language', async () => {
    // Both entrypoint documents ship lang="en"; without this a screen reader
    // reads VI/JA text with an English voice and pronunciation rules.
    await updateSettings({ locale: 'vi' });
    expect(document.documentElement.lang).toBe('vi');
    await updateSettings({ locale: 'ja' });
    expect(document.documentElement.lang).toBe('ja');
    vi.spyOn(fakeBrowser.i18n, 'getUILanguage').mockReturnValue('en-GB');
    await updateSettings({ locale: 'auto' });
    expect(document.documentElement.lang).toBe('en');
  });

  it('still loads when the browser i18n lookup throws', async () => {
    vi.spyOn(fakeBrowser.i18n, 'getUILanguage').mockImplementation(() => {
      throw new Error('not implemented');
    });
    await expect(loadSettings()).resolves.toBeUndefined();
    expect(isSettingsLoaded()).toBe(true);
  });

  it('reset restores the documented defaults and persists them at once', async () => {
    void updateSettings({ theme: 'dark', csvDelimiter: ';' });
    await resetSettings();
    expect(getSettings()).toEqual(DEFAULT_SETTINGS);
    const stored = await fakeBrowser.storage.local.get('settings');
    expect(stored.settings).toEqual(DEFAULT_SETTINGS);
  });

  it('reset cancels the pending debounced save rather than writing twice', async () => {
    vi.useFakeTimers();
    try {
      const set = vi.spyOn(fakeBrowser.storage.local, 'set');
      void updateSettings({ theme: 'dark' });
      await resetSettings();
      await vi.advanceTimersByTimeAsync(250);

      // Exactly the reset's own write. Letting the debounce fire afterwards
      // would persist the value the user just discarded.
      expect(set).toHaveBeenCalledTimes(1);
      const stored = await fakeBrowser.storage.local.get('settings');
      expect(stored.settings).toEqual(DEFAULT_SETTINGS);
    } finally {
      vi.useRealTimers();
    }
  });
});

/**
 * Cross-tab adoption — docs/03 §4.
 *
 * Two Manager tabs used to silently overwrite each other, because `save()`
 * writes the whole settings object rather than a patch: a tab holding a stale
 * locale reverted the other tab's language change the moment its own theme
 * toggle fired. From the user's side that is "I changed it and it didn't
 * stick", which is unfalsifiable and reads as a bug in the extension.
 */
describe('adoptExternalSettings', () => {
  it('applies a change from another tab, including locale and theme', async () => {
    await updateSettings({ theme: 'light' });
    const changed = adoptExternalSettings({ ...DEFAULT_SETTINGS, theme: 'dark', locale: 'vi' });

    expect(changed).toBe(true);
    expect(getSettings().theme).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(getLocale()).toBe('vi');
  });

  it('mutates in place, so a component that captured the object still sees it', () => {
    const captured = getSettings();
    adoptExternalSettings({ ...DEFAULT_SETTINGS, theme: 'dark' });
    expect(getSettings()).toBe(captured);
    expect(captured.theme).toBe('dark');
  });

  it('ignores an identical value — which is what our own write looks like', () => {
    // Echo suppression falls out of field equality: no snapshot to keep in step,
    // and no dependence on key order.
    expect(adoptExternalSettings({ ...getSettings() })).toBe(false);
  });

  it('does NOT clobber an edit this tab has not persisted yet', async () => {
    // The hazard the whole design exists for. Writes are debounced 200 ms; a
    // change arriving inside that window must lose, because this tab is about
    // to write its entire object over it anyway — adopting first would revert
    // the user's choice in the UI *and* in what gets saved.
    vi.useFakeTimers();
    try {
      void updateSettings({ theme: 'dark' });
      const changed = adoptExternalSettings({ ...DEFAULT_SETTINGS, theme: 'light' });

      expect(changed).toBe(false);
      expect(getSettings().theme).toBe('dark');

      await vi.advanceTimersByTimeAsync(250);
      const stored = await fakeBrowser.storage.local.get('settings');
      expect((stored.settings as { theme: string }).theme).toBe('dark');
    } finally {
      vi.useRealTimers();
    }
  });

  it('adopts again once the pending write has flushed', async () => {
    await updateSettings({ theme: 'dark' });
    await flushSettings();
    expect(adoptExternalSettings({ ...DEFAULT_SETTINGS, theme: 'light' })).toBe(true);
  });

  it('does not write back what it just adopted', async () => {
    // Otherwise two tabs ping-pong the same value forever.
    const spy = vi.spyOn(fakeBrowser.storage.local, 'set');
    adoptExternalSettings({ ...DEFAULT_SETTINGS, theme: 'dark' });
    await flushSettings();
    expect(spy).not.toHaveBeenCalled();
  });
});
