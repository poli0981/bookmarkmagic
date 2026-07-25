<script lang="ts">
  import { t } from '../i18n/index.svelte';
  import { isWriting } from '../stores/import-session.svelte';
  import { getRoute, navigate, type Route } from '../stores/route.svelte';

  interface Props {
    /** Routes the legal gate is currently blocking (docs/14 §2). */
    blocked?: readonly Route[];
  }

  let { blocked = [] }: Props = $props();

  const TABS: { route: Route; key: string }[] = [
    { route: 'import', key: 'common.import' },
    { route: 'export', key: 'common.export' },
    { route: 'edit', key: 'common.edit' },
  ];
</script>

<nav aria-label="Sections">
  {#each TABS as tab (tab.route)}
    <button
      class:active={getRoute() === tab.route}
      aria-current={getRoute() === tab.route ? 'page' : undefined}
      disabled={blocked.includes(tab.route) || (isWriting() && getRoute() !== tab.route)}
      title={isWriting() && getRoute() !== tab.route ? t('common.busy') : undefined}
      onclick={() => navigate(tab.route)}
    >
      {t(tab.key)}
    </button>
  {/each}
</nav>

<style>
  nav {
    display: flex;
    gap: var(--sp-1);
  }

  button {
    font: inherit;
    padding: var(--sp-2) var(--sp-3);
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--fg-muted);
    cursor: pointer;
  }

  button:hover:not(:disabled) {
    color: var(--fg);
  }

  button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .active {
    background: var(--bg-raised);
    border-color: var(--border);
    color: var(--fg);
  }
</style>
