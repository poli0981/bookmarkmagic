<script lang="ts">
  import { t } from '../i18n/index.svelte';
  import { isWriting } from '../stores/import-session.svelte';
  import { getRoute, navigate, type Route } from '../stores/route.svelte';

  interface Props {
    /**
     * Routes the legal gate is currently blocking (docs/14 §2).
     *
     * These stay CLICKABLE. What blocks them is App.svelte rendering the gate
     * in place of the tab body, so the tab never mounts pre-acceptance. Making
     * the buttons inert instead was a dead end: they are the only in-app
     * navigation to a gated route, so a first-run user who reached #settings —
     * the flow docs/14 §2 explicitly wants — had no way back to the accept UI.
     */
    blocked?: readonly Route[];
  }

  let { blocked = [] }: Props = $props();

  const TABS: { route: Route; key: string }[] = [
    { route: 'import', key: 'common.import' },
    { route: 'export', key: 'common.export' },
    { route: 'edit', key: 'common.edit' },
  ];
</script>

<nav aria-label={t('common.sections')}>
  {#each TABS as tab (tab.route)}
    <button
      class:active={getRoute() === tab.route}
      aria-current={getRoute() === tab.route ? 'page' : undefined}
      class:locked={blocked.includes(tab.route)}
      disabled={isWriting() && getRoute() !== tab.route}
      title={blocked.includes(tab.route)
        ? t('legal.blocked')
        : isWriting() && getRoute() !== tab.route
          ? t('common.busy')
          : undefined}
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

  /* Reachable, but visibly not yet usable — clicking shows the gate. */
  .locked {
    opacity: 0.65;
  }

  .locked::after {
    content: ' 🔒';
    font-size: var(--fs-0);
  }

  .active {
    background: var(--bg-raised);
    border-color: var(--border);
    color: var(--fg);
  }
</style>
