import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearToasts, dismissToast, getVisibleToast, pushToast } from '@/lib/stores/toast.svelte';

beforeEach(() => {
  clearToasts();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  clearToasts();
});

describe('toast queue', () => {
  it('shows a pushed message and dismisses it after 4 s', () => {
    pushToast('Saved', 'success');
    expect(getVisibleToast()?.message).toBe('Saved');

    vi.advanceTimersByTime(3999);
    expect(getVisibleToast()).toBeDefined();

    vi.advanceTimersByTime(1);
    expect(getVisibleToast()).toBeUndefined();
  });

  it('is a queue, not a stack — the second waits for the first', () => {
    pushToast('first');
    pushToast('second');
    expect(getVisibleToast()?.message).toBe('first');

    vi.advanceTimersByTime(4000);
    expect(getVisibleToast()?.message).toBe('second');

    vi.advanceTimersByTime(4000);
    expect(getVisibleToast()).toBeUndefined();
  });

  it('restarts the timer for a repeat of the visible message instead of queueing a twin', () => {
    // One debounced settings save resolves one promise with several
    // subscribers; without this the user gets three identical "Saved" toasts.
    pushToast('Settings saved', 'success');
    vi.advanceTimersByTime(3000);
    pushToast('Settings saved', 'success');

    vi.advanceTimersByTime(3000);
    expect(getVisibleToast()?.message).toBe('Settings saved');

    vi.advanceTimersByTime(1000);
    expect(getVisibleToast()).toBeUndefined();
  });

  it('treats the same text with a different tone as a distinct toast', () => {
    pushToast('Done', 'success');
    pushToast('Done', 'danger');
    vi.advanceTimersByTime(4000);
    expect(getVisibleToast()?.tone).toBe('danger');
  });

  it('does not let a stale timer shift the next item early after a manual dismiss', () => {
    pushToast('first');
    const first = getVisibleToast();
    pushToast('second');

    vi.advanceTimersByTime(1000);
    dismissToast(first?.id ?? '');
    expect(getVisibleToast()?.message).toBe('second');

    // The first item's original 4 s deadline passes here. Without the id check
    // in the timeout it would shift again and flash "second" away instantly.
    vi.advanceTimersByTime(3000);
    expect(getVisibleToast()?.message).toBe('second');

    vi.advanceTimersByTime(1000);
    expect(getVisibleToast()).toBeUndefined();
  });

  it('ignores a dismiss for an item that is not on screen', () => {
    pushToast('first');
    pushToast('second');
    const queuedId = 'toast-2';

    dismissToast(queuedId);
    expect(getVisibleToast()?.message).toBe('first');
  });

  it('caps the queue by dropping the oldest pending item, never the visible one', () => {
    pushToast('visible');
    pushToast('pending-a');
    pushToast('pending-b');
    pushToast('pending-c');

    expect(getVisibleToast()?.message).toBe('visible');
    vi.advanceTimersByTime(4000);
    // 'pending-a' was the oldest queued item when the cap was hit.
    expect(getVisibleToast()?.message).toBe('pending-b');
    vi.advanceTimersByTime(4000);
    expect(getVisibleToast()?.message).toBe('pending-c');
    vi.advanceTimersByTime(4000);
    expect(getVisibleToast()).toBeUndefined();
  });

  it('defaults to the info tone', () => {
    pushToast('plain');
    expect(getVisibleToast()?.tone).toBe('info');
  });
});
