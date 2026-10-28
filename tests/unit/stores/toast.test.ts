import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearToasts,
  dismissToast,
  getPinnedToast,
  getVisibleToast,
  pushToast,
} from '@/lib/stores/toast.svelte';

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
    expect(getVisibleToast()?.tone).toBe('success');
    expect(getPinnedToast()?.tone).toBe('danger');
    vi.advanceTimersByTime(4000);
    expect(getVisibleToast()).toBeUndefined();
    expect(getPinnedToast()?.message).toBe('Done');
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

describe('toast — failures stay until dismissed (v1.1.0)', () => {
  it('pins a failure without holding up the toasts after it', () => {
    pushToast('It failed', 'danger');
    pushToast('Later news');
    // In 1.1.0's first cut the failure sat at the head of the queue, and
    // "Later news" waited behind it until someone dismissed it.
    expect(getVisibleToast()?.message).toBe('Later news');
    vi.advanceTimersByTime(4000);
    expect(getVisibleToast()).toBeUndefined();
    vi.advanceTimersByTime(60_000);
    expect(getPinnedToast()?.message).toBe('It failed');
    dismissToast(getPinnedToast()?.id ?? '');
    expect(getPinnedToast()).toBeUndefined();
  });

  it('shows only the latest failure, and keeps the item for a repeat', () => {
    pushToast('First failure', 'danger');
    const first = getPinnedToast();
    pushToast('First failure', 'danger');
    expect(getPinnedToast()).toBe(first);
    pushToast('Second failure', 'danger');
    expect(getPinnedToast()?.message).toBe('Second failure');
  });

  it('dismissing the transient toast leaves the pinned one alone, and vice versa', () => {
    pushToast('Broken', 'danger');
    pushToast('Copied', 'success');
    dismissToast(getVisibleToast()?.id ?? '');
    expect(getPinnedToast()?.message).toBe('Broken');
    pushToast('Copied again', 'success');
    dismissToast(getPinnedToast()?.id ?? '');
    expect(getVisibleToast()?.message).toBe('Copied again');
  });
});
