<script lang="ts">
  import { t } from '../i18n/index.svelte';
  import { dismissToast, getVisibleToast } from '../stores/toast.svelte';
  import Icon from './icons/Icon.svelte';

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
  {#key toast.id}
    <div class="toast {toast.tone}">
      <span class="glyph" aria-hidden="true">
        <Icon
          name={toast.tone === 'danger' ? 'error' : toast.tone === 'success' ? 'check' : 'info'}
          motion={toast.tone === 'success' ? 'draw' : 'none'}
          size={16}
        />
      </span>
      <!-- Hidden from assistive tech: the live regions above already carry it,
           and announcing it twice is worse than not styling it. -->
      <span class="message" aria-hidden="true">{toast.message}</span>
      <button aria-label={t('common.dismiss')} onclick={() => dismissToast(toast.id)}>
        <Icon name="close" size={14} />
      </button>
    </div>
  {/key}
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
    bottom: calc(var(--sp-6) + var(--sp-2));
    z-index: var(--z-toast);
    display: flex;
    align-items: flex-start;
    gap: var(--sp-3);
    max-width: min(48ch, calc(100vw - 2 * var(--sp-4)));
    padding: var(--sp-3);
    border: 1px solid var(--border-strong);
    border-left: 3px solid var(--fg-muted);
    border-radius: var(--radius);
    background: var(--bg);
    color: var(--fg);
    font-size: var(--fs-1);
    box-shadow: var(--shadow-2);
  }

  .glyph {
    display: inline-flex;
    padding-top: 1px;
    color: var(--fg-muted);
  }

  .message {
    flex: 1;
  }

  .success {
    border-left-color: var(--success);
  }

  .success .glyph {
    color: var(--success);
  }

  .danger {
    border-left-color: var(--danger);
  }

  .danger .glyph {
    color: var(--danger);
  }

  button {
    display: inline-flex;
    flex-shrink: 0;
    padding: 2px;
    border: none;
    border-radius: var(--radius-sm);
    background: none;
    color: var(--fg-muted);
    cursor: pointer;
  }

  button:hover {
    color: var(--fg);
    background: var(--bg-raised);
  }

  @media (prefers-reduced-motion: no-preference) {
    .toast {
      animation: slide-in var(--dur-3) var(--ease);
    }

    @keyframes slide-in {
      from {
        opacity: 0;
        transform: translateX(16px);
      }
    }
  }
</style>
