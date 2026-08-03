/**
 * Persisted settings — docs/03 §4.
 *
 * Purpose: the single source of truth for locale, theme and the per-tab
 *   defaults, plus the only path that writes them to storage.
 * Inputs: `updateSettings` patches from the Settings tab and header controls.
 * Guarantees: writes are debounced 200 ms; the returned promise resolves when
 *   that write has actually *settled*, and never rejects — so UI feedback can
 *   report what happened instead of guessing. Theme and locale apply
 *   synchronously, before the write is even scheduled.
 */
import { browser } from 'wxt/browser';
import {
  DEFAULT_SETTINGS,
  readSettings,
  type Settings,
  type ThemePreference,
  writeSettings,
} from '../browser/storage';
import { getLocale, setLocale } from '../i18n/index.svelte';
import { resolveLocale } from '../i18n/resolve-locale';

const SAVE_DEBOUNCE_MS = 200;

/** What a persistence attempt actually did. Never thrown, always returned. */
export interface SaveOutcome {
  ok: boolean;
  detail?: string;
}

const settings = $state<Settings>({ ...DEFAULT_SETTINGS });
let loaded = $state(false);
let saveTimer: ReturnType<typeof setTimeout> | undefined;
/** Everyone who called `updateSettings` since the last write shares this. */
let pending: { promise: Promise<SaveOutcome>; resolve: (outcome: SaveOutcome) => void } | undefined;

export function getSettings(): Settings {
  return settings;
}

export function isSettingsLoaded(): boolean {
  return loaded;
}

/** Read persisted settings and apply locale + theme. Call once per page. */
export async function loadSettings(): Promise<void> {
  Object.assign(settings, await readSettings());
  applyLocale();
  applyTheme(settings.theme);
  loaded = true;
}

/**
 * Adopt settings written by another Manager tab.
 *
 * Two rules, and between them they solve the echo problem and the debounce
 * problem at once:
 *
 * 1. **If this context has an unflushed write, ignore the change entirely.**
 *    `save()` writes the whole object, not a patch, so this tab is about to
 *    overwrite the incoming value anyway — and adopting it first would clobber
 *    the choice the user just made, in the UI *and* in what gets persisted 200
 *    ms later. Ignoring is last-write-wins, which is the semantic docs/15
 *    already documented, and it converges because our write fires this same
 *    event in the other tab.
 * 2. **Otherwise adopt only fields that actually differ.** Our own write always
 *    matches what we already hold, so self-echo suppression falls out for free
 *    — no `lastWritten` snapshot to keep in step and go stale, and no
 *    dependence on key order, which `{...proxy}` and `coerceSettings` do not
 *    agree on anyway.
 *
 * Deliberately does not schedule a save: adopting a value that is already on
 * disk and writing it straight back would make two tabs ping-pong forever.
 *
 * @returns whether anything changed.
 */
export function adoptExternalSettings(next: Settings): boolean {
  if (saveTimer !== undefined || pending !== undefined) return false;

  const keys = Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[];
  if (keys.every((key) => settings[key] === next[key])) return false;

  // In place, never replaced — see updateSettings.
  Object.assign(settings, next);
  applyLocale();
  applyTheme(settings.theme);
  return true;
}

/**
 * Apply a patch now, persist it shortly.
 *
 * Returns the outcome of the resulting write rather than firing and forgetting,
 * so the Settings tab's "Saved" toast cannot claim a persistence that failed.
 */
export function updateSettings(patch: Partial<Settings>): Promise<SaveOutcome> {
  // Mutated in place, never replaced. A replacement would strand any component
  // that captured `getSettings()` into a local, and four components read this.
  Object.assign(settings, patch);
  if (patch.theme !== undefined) applyTheme(patch.theme);
  if (patch.locale !== undefined) applyLocale();
  return scheduleSave();
}

/**
 * Restore every documented default and persist immediately.
 *
 * The pending debounced write is cancelled rather than allowed to fire first —
 * otherwise a reset issued within 200 ms of a change writes twice, and the
 * first write persists values the user just discarded.
 */
export function resetSettings(): Promise<SaveOutcome> {
  if (saveTimer !== undefined) clearTimeout(saveTimer);
  saveTimer = undefined;
  Object.assign(settings, DEFAULT_SETTINGS);
  applyLocale();
  applyTheme(settings.theme);
  return flushNow();
}

/**
 * Write any pending change immediately.
 *
 * Called on `visibilitychange` → hidden, which fires on tab close, navigation
 * and backgrounding. It shrinks the window in which a just-made change is lost
 * from 200 ms to roughly nothing — it does not make it zero, because an async
 * write started while the document is hidden is not guaranteed to finish.
 */
export function flushSettings(): Promise<SaveOutcome> {
  if (saveTimer === undefined && pending === undefined) return Promise.resolve({ ok: true });
  return flushNow();
}

function scheduleSave(): Promise<SaveOutcome> {
  if (saveTimer !== undefined) clearTimeout(saveTimer);

  // Rapid changes coalesce onto one promise, so every caller awaiting a save
  // learns the outcome of the single write that actually happened.
  if (pending === undefined) {
    let resolve!: (outcome: SaveOutcome) => void;
    const promise = new Promise<SaveOutcome>((r) => {
      resolve = r;
    });
    pending = { promise, resolve };
  }

  saveTimer = setTimeout(() => {
    void flushNow();
  }, SAVE_DEBOUNCE_MS);

  return pending.promise;
}

/** Write now and settle whoever is waiting on the coalesced promise. */
async function flushNow(): Promise<SaveOutcome> {
  if (saveTimer !== undefined) clearTimeout(saveTimer);
  saveTimer = undefined;
  const waiting = pending;
  pending = undefined;

  const outcome = await save();
  waiting?.resolve(outcome);
  return outcome;
}

async function save(): Promise<SaveOutcome> {
  try {
    // $state proxies are not structured-cloneable, and chrome.storage.local.set
    // clones its argument — passing the proxy straight through throws
    // DataCloneError in a real browser. Settings is flat primitives, so a
    // spread is a provably sufficient snapshot.
    await writeSettings({ ...settings });
    return { ok: true };
  } catch (err) {
    // Conditional spread, not `detail: undefined` — exactOptionalPropertyTypes
    // makes an explicit undefined a type error (docs/10 §2).
    return { ok: false, ...(err instanceof Error && { detail: err.message }) };
  }
}

function applyLocale(): void {
  if (settings.locale !== 'auto') {
    setLocale(settings.locale);
    applyDocumentLanguage();
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
  applyDocumentLanguage();
}

/**
 * Keep `<html lang>` in step with the UI language.
 *
 * Both entrypoint documents ship `lang="en"`, so without this a screen reader
 * reads Vietnamese and Japanese text with an English voice and pronunciation
 * rules — the strings change and the announced language does not.
 */
function applyDocumentLanguage(): void {
  const root = globalThis.document?.documentElement;
  if (root === undefined) return;
  root.lang = getLocale();
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
