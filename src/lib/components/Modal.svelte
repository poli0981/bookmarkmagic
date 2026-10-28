<script lang="ts">
  /**
   * The one modal every dialog is built on — docs/06 §5.
   *
   * A native `<dialog>` opened with `showModal()`: focus trap, inert page, Esc
   * and top-layer stacking come from the browser, with no library. What this
   * adds is the bookkeeping 1.0.x got wrong in each dialog separately:
   *  - focus returns to whatever had it before the dialog opened;
   *  - `oncancel` fires for Esc, the backdrop and a programmatic close only
   *    when the CALLER did not close it — confirming no longer also ran the
   *    cancel handler a moment later (uL13);
   *  - "Move to…" was a positioned `<div>` that keyboard focus never entered.
   */
  import type { Snippet } from 'svelte';
  import { t } from '../i18n/index.svelte';
  import Icon from './icons/Icon.svelte';

  interface Props {
    open: boolean;
    /** Accessible name and visible heading. */
    title: string;
    /** Selector, inside the dialog, of what to focus on open. Defaults to the first control. */
    initialFocus?: string;
    danger?: boolean;
    wide?: boolean;
    /**
     * Point `aria-describedby` at the body, so a screen reader reads it with
     * the title — the counts in a confirmation live there. Off for bodies
     * that are a control (Move to…'s folder list is no description).
     */
    describe?: boolean;
    oncancel: () => void;
    children: Snippet;
    actions?: Snippet;
  }

  let {
    open,
    title,
    initialFocus,
    danger = false,
    wide = false,
    describe = false,
    oncancel,
    children,
    actions,
  }: Props = $props();

  // Several dialogs share a page; each needs its own heading id.
  const titleId = $props.id();
  const bodyId = `${titleId}-body`;
  let dialog: HTMLDialogElement | undefined = $state();
  let returnTo: HTMLElement | null = null;
  /** True while WE are closing it, so the native `close` event is not a cancel. */
  let closingByProp = false;

  $effect(() => {
    const el = dialog;
    if (el === undefined) return;
    if (open && !el.open) {
      returnTo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      el.showModal();
      const target =
        (initialFocus === undefined ? null : el.querySelector<HTMLElement>(initialFocus)) ??
        el.querySelector<HTMLElement>('input, select, textarea, button:not([data-dismiss])');
      target?.focus();
    } else if (!open && el.open) {
      closingByProp = true;
      el.close();
    }
  });

  function onClose(): void {
    const byProp = closingByProp;
    closingByProp = false;
    // Focus goes back to where it came from, if that is still in the page.
    if (returnTo?.isConnected === true) returnTo.focus();
    returnTo = null;
    if (!byProp) oncancel();
  }

  function onBackdrop(event: MouseEvent): void {
    // A click on the ::backdrop lands on the dialog element itself.
    if (event.target === dialog) dialog?.close();
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<dialog
  bind:this={dialog}
  class:danger
  class:wide
  aria-labelledby={titleId}
  aria-describedby={describe ? bodyId : undefined}
  onclose={onClose}
  onclick={onBackdrop}
>
  <header>
    <h2 id={titleId}>{title}</h2>
    <!-- Named "Dismiss", not after the dialog: read as "Delete this item?",
         a button that cancels said the opposite of what it does. -->
    <button
      type="button"
      class="dismiss"
      data-dismiss
      aria-label={t('common.dismiss')}
      onclick={() => dialog?.close()}
    >
      <Icon name="close" size={16} />
    </button>
  </header>
  <div class="body" id={bodyId}>
    {@render children()}
  </div>
  {#if actions !== undefined}
    <footer>{@render actions()}</footer>
  {/if}
</dialog>

<style>
  dialog {
    width: min(44ch, calc(100vw - 2 * var(--sp-4)));
    max-height: min(80vh, 640px);
    padding: 0;
    border: 1px solid var(--border-strong);
    border-radius: var(--radius);
    background: var(--bg);
    color: var(--fg);
    box-shadow: var(--shadow-2);
    overflow: hidden;
  }

  dialog[open] {
    display: flex;
    flex-direction: column;
  }

  .wide {
    width: min(64ch, calc(100vw - 2 * var(--sp-4)));
  }

  .danger {
    border-top: 3px solid var(--danger);
  }

  dialog::backdrop {
    background: rgb(10 12 16 / 55%);
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-3);
    padding: var(--sp-3) var(--sp-4);
    border-bottom: 1px solid var(--border);
    background: var(--bg-raised);
  }

  h2 {
    margin: 0;
    font-size: var(--fs-2);
    font-weight: 600;
  }

  .dismiss {
    display: inline-flex;
    background: none;
    border: none;
    border-radius: var(--radius-sm);
    color: var(--fg-muted);
    cursor: pointer;
    padding: 2px;
  }

  .dismiss:hover {
    color: var(--fg);
  }

  .body {
    padding: var(--sp-4);
    overflow: auto;
    font-size: var(--fs-1);
  }

  footer {
    display: flex;
    justify-content: flex-end;
    gap: var(--sp-2);
    padding: var(--sp-3) var(--sp-4);
    border-top: 1px solid var(--border);
    background: var(--bg-raised);
  }

  @media (prefers-reduced-motion: no-preference) {
    dialog[open] {
      animation: rise var(--dur-2) var(--ease);
    }

    @keyframes rise {
      from {
        opacity: 0;
        transform: translateY(6px) scale(0.99);
      }
    }
  }
</style>
