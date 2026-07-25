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
