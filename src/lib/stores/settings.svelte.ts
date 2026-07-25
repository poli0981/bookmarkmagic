/**
 * Persisted settings — docs/03 §4.
 *
 * Writes are debounced 200 ms so dragging a control does not hammer storage.
 * Theme is applied to <html data-theme> here, because that is the one place
 * that knows both the preference and when it changed.
 */
import { browser } from 'wxt/browser';
import {
  DEFAULT_SETTINGS,
  readSettings,
  type Settings,
  type ThemePreference,
  writeSettings,
} from '../browser/storage';
import { setLocale } from '../i18n/index.svelte';
import { resolveLocale } from '../i18n/resolve-locale';

const SAVE_DEBOUNCE_MS = 200;

let settings = $state<Settings>({ ...DEFAULT_SETTINGS });
let loaded = $state(false);
let saveTimer: ReturnType<typeof setTimeout> | undefined;

export function getSettings(): Settings {
  return settings;
}

export function isSettingsLoaded(): boolean {
  return loaded;
}

/** Read persisted settings and apply locale + theme. Call once per page. */
export async function loadSettings(): Promise<void> {
  settings = await readSettings();
  applyLocale();
  applyTheme(settings.theme);
  loaded = true;
}

export function updateSettings(patch: Partial<Settings>): void {
  settings = { ...settings, ...patch };
  if (patch.theme !== undefined) applyTheme(patch.theme);
  if (patch.locale !== undefined) applyLocale();
  scheduleSave();
}

export async function resetSettings(): Promise<void> {
  settings = { ...DEFAULT_SETTINGS };
  applyLocale();
  applyTheme(settings.theme);
  await writeSettings(settings);
}

function scheduleSave(): void {
  if (saveTimer !== undefined) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = undefined;
    void writeSettings(settings);
  }, SAVE_DEBOUNCE_MS);
}

function applyLocale(): void {
  if (settings.locale !== 'auto') {
    setLocale(settings.locale);
    return;
  }
  // A failing i18n lookup must not stop settings from loading — fall back to
  // the default locale rather than leaving the Manager unrendered.
  let uiLanguage = 'en';
  try {
    uiLanguage = browser.i18n.getUILanguage();
  } catch {
    uiLanguage = 'en';
  }
  setLocale(resolveLocale(uiLanguage));
}

/**
 * `system` removes the attribute entirely so the `prefers-color-scheme` media
 * query in tokens.css takes over — that is why tokens.css scopes its dark
 * block to `:root:not([data-theme='light'])`.
 */
export function applyTheme(theme: ThemePreference): void {
  const root = globalThis.document?.documentElement;
  if (root === undefined) return;
  if (theme === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
}
