/**
 * Import session state machine — docs/03 §5.
 *
 * `idle → validating → parsed → configuring → (backup) → writing →
 *  done | error | cancelled`
 *
 * Held as a discriminated union rather than a bag of booleans (docs/10 §2), so
 * the UI cannot render a half-state that does not exist.
 */

import type { ImportMode } from '../browser/storage';
import type { WriteProgress } from '../browser/write-queue';
import type { ImportPlan, ParseResult } from '../core/model';
import type { PreparedImport } from '../import/run-import';

export interface ImportOptionsState {
  mode: ImportMode;
  dedupe: boolean;
}

export type ImportState =
  | { kind: 'idle' }
  | { kind: 'validating'; filename: string }
  | { kind: 'parsed'; filename: string; result: ParseResult; duplicates: number }
  | { kind: 'backing-up'; filename: string }
  /** Fallback download taken; waiting for the user to confirm they have it. */
  | { kind: 'attesting'; filename: string; backupFilename: string }
  /** Backup proven, tree being deleted. NOT cancellable-looking — see below. */
  | { kind: 'clearing'; filename: string }
  // The plan is deliberately absent here: it only exists once the write has
  // begun, and nothing in the progress UI needs it.
  | { kind: 'writing'; filename: string; progress: WriteProgress }
  | { kind: 'done'; filename: string; created: number; plan: ImportPlan }
  | { kind: 'cancelled'; filename: string; created: number }
  /**
   * `messageKey` is a dotted i18n path, NOT a resolved string.
   *
   * `t()` is only reactive where it is called, and this state outlives the
   * component; storing the translated sentence froze it in whatever language
   * was active when the error happened, so switching language left the error
   * message behind in the old one.
   */
  | {
      kind: 'error';
      filename: string;
      messageKey: string;
      /**
       * Raw technical text, absent when there is none.
       *
       * Optional rather than `string | undefined` so it matches `DescribedError`
       * exactly — under `exactOptionalPropertyTypes` those are different types,
       * and a spread of one into the other is a compile error.
       */
      detail?: string | undefined;
      /** Nodes created before a partial failure, when the failure knows. */
      created?: number;
      /** Root children deleted before a partial failure, when it knows. */
      removed?: number;
      /**
       * The safety backup's filename, on a Replace that got past the backup.
       *
       * Carried onto the failure deliberately: `attesting` knew it and `error`
       * used to throw it away, so the one string that lets a user restore a
       * half-deleted tree was the one thing not on screen.
       */
      backupFilename?: string;
    };

let state = $state<ImportState>({ kind: 'idle' });
let options = $state<ImportOptionsState>({ mode: 'new-folder', dedupe: true });
let controller: AbortController | undefined;

/**
 * Parsed file + diff, kept HERE rather than in the component.
 *
 * The Manager unmounts the Import tab on every route change, so component-local
 * state would be lost while `state` still said 'parsed' — leaving a preview
 * with no badges and a permanently dead Import button.
 */
let prepared = $state<PreparedImport | undefined>();

export function getPrepared(): PreparedImport | undefined {
  return prepared;
}

export function setPrepared(next: PreparedImport | undefined): void {
  prepared = next;
}

export function getImportState(): ImportState {
  return state;
}

export function setImportState(next: ImportState): void {
  state = next;
}

export function getImportOptions(): ImportOptionsState {
  return options;
}

export function setImportOptions(patch: Partial<ImportOptionsState>): void {
  options = { ...options, ...patch };
}

/**
 * True while anything destructive or in-flight is happening — leaving #import
 * during ANY of these loses the queue with the tab (docs/03 §5). `clearing`
 * matters most: that is the phase where bookmarks are being deleted.
 */
export function isWriting(): boolean {
  return (
    state.kind === 'writing' ||
    state.kind === 'backing-up' ||
    state.kind === 'attesting' ||
    state.kind === 'clearing'
  );
}

export function beginWrite(): AbortSignal {
  controller = new AbortController();
  return controller.signal;
}

export function cancelWrite(): void {
  controller?.abort();
}

/**
 * Resolver for the fallback-backup attestation — held HERE, not in `ImportTab`.
 *
 * As a component-local `let` it died with the component. Pressing Back during
 * `attesting` unmounted the tab, stranded the promise `runImport` was awaiting,
 * and left `isWriting()` true forever: every tab and footer control disabled,
 * `beforeunload` prompting, and a remounted tab rendering two inert buttons
 * against a fresh, empty resolver. Closing the tab was the only escape.
 */
let attestResolve: ((confirmed: boolean) => void) | undefined;

/** Wait for the user to confirm they have the fallback backup. */
export function awaitAttestation(): Promise<boolean> {
  // A resolver that is still live fails CLOSED. An unanswered attestation is
  // not consent, and this is the gate in front of deleting every bookmark.
  attestResolve?.(false);
  return new Promise<boolean>((resolve) => {
    attestResolve = resolve;
  });
}

export function answerAttestation(confirmed: boolean): void {
  attestResolve?.(confirmed);
  attestResolve = undefined;
}

export function hasPendingAttestation(): boolean {
  return attestResolve !== undefined;
}

export function resetImport(): void {
  // Before clearing state, not after: otherwise "Import another file" during an
  // attestation moves the deadlock out of a component and into this store,
  // where nothing renders it and nobody would find it.
  answerAttestation(false);
  controller = undefined;
  prepared = undefined;
  state = { kind: 'idle' };
}
