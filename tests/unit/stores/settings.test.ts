import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import { DEFAULT_SETTINGS } from '@/lib/browser/storage';
import {
  applyTheme,
  getSettings,
  isSettingsLoaded,
  loadSettings,
  resetSettings,
  updateSettings,
} from '@/lib/stores/settings.svelte';

beforeEach(async () => {
  fakeBrowser.reset();
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
    updateSettings({ theme: 'light' });
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('debounces writes — rapid changes produce one save', async () => {
    vi.useFakeTimers();
    try {
      updateSettings({ theme: 'dark' });
      updateSettings({ theme: 'light' });
      updateSettings({ csvDelimiter: ';' });

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

  it('still loads when the browser i18n lookup throws', async () => {
    vi.spyOn(fakeBrowser.i18n, 'getUILanguage').mockImplementation(() => {
      throw new Error('not implemented');
    });
    await expect(loadSettings()).resolves.toBeUndefined();
    expect(isSettingsLoaded()).toBe(true);
  });

  it('reset restores the documented defaults and persists them at once', async () => {
    updateSettings({ theme: 'dark', csvDelimiter: ';' });
    await resetSettings();
    expect(getSettings()).toEqual(DEFAULT_SETTINGS);
    const stored = await fakeBrowser.storage.local.get('settings');
    expect(stored.settings).toEqual(DEFAULT_SETTINGS);
  });
});
