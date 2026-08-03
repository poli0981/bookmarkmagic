/**
 * Map a thrown value onto an i18n key plus the raw technical detail —
 * docs/02 §7.
 *
 * Purpose: one place that decides how a failure is described, so the
 *   "localized sentence + separate detail block" contract cannot be got wrong
 *   in one tab and right in another.
 * Inputs: anything thrown by the core, browser or import layers.
 * Guarantees: returns a **key**, never a resolved sentence, and never throws.
 *
 * Two rules this encodes, both learned from real defects:
 *
 * - The key is not resolved here. The import session store outlives the
 *   component that wrote to it, and `t()` is only reactive where it is called,
 *   so a sentence stored at throw time would never follow a language switch.
 * - `detail` is a *separate* field, never a substitute for the message.
 *   Rendering `detail ?? t(key)` makes every translation dead code, because the
 *   raw browser string is almost always present.
 *
 * Lives in `browser/` because that is where the error taxonomy lives;
 * `browser/` may import `core/`, not the reverse (docs/02 §3).
 */
import { BmParseError } from '../core/model';
import { BmBackupError, BmBrowserError, BmEnvError, BmPartialWrite } from './errors';

export interface DescribedError {
  /** Dotted i18n path, e.g. `errors.TOO_DEEP`. */
  messageKey: string;
  /** Raw, untranslated technical text for the copyable detail block. */
  detail?: string | undefined;
  /** Nodes written before a partial failure, when the failure knows. */
  created?: number;
  /** Root children deleted before a partial failure, when the failure knows. */
  removed?: number;
}

export function describeError(err: unknown): DescribedError {
  if (err instanceof BmParseError) {
    return { messageKey: `errors.${err.code}`, detail: err.detail };
  }
  if (err instanceof BmBackupError) {
    return { messageKey: `errors.${err.code}`, detail: err.message };
  }
  if (err instanceof BmEnvError) {
    return {
      messageKey: `errors.${err.code}`,
      ...(err.detail !== undefined && { detail: err.detail }),
    };
  }
  if (err instanceof BmPartialWrite) {
    // The phase decides the sentence, because "nothing was deleted, some items
    // were added" and "part of your tree is gone" need different advice.
    return {
      messageKey: err.phase === 'clearing' ? 'errors.PARTIAL_CLEAR' : 'errors.PARTIAL_WRITE',
      ...(err.detail !== undefined && { detail: err.detail }),
      ...(err.phase === 'clearing' ? { removed: err.done } : { created: err.done }),
    };
  }
  if (err instanceof BmBrowserError) {
    return { messageKey: 'errors.BROWSER', detail: err.detail };
  }
  return {
    messageKey: 'errors.UNKNOWN',
    detail: err instanceof Error ? err.message : undefined,
  };
}
