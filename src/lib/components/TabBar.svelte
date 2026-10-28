<script lang="ts">
  import { t } from '../i18n/index.svelte';
  import { isWriting } from '../stores/import-session.svelte';
  import { getRoute, navigate, type Route } from '../stores/route.svelte';
  import Icon, { type IconName } from './icons/Icon.svelte';

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

  const TABS: { route: Route; key: string; icon: IconName }[] = [
    { route: 'import', key: 'common.import', icon: 'upload' },
    { route: 'export', key: 'common.export', icon: 'download' },
    { route: 'edit', key: 'common.edit', icon: 'edit' },
  ];

  /** Index of the active tab, for the sliding indicator; -1 on #settings/#about. */
  const active = $derived(TABS.findIndex((tab) => tab.route === getRoute()));
</script>

<nav aria-label={t('common.sections')} style:--active={active} class:none={active === -1}>
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
      <Icon name={tab.icon} size={15} motion="bob" />
      <span>{t(tab.key)}</span>
      {#if blocked.includes(tab.route)}
        <Icon name="lock" size={12} /><span class="sr-only">{t('legal.blocked')}</span>
      {/if}
    </button>
  {/each}
  <span class="indicator" aria-hidden="true"></span>
</nav>

<style>
  nav {
    --tab-width: 7.5rem;
    position: relative;
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: var(--tab-width);
    padding: 3px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--bg-sunken);
  }

  button {
    position: relative;
    z-index: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--sp-2);
    font: inherit;
    font-size: var(--fs-1);
    font-weight: 500;
    padding: 5px var(--sp-3);
    border: none;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--fg-muted);
    cursor: pointer;
    white-space: nowrap;
  }

  button:hover:not(:disabled) {
    color: var(--fg);
  }

  /* Said with the cursor and the title, not opacity: dimmed text falls under
     the contrast floor while it still has to be read. */
  button:disabled {
    cursor: not-allowed;
  }

  .active {
    color: var(--fg);
  }

  /* One raised pill behind the active tab; it slides between tabs. */
  .indicator {
    position: absolute;
    top: 3px;
    bottom: 3px;
    left: 3px;
    width: var(--tab-width);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-sm);
    background: var(--bg);
    box-shadow: var(--shadow-1);
    transform: translateX(calc(var(--active) * var(--tab-width)));
  }

  .none .indicator {
    visibility: hidden;
  }

  @media (max-width: 560px) {
    nav {
      --tab-width: 2.75rem;
    }

    button span {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
    }
  }

  @media (prefers-reduced-motion: no-preference) {
    .indicator {
      transition: transform var(--dur-2) var(--ease);
    }
  }
</style>
