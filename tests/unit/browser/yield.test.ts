import { afterEach, describe, expect, it, vi } from 'vitest';
import { yieldToEventLoop } from '@/lib/browser/write-queue';

type SchedulerHost = { scheduler?: { yield?: () => Promise<void> } };

afterEach(() => {
  delete (globalThis as SchedulerHost).scheduler;
  vi.restoreAllMocks();
});

/**
 * The precedence guard — docs/05 §6.
 *
 * `await scheduler.yield?.() ?? new Promise(...)` parses as
 * `(await scheduler.yield?.()) ?? new Promise(...)`, which never yields on
 * either side. These tests pin both branches so the parentheses cannot be
 * "simplified" away.
 */
describe('yieldToEventLoop', () => {
  it('falls back to setTimeout when scheduler.yield is missing (Chrome 120-128)', async () => {
    const spy = vi.spyOn(globalThis, 'setTimeout');
    const before = spy.mock.calls.length;
    await yieldToEventLoop();
    expect(spy.mock.calls.length - before).toBe(1);
  });

  it('actually awaits the fallback rather than discarding it', async () => {
    let resumed = false;
    const promise = yieldToEventLoop().then(() => {
      resumed = true;
    });
    // Still pending on the macrotask — a discarded promise would let this pass
    // synchronously in the same tick.
    expect(resumed).toBe(false);
    await promise;
    expect(resumed).toBe(true);
  });

  it('uses scheduler.yield when present and leaks no timer (Chrome 129+)', async () => {
    const yieldFn = vi.fn(async () => undefined);
    (globalThis as SchedulerHost).scheduler = { yield: yieldFn };
    const spy = vi.spyOn(globalThis, 'setTimeout');
    const before = spy.mock.calls.length;

    await yieldToEventLoop();

    expect(yieldFn).toHaveBeenCalledOnce();
    // scheduler.yield() resolves with undefined; a `??` on the AWAITED value
    // would fall through and schedule a stray timer here.
    expect(spy.mock.calls.length - before).toBe(0);
  });
});
