/**
 * One writer at a time, across every Manager tab — docs/03 §5.
 *
 * Purpose: two tabs replacing at once would each back up, then delete what the
 *   other was writing; a sort racing an import reorders a folder mid-write.
 * Inputs: the bulk operation to run.
 * Guarantees: uses the Web Locks API (in-browser, same-origin, no permission).
 *   The lock is taken only if it is free — a second writer is refused at once
 *   with `BmEnvError('WRITE_LOCKED')`, never queued behind a write the user
 *   cannot see. Where the API is missing (tests), the operation simply runs.
 */
import { BmEnvError } from './errors';

const LOCK_NAME = 'bookmarkmagic-write';

interface LockManagerLike {
  request: <T>(
    name: string,
    options: { ifAvailable: boolean },
    run: (lock: unknown) => Promise<T>,
  ) => Promise<T>;
}

/** @throws {BmEnvError} `WRITE_LOCKED` when another tab holds the lock. */
export async function withWriteLock<T>(run: () => Promise<T>): Promise<T> {
  const locks = (globalThis.navigator as { locks?: LockManagerLike } | undefined)?.locks;
  if (locks === undefined) return run();
  return locks.request(LOCK_NAME, { ifAvailable: true }, async (lock) => {
    if (lock === null) {
      throw new BmEnvError('WRITE_LOCKED', 'another BookmarkMagic tab is writing bookmarks');
    }
    return run();
  });
}
