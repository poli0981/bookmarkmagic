import { beforeEach, describe, expect, it } from 'vitest';
import {
  answerAttestation,
  awaitAttestation,
  beginWrite,
  cancelWrite,
  getImportState,
  hasPendingAttestation,
  isWriting,
  resetImport,
  setImportState,
} from '@/lib/stores/import-session.svelte';

/**
 * Import session store — docs/03 §5.
 *
 * The attestation half of this file exists because of a real dead end: the
 * resolver used to be a component-local `let`, so pressing browser Back during
 * `attesting` unmounted `ImportTab`, stranded the promise `runImport` was
 * awaiting, and left `isWriting()` true forever — every tab and footer control
 * disabled, `beforeunload` prompting, and a remounted tab rendering two inert
 * buttons. Closing the tab was the only way out.
 */
beforeEach(() => {
  resetImport();
});

describe('isWriting', () => {
  it.each([
    ['backing-up', true],
    ['attesting', true],
    ['clearing', true],
    ['writing', true],
    ['idle', false],
    ['validating', false],
    ['parsed', false],
    ['done', false],
    ['cancelled', false],
    ['error', false],
  ])('%s → %s', (kind, expected) => {
    // Only the shape of `kind` is under test; the rest of each variant is
    // filled with whatever satisfies the union.
    const states: Record<string, Parameters<typeof setImportState>[0]> = {
      idle: { kind: 'idle' },
      validating: { kind: 'validating', filename: 'f' },
      parsed: {
        kind: 'parsed',
        filename: 'f',
        result: { roots: [], warnings: [], stats: { bookmarks: 0, folders: 0, maxDepth: 0 } },
        duplicates: 0,
      },
      'backing-up': { kind: 'backing-up', filename: 'f' },
      attesting: { kind: 'attesting', filename: 'f', backupFilename: 'b.json' },
      clearing: { kind: 'clearing', filename: 'f' },
      writing: {
        kind: 'writing',
        filename: 'f',
        progress: { done: 0, total: 1, currentPath: '' },
      },
      done: {
        kind: 'done',
        filename: 'f',
        created: 1,
        plan: {
          mode: 'new-folder',
          dedupe: false,
          segments: [],
          stats: { toCreate: 0, bookmarkCount: 0, skippedExisting: 0, skippedInFile: 0 },
        },
      },
      cancelled: { kind: 'cancelled', filename: 'f', created: 1 },
      error: { kind: 'error', filename: 'f', messageKey: 'errors.UNKNOWN' },
    };
    const state = states[kind];
    if (state === undefined) throw new Error(`unmapped kind: ${kind}`);
    setImportState(state);
    expect(isWriting()).toBe(expected);
  });
});

describe('attestation', () => {
  it('settles true when the user confirms', async () => {
    const pending = awaitAttestation();
    expect(hasPendingAttestation()).toBe(true);
    answerAttestation(true);
    await expect(pending).resolves.toBe(true);
    expect(hasPendingAttestation()).toBe(false);
  });

  it('settles false when the user cancels', async () => {
    const pending = awaitAttestation();
    answerAttestation(false);
    await expect(pending).resolves.toBe(false);
  });

  it('survives the component that started it — the deadlock this replaced', async () => {
    // The resolver lives in the store, so an unmount and remount of ImportTab
    // leaves the promise settleable. As a component-local `let` this hung.
    const pending = awaitAttestation();
    // …component unmounts and remounts here; nothing in the store changes…
    expect(hasPendingAttestation()).toBe(true);
    answerAttestation(true);
    await expect(pending).resolves.toBe(true);
  });

  it('resetImport settles a pending attestation as NOT confirmed', async () => {
    // "Import another file" pressed mid-attestation must not leave a resolver
    // behind — that would move the deadlock from a component, where it is
    // visible, into a store, where nothing renders it.
    const pending = awaitAttestation();
    resetImport();
    await expect(pending).resolves.toBe(false);
    expect(hasPendingAttestation()).toBe(false);
    expect(getImportState().kind).toBe('idle');
  });

  it('a second attestation settles the first as NOT confirmed, never drops it', async () => {
    // Failing closed matters here more than anywhere: this promise is the last
    // gate before deleting every bookmark the user has.
    const first = awaitAttestation();
    const second = awaitAttestation();
    await expect(first).resolves.toBe(false);

    answerAttestation(true);
    await expect(second).resolves.toBe(true);
  });

  it('answering with nothing pending is a no-op, not a throw', () => {
    expect(() => answerAttestation(true)).not.toThrow();
  });
});

describe('write control', () => {
  it('beginWrite hands out a signal that cancelWrite aborts', () => {
    const signal = beginWrite();
    expect(signal.aborted).toBe(false);
    cancelWrite();
    expect(signal.aborted).toBe(true);
  });

  it('each write gets a fresh signal, so a past cancel cannot poison the next', () => {
    const first = beginWrite();
    cancelWrite();
    const second = beginWrite();
    expect(first.aborted).toBe(true);
    expect(second.aborted).toBe(false);
  });
});
