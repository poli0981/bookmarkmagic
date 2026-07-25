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

export async function readLegal(): Promise<LegalAcceptance | null> {
  try {
    const stored = await browser.storage.local.get(LEGAL_KEY);
    const raw = stored[LEGAL_KEY];
    if (!isRecord(raw) || typeof raw.acceptedVersion !== 'number') return null;
    return {
      acceptedVersion: raw.acceptedVersion,
      acceptedAt: typeof raw.acceptedAt === 'string' ? raw.acceptedAt : '',
    };
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
