/**
 * Transient status messages — docs/06 §4 (queue, auto-dismiss 4 s, ARIA status).
 *
 * Purpose: one place that owns toast state AND its timers.
 * Inputs: `pushToast` calls from anywhere in the Manager.
 * Guarantees: exactly one toast is visible at a time; a timer can only ever
 *   dismiss the item that started it; nothing here touches the DOM, so a fired
 *   timer is harmless even when no `<Toast>` is rendered.
 *
 * The store owns the timers rather than the component because `<Toast>` mounts
 * once at the App root while the route chain below it unmounts on every
 * navigation. Component-owned timers would leak by construction; this way there
 * is nothing to clean up.
 */

export type ToastTone = 'success' | 'danger' | 'info';

export interface ToastItem {
  id: string;
  message: string;
  tone: ToastTone;
}

const AUTO_DISMISS_MS = 4000;
/** Overflow drops the oldest *pending* item — never the one on screen. */
const MAX_QUEUED = 3;

let queue = $state<ToastItem[]>([]);
let timer: ReturnType<typeof setTimeout> | undefined;
let nextId = 0;

export function getVisibleToast(): ToastItem | undefined {
  return queue[0];
}

export function pushToast(message: string, tone: ToastTone = 'info'): void {
  const visible = queue[0];

  // A repeat of what is already on screen restarts its timer instead of
  // queueing a twin. One debounced settings save resolves one promise that may
  // have several subscribers, and without this the user gets three identical
  // "Settings saved" toasts in a row.
  if (visible !== undefined && visible.message === message && visible.tone === tone) {
    startTimer(visible.id);
    return;
  }

  nextId += 1;
  const item: ToastItem = { id: `toast-${nextId}`, message, tone };

  if (queue.length >= MAX_QUEUED) queue = [...queue.slice(0, 1), ...queue.slice(2), item];
  else queue = [...queue, item];

  if (queue.length === 1) startTimer(item.id);
}

export function dismissToast(id: string): void {
  if (queue[0]?.id !== id) return;
  shift();
}

/** Test teardown — module state outlives a single `it()`. */
export function clearToasts(): void {
  clearTimer();
  queue = [];
  nextId = 0;
}

function shift(): void {
  clearTimer();
  queue = queue.slice(1);
  const next = queue[0];
  if (next !== undefined) startTimer(next.id);
}

function startTimer(id: string): void {
  clearTimer();
  timer = setTimeout(() => {
    timer = undefined;
    // The identity check is what stops a user dismiss racing this timeout from
    // shifting twice and flashing the next toast for a single frame.
    if (queue[0]?.id !== id) return;
    shift();
  }, AUTO_DISMISS_MS);
}

function clearTimer(): void {
  if (timer === undefined) return;
  clearTimeout(timer);
  timer = undefined;
}
