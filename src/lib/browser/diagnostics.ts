/**
 * Local-only diagnostics — docs/09 §7, legal/PRIVACY.md.
 *
 * Purpose: when something goes wrong, a bug report needs more than "it failed"
 *   — which phase, which error code, in what order. This is a small ring
 *   buffer the user can copy from About → "Copy diagnostics" and paste into an
 *   issue themselves.
 * Guarantees: in memory only, never written to storage, never sent anywhere
 *   (there is no network). Entries are an allowlist of codes, counts and
 *   phase names, and the TYPES enforce it: every string field is a union of
 *   fixed values, so a title, an address or a file path does not compile —
 *   1.1.0's first cut typed them all `string` and only promised it (v1.1.0
 *   review). Free-text `detail` strings from the browser are never recorded;
 *   they can quote a URL.
 */
import type { FileFormat, MergeMode } from '../core/model';
import type { ErrorKey } from './describe-error';

/** The import pipeline's milestones (`import/run-import.ts`). */
type ImportPhase = 'parsed' | `planned:${MergeMode}` | 'backup-proven' | 'cleared' | 'written';
type EditAction = 'keep-first' | 'sort';
type StorageIssue = 'settings-read-failed' | 'legal-read-failed' | 'change-decode-failed';

/**
 * Error names worth telling apart. Any other is recorded as `'other'`: a
 * name is an ordinary string property, and nothing stops code from putting
 * data in it.
 */
const KNOWN_ERROR_NAMES = [
  'Error',
  'TypeError',
  'RangeError',
  'SyntaxError',
  'ReferenceError',
  'URIError',
  'AggregateError',
  'AbortError',
  'NotAllowedError',
  'NotFoundError',
  'SecurityError',
  'QuotaExceededError',
  'InvalidStateError',
  'DataCloneError',
  'BmParseError',
  'BmBackupError',
  'BmBrowserError',
  'BmEnvError',
  'BmPartialWrite',
  'BmAborted',
] as const;
const KNOWN: ReadonlySet<string> = new Set(KNOWN_ERROR_NAMES);

/** An allowlisted error name, `'other'`, or — for a non-Error throw — its `typeof`. */
export type ErrorName =
  | (typeof KNOWN_ERROR_NAMES)[number]
  | 'other'
  | 'string'
  | 'number'
  | 'bigint'
  | 'boolean'
  | 'symbol'
  | 'undefined'
  | 'object'
  | 'function';

function isKnownName(name: string): name is (typeof KNOWN_ERROR_NAMES)[number] {
  return KNOWN.has(name);
}

/** What a thrown value is called in the log — never its message. */
export function errorName(err: unknown): ErrorName {
  if (err instanceof Error) return isKnownName(err.name) ? err.name : 'other';
  return typeof err;
}

/** What may be recorded — nothing else type-checks. */
export type DiagEvent =
  | { kind: 'import'; phase: ImportPhase; format?: FileFormat; nodes?: number }
  | { kind: 'failure'; where: ErrorName; code: ErrorKey }
  | { kind: 'edit'; action: EditAction; count?: number }
  | { kind: 'storage'; issue: StorageIssue }
  | { kind: 'crash'; name: ErrorName };

interface Entry {
  /** Milliseconds since the page loaded — no wall-clock time is kept. */
  t: number;
  event: DiagEvent;
}

const CAPACITY = 200;
const entries: Entry[] = [];

/** Record one event; the oldest drops off past 200. Never throws. */
export function record(event: DiagEvent): void {
  entries.push({ t: Math.round(globalThis.performance?.now() ?? 0), event });
  if (entries.length > CAPACITY) entries.shift();
}

export interface DiagnosticsContext {
  version: string;
  locale: string;
  theme: string;
}

/** The report the About tab copies: context first, then the events, oldest first. */
export function snapshot(context: DiagnosticsContext): string {
  const chrome = /Chrome\/(\d+)/.exec(globalThis.navigator?.userAgent ?? '')?.[1] ?? 'unknown';
  return JSON.stringify(
    { app: 'BookmarkMagic', ...context, chromeMajor: chrome, events: entries },
    null,
    2,
  );
}

/** Test teardown — module state outlives a single `it()`. */
export function clearDiagnostics(): void {
  entries.length = 0;
}

/**
 * Record uncaught errors and unhandled rejections — by NAME only: a message
 * can quote whatever the code was looking at. Returns a teardown.
 */
export function installCrashHooks(
  target: Pick<Window, 'addEventListener' | 'removeEventListener'>,
): () => void {
  const onError = (event: ErrorEvent): void => {
    record({ kind: 'crash', name: event.error === undefined ? 'Error' : errorName(event.error) });
  };
  const onRejection = (event: PromiseRejectionEvent): void => {
    record({ kind: 'crash', name: errorName(event.reason) });
  };
  target.addEventListener('error', onError);
  target.addEventListener('unhandledrejection', onRejection);
  return () => {
    target.removeEventListener('error', onError);
    target.removeEventListener('unhandledrejection', onRejection);
  };
}
