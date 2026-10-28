import { afterEach, describe, expect, it, vi } from 'vitest';
import { BmEnvError } from '@/lib/browser/errors';
import { withWriteLock } from '@/lib/browser/write-lock';

type Host = { locks?: unknown };
const nav = globalThis.navigator as unknown as Host;

afterEach(() => {
  delete nav.locks;
});

/** Fake Web Locks: `held` decides whether an ifAvailable request gets the lock. */
function fakeLocks(held: boolean) {
  const request = vi.fn(
    async (_name: string, _options: unknown, run: (lock: unknown) => Promise<unknown>) =>
      run(held ? null : { name: 'bookmarkmagic-write' }),
  );
  nav.locks = { request };
  return request;
}

/** One writer across Manager tabs — docs/03 §5. */
describe('withWriteLock', () => {
  it('runs the operation when the lock is free, asking only if it is available', async () => {
    const request = fakeLocks(false);
    await expect(withWriteLock(async () => 42)).resolves.toBe(42);
    expect(request.mock.calls[0]?.[1]).toEqual({ ifAvailable: true });
  });

  it('refuses at once, without running anything, when another tab holds it', async () => {
    fakeLocks(true);
    const run = vi.fn(async () => 1);
    const err = await withWriteLock(run).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(BmEnvError);
    expect((err as BmEnvError).code).toBe('WRITE_LOCKED');
    expect(run).not.toHaveBeenCalled();
  });

  it('simply runs where the API does not exist', async () => {
    await expect(withWriteLock(async () => 'ok')).resolves.toBe('ok');
  });
});
