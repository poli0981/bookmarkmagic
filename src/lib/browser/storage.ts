/**
 * Typed `chrome.storage.local` accessors — docs/03 §4, docs/14 §2.
 *
 * Purpose: the only place storage keys are spelled out.
 * Guarantees: `storage.local` only — never `storage.sync`, so even settings
 *   stay off the vendor cloud, consistent with the product promise (docs/09
 *   §1.3). Reads never throw: unreadable or malformed values fall back to the
 *   defaults, because a corrupt settings blob must not brick the Manager.
 */
import { browser } from 'wxt/browser';
import type { CsvDelimiter } from '../core/serialize/csv';
import type { MarkdownStyle } from '../core/serialize/markdown';
import type { Locale } from '../i18n/resolve-locale';

export type ThemePreference = 'system' | 'light' | 'dark';
export type ExportFormat = 'netscape-html' | 'bm-json' | 'csv' | 'markdown';
export type ImportMode = 'new-folder' | 'merge' | 'replace';

export interface Settings {
  locale: Locale | 'auto';
  theme: ThemePreference;
  defaultExportFormat: ExportFormat;
  defaultMergeMode: ImportMode;
  csvDelimiter: CsvDelimiter;
  markdownStyle: MarkdownStyle;
}

export interface LegalAcceptance {
  acceptedVersion: number;
  /** ISO 8601 instant. */
  acceptedAt: string;
}

export const DEFAULT_SETTINGS: Settings = {
  locale: 'auto',
  theme: 'system',
  defaultExportFormat: 'netscape-html',
  defaultMergeMode: 'new-folder',
  csvDelimiter: ',',
  markdownStyle: 'nested',
};

const SETTINGS_KEY = 'settings';
const LEGAL_KEY = 'legal';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Keep only values that match the expected shape; fall back per field. */
function coerceSettings(raw: unknown): Settings {
  if (!isRecord(raw)) return { ...DEFAULT_SETTINGS };
  const pick = <K extends keyof Settings>(key: K, allowed: readonly Settings[K][]): Settings[K] =>
    allowed.includes(raw[key] as Settings[K]) ? (raw[key] as Settings[K]) : DEFAULT_SETTINGS[key];

  return {
    locale: pick('locale', ['auto', 'en', 'vi', 'ja']),
    theme: pick('theme', ['system', 'light', 'dark']),
    defaultExportFormat: pick('defaultExportFormat', [
      'netscape-html',
      'bm-json',
      'csv',
      'markdown',
    ]),
    defaultMergeMode: pick('defaultMergeMode', ['new-folder', 'merge', 'replace']),
    csvDelimiter: pick('csvDelimiter', [',', ';']),
    markdownStyle: pick('markdownStyle', ['nested', 'flat']),
  };
}

export async function readSettings(): Promise<Settings> {
  try {
    const stored = await browser.storage.local.get(SETTINGS_KEY);
    return coerceSettings(stored[SETTINGS_KEY]);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function writeSettings(settings: Settings): Promise<void> {
  await browser.storage.local.set({ [SETTINGS_KEY]: settings });
}

/** Keep only a well-formed acceptance record; anything else is "never accepted". */
function coerceLegal(raw: unknown): LegalAcceptance | null {
  if (!isRecord(raw) || typeof raw.acceptedVersion !== 'number') return null;
  return {
    acceptedVersion: raw.acceptedVersion,
    // Coerced rather than left missing: `Intl.format(new Date(''))` throws a
    // RangeError inside a render, which would blank the About tab.
    acceptedAt: typeof raw.acceptedAt === 'string' ? raw.acceptedAt : '',
  };
}

export async function readLegal(): Promise<LegalAcceptance | null> {
  try {
    const stored = await browser.storage.local.get(LEGAL_KEY);
    return coerceLegal(stored[LEGAL_KEY]);
  } catch {
    return null;
  }
}

/**
 * Record acceptance.
 *
 * @param nowIso passed in by the caller so this module stays free of ambient
 *   time, matching the portfolio's consent adapter.
 */
export async function writeLegal(acceptedVersion: number, nowIso: string): Promise<void> {
  await browser.storage.local.set({
    [LEGAL_KEY]: { acceptedVersion, acceptedAt: nowIso } satisfies LegalAcceptance,
  });
}

/** What changed, already coerced. A key absent from the event stays absent. */
export interface StorageChange {
  settings?: Settings;
  legal?: LegalAcceptance | null;
}

/**
 * Watch for writes made by another extension context — a second Manager tab.
 *
 * The event fires in *every* context including the one that wrote, so the
 * caller has to decide what is an echo of its own write; this layer only
 * decodes and hands over. Values are coerced through the same functions the
 * read path uses, because a second tab is not a more trustworthy source than
 * disk — it is the same disk.
 *
 * @returns an unsubscribe function.
 */
export function subscribeStorage(handler: (change: StorageChange) => void): () => void {
  const onChanged = (changes: Record<string, { newValue?: unknown }>, areaName: string): void => {
    // Everything this extension stores is in `local`; `sync` is never used
    // (docs/09 §1.3) and a write there is not ours to react to.
    if (areaName !== 'local') return;
    try {
      const change: StorageChange = {};
      if (SETTINGS_KEY in changes)
        change.settings = coerceSettings(changes[SETTINGS_KEY]?.newValue);
      if (LEGAL_KEY in changes) change.legal = coerceLegal(changes[LEGAL_KEY]?.newValue);
      if (change.settings !== undefined || 'legal' in change) handler(change);
    } catch {
      // A throw inside a chrome.* listener surfaces as an extension error in
      // chrome://extensions, which the QA pass treats as a failure. Nothing
      // here is worth that: the next read will pick up the same value.
    }
  };

  browser.storage.onChanged.addListener(onChanged);
  return () => {
    browser.storage.onChanged.removeListener(onChanged);
  };
}
