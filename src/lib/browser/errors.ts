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
