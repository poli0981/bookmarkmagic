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
  | { kind: 'error'; filename: string; message: string; detail: string | undefined };

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

export function resetImport(): void {
  controller = undefined;
  prepared = undefined;
  state = { kind: 'idle' };
}
