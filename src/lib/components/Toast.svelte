<script lang="ts">
  import { t } from '../i18n/index.svelte';
  import { dismissToast, getVisibleToast } from '../stores/toast.svelte';

  const toast = $derived(getVisibleToast());
</script>

{#if toast !== undefined}
  <!-- role follows Callout's convention: an error interrupts, a status waits. -->
  <div class="toast {toast.tone}" role={toast.tone === 'danger' ? 'alert' : 'status'}>
    <span>{toast.message}</span>
    <button aria-label={t('common.cancel')} onclick={() => dismissToast(toast.id)}>✕</button>
  </div>
{/if}

<style>
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
