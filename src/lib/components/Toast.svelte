<script lang="ts">
  import { t } from '../i18n/index.svelte';
  import { dismissToast, getVisibleToast } from '../stores/toast.svelte';

  const toast = $derived(getVisibleToast());
</script>

<!-- Both live regions are ALWAYS in the DOM and only their text changes.

     A live region inserted into the page already populated is not reliably
     announced — screen readers derive announcements from mutations to a region
     that was already present, so the earlier "whole thing inside {#if}" shape
     meant success toasts were silently skipped.

     Two fixed regions rather than one with a swapped aria-live, because
     changing a live region's politeness at runtime is not reliably picked up.
     Assertive interrupts, which is right for a failure and wrong for a
     confirmation — the same split Callout already makes. -->
<div class="sr-only" role="status" aria-live="polite">
  {toast !== undefined && toast.tone !== 'danger' ? toast.message : ''}
</div>
<div class="sr-only" role="alert" aria-live="assertive">
  {toast?.tone === 'danger' ? toast.message : ''}
</div>

{#if toast !== undefined}
  <div class="toast {toast.tone}">
    <!-- Hidden from assistive tech: the live regions above already carry it,
         and announcing it twice is worse than not styling it. -->
    <span aria-hidden="true">{toast.message}</span>
    <button aria-label={t('common.dismiss')} onclick={() => dismissToast(toast.id)}>✕</button>
  </div>
{/if}

<style>
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  .toast {
    position: fixed;
    right: var(--sp-4);
    bottom: var(--sp-4);
    z-index: 10;
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    max-width: 44ch;
    padding: var(--sp-2) var(--sp-3);
    border: 1px solid var(--border);
    border-left: 3px solid var(--fg-muted);
    border-radius: var(--radius-sm);
    background: var(--bg-raised);
    color: var(--fg);
    font-size: var(--fs-1);
    box-shadow: 0 4px 16px rgb(0 0 0 / 0.18);
  }

  .success {
    border-left-color: var(--success);
  }

  .danger {
    border-left-color: var(--danger);
  }

  button {
    font: inherit;
    flex-shrink: 0;
    padding: 0;
    border: none;
    background: none;
    color: var(--fg-muted);
    cursor: pointer;
  }

  button:hover {
    color: var(--fg);
  }
</style>
