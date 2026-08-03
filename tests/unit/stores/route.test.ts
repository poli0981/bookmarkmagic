import { beforeEach, describe, expect, it } from 'vitest';
import { getRoute, navigate, startRouting } from '@/lib/stores/route.svelte';

beforeEach(() => {
  globalThis.location.hash = '';
});

describe('route store', () => {
  it('defaults to #import for an empty or unknown hash', () => {
    const stop = startRouting();
    expect(getRoute()).toBe('import');
    stop();

    globalThis.location.hash = '#nonsense';
    const stop2 = startRouting();
    expect(getRoute()).toBe('import');
    stop2();
  });

  it('adopts a valid hash on start', () => {
    globalThis.location.hash = '#settings';
    const stop = startRouting();
    expect(getRoute()).toBe('settings');
    stop();
  });

  it('navigate writes the hash and updates the route', () => {
    const stop = startRouting();
    navigate('export');
    expect(getRoute()).toBe('export');
    expect(globalThis.location.hash).toBe('#export');
    stop();
  });

  it('follows an external hashchange — the path options deep-links rely on', async () => {
    // With open_in_tab, Chrome activates an existing Manager tab without
    // navigating, so only this listener can switch the view (docs/02 §5).
    const stop = startRouting();
    globalThis.location.hash = '#edit';
    await new Promise((resolve) => setTimeout(resolve));
    expect(getRoute()).toBe('edit');
    stop();
  });

  it('stops following once cleaned up', async () => {
    const stop = startRouting();
    navigate('about');
    stop();

    globalThis.location.hash = '#edit';
    await new Promise((resolve) => setTimeout(resolve));
    expect(getRoute()).toBe('about');
  });
});

/**
 * The guard exists because browser Back was the one route out of #import that
 * nothing checked. During the backup attestation it unmounted `ImportTab` and
 * stranded the promise `runImport` was awaiting — a Manager that could only be
 * escaped by closing the tab.
 */
describe('route store — blocked while a write is in flight', () => {
  const settle = (): Promise<void> =>
    new Promise((resolve) => {
      setTimeout(() => setTimeout(() => resolve()));
    });

  it('refuses an external hashchange and puts the hash back', async () => {
    const stop = startRouting({ isBlocked: () => true });
    globalThis.location.hash = '#export';
    await settle();

    expect(getRoute()).toBe('import');
    expect(globalThis.location.hash).toBe('#import');
    stop();
  });

  it('restoring the hash does not recurse', async () => {
    // Putting the hash back fires `hashchange` a second time. Without the
    // `next === current` early return that is an infinite loop, in a released
    // extension, on the one path a panicking user is most likely to take.
    let blockedCalls = 0;
    const stop = startRouting({
      isBlocked: () => {
        blockedCalls++;
        return true;
      },
    });

    globalThis.location.hash = '#edit';
    await settle();

    expect(blockedCalls).toBe(1);
    stop();
  });

  it('reports the refusal exactly once, so the UI can explain itself', async () => {
    let notified = 0;
    const stop = startRouting({ isBlocked: () => true, onBlocked: () => notified++ });

    globalThis.location.hash = '#about';
    await settle();

    expect(notified).toBe(1);
    stop();
  });

  it('navigate() returns false and writes nothing while blocked', () => {
    const stop = startRouting({ isBlocked: () => true });
    expect(navigate('export')).toBe(false);
    expect(getRoute()).toBe('import');
    expect(globalThis.location.hash === '#export').toBe(false);
    stop();
  });

  it('navigating to the route you are already on is never refused', () => {
    // Otherwise ImportTab could not re-assert its own route mid-write.
    const stop = startRouting({ isBlocked: () => true });
    expect(navigate('import')).toBe(true);
    stop();
  });

  it('follows again as soon as the write finishes', async () => {
    let writing = true;
    const stop = startRouting({ isBlocked: () => writing });

    globalThis.location.hash = '#edit';
    await settle();
    expect(getRoute()).toBe('import');

    writing = false;
    globalThis.location.hash = '#edit';
    await settle();
    expect(getRoute()).toBe('edit');
    stop();
  });

  it('leaves the guard behind on cleanup, so a stale predicate cannot lock the app', () => {
    const stop = startRouting({ isBlocked: () => true });
    stop();
    expect(navigate('export')).toBe(true);
  });
});
