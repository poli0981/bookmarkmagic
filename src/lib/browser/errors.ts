/**
 * Error types raised by the browser adapter layer — docs/02 §7.
 *
 * `core/` throws `BmParseError` and nothing else; these are the two failures
 * that only exist once real effects are involved.
 */

/** Thrown when the user cancels a write. Carries exactly how many nodes landed. */
export class BmAborted extends Error {
  readonly done: number;

  constructor(done: number) {
    super(`Import cancelled after ${done} item(s)`);
    this.name = 'BmAborted';
    this.done = done;
  }
}

export type BmBackupErrorCode =
  | 'BACKUP_SERIALIZE_FAILED'
  | 'BACKUP_CANCELLED'
  | 'BACKUP_WRITE_FAILED';

/**
 * Thrown when the forced safety backup could not be produced or proven
 * (docs/03 §1 step 6b). Deletion never proceeds past one of these.
 */
export class BmBackupError extends Error {
  readonly code: BmBackupErrorCode;

  constructor(code: BmBackupErrorCode, detail?: string) {
    super(detail === undefined ? code : `${code}: ${detail}`);
    this.name = 'BmBackupError';
    this.code = code;
  }
}

/** Thrown when a `chrome.*` call rejects. Keeps raw errors out of components. */
export class BmBrowserError extends Error {
  readonly detail: string;

  constructor(operation: string, cause: unknown) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    super(`${operation} failed: ${detail}`);
    this.name = 'BmBrowserError';
    this.detail = detail;
  }
}

export type BmEnvCode = 'NO_WRITABLE_ROOTS';

/**
 * Thrown when the environment cannot support the operation at all.
 *
 * Distinct from `BmBrowserError` on purpose: an absence is not a refusal.
 * Reporting "the browser refused a bookmark operation" to someone whose profile
 * simply has no writable root sends them looking for the wrong thing.
 */
export class BmEnvError extends Error {
  readonly code: BmEnvCode;
  readonly detail: string | undefined;

  constructor(code: BmEnvCode, detail?: string) {
    super(detail === undefined ? code : `${code}: ${detail}`);
    this.name = 'BmEnvError';
    this.code = code;
    this.detail = detail;
  }
}

/** Which destructive step was interrupted. */
export type BmWritePhase = 'clearing' | 'writing';

/**
 * Thrown when a destructive step failed part-way through.
 *
 * Carries exactly what already landed, for the same reason `BmAborted` carries
 * `done`: a user whose tree was half-replaced needs a number and the name of
 * their backup, not "the browser refused a bookmark operation".
 *
 * `cause` is deliberately not used — `noImplicitOverride` complicates
 * redeclaring it, and the detail is flattened here anyway so the UI never has
 * to unwrap a chain.
 */
export class BmPartialWrite extends Error {
  readonly phase: BmWritePhase;
  readonly done: number;
  readonly detail: string | undefined;

  constructor(phase: BmWritePhase, done: number, cause: unknown) {
    const detail =
      cause instanceof BmBrowserError
        ? cause.detail
        : cause instanceof Error
          ? cause.message
          : String(cause);
    super(`${phase} failed after ${done} item(s): ${detail}`);
    this.name = 'BmPartialWrite';
    this.phase = phase;
    this.done = done;
    this.detail = detail;
  }
}
