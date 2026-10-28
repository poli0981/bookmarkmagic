/**
 * Local-only diagnostics — docs/09 §5, legal/PRIVACY.md.
 *
 * Purpose: when something goes wrong, a bug report needs more than "it failed"
 *   — which phase, which error code, in what order. This is a small ring
 *   buffer the user can copy from About → "Copy diagnostics" and paste into an
 *   issue themselves.
 * Guarantees: in memory only, never written to storage, never sent anywhere
 *   (there is no network). Entries are an allowlist of codes, counts and
 *   phase names: an event type cannot carry a title, an address or a file
 *   path, and free-text `detail` strings from the browser are never recorded —
 *   they can quote a URL.
 */

/** What may be recorded — nothing else type-checks. */
export type DiagEvent =
  | { kind: 'import'; phase: string; format?: string; nodes?: number }
  | { kind: 'failure'; where: string; code: string }
  | { kind: 'edit'; action: string; count?: number }
  | { kind: 'storage'; issue: string }
  | { kind: 'crash'; name: string };

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
    record({ kind: 'crash', name: event.error instanceof Error ? event.error.name : 'Error' });
  };
  const onRejection = (event: PromiseRejectionEvent): void => {
    record({
      kind: 'crash',
      name: event.reason instanceof Error ? event.reason.name : typeof event.reason,
    });
  };
  target.addEventListener('error', onError);
  target.addEventListener('unhandledrejection', onRejection);
  return () => {
    target.removeEventListener('error', onError);
    target.removeEventListener('unhandledrejection', onRejection);
  };
}
