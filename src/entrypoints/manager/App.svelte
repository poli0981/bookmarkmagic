<script lang="ts">
  import { onMount } from 'svelte';
  import EditTab from '@/lib/components/EditTab.svelte';
  import ExportTab from '@/lib/components/ExportTab.svelte';
  import ImportTab from '@/lib/components/ImportTab.svelte';
  import TabBar from '@/lib/components/TabBar.svelte';
  import { t } from '@/lib/i18n/index.svelte';
  import { isWriting } from '@/lib/stores/import-session.svelte';
  import { getRoute, navigate, startRouting } from '@/lib/stores/route.svelte';
  import { loadSettings } from '@/lib/stores/settings.svelte';

  onMount(() => {
    void loadSettings();
    const stopRouting = startRouting();

    // Leaving mid-write would kill the queue with the tab (docs/03 §5).
    const onBeforeUnload = (event: BeforeUnloadEvent): void => {
      if (!isWriting()) return;
      event.preventDefault();
    };
    globalThis.addEventListener('beforeunload', onBeforeUnload);

    return () => {
      stopRouting();
      globalThis.removeEventListener('beforeunload', onBeforeUnload);
    };
  });
</script>

<header>
  <div class="brand">
    <span class="mark" aria-hidden="true">◆</span>
    <strong>{t('common.appName')}</strong>
  </div>
  <TabBar />
</header>

<main>
  {#if getRoute() === 'import'}
    <ImportTab />
  {:else if getRoute() === 'export'}
    <ExportTab />
  {:else if getRoute() === 'edit'}
    <EditTab />
  {:else}
    <!-- Phases 3-4 fill these in; the routes exist now so the shell is real. -->
    <p class="placeholder">{t('common.comingSoon', { tab: t(`common.${getRoute()}`) })}</p>
  {/if}
</main>

<footer>
  <span>v0.1.0 · GPL-3.0</span>
  <nav>
    <button onclick={() => navigate('settings')}>{t('common.settings')}</button>
    <button onclick={() => navigate('about')}>{t('common.about')}</button>
  </nav>
</footer>

<style>
  header,
  footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-4);
    max-width: 960px;
    margin: 0 auto;
    padding: var(--sp-3) var(--sp-4);
  }

  header {
    border-bottom: 1px solid var(--border);
  }

  footer {
    border-top: 1px solid var(--border);
    color: var(--fg-muted);
    font-size: var(--fs-0);
  }

  .brand {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
  }

  .mark {
    color: var(--accent);
  }

  main {
    max-width: 960px;
    margin: 0 auto;
    padding: var(--sp-5) var(--sp-4);
    min-height: 60vh;
  }

  .placeholder {
    color: var(--fg-muted);
  }

  footer nav {
    display: flex;
    gap: var(--sp-3);
  }

  footer button {
    font: inherit;
    background: none;
    border: none;
    color: var(--fg-muted);
    cursor: pointer;
    padding: 0;
  }

  footer button:hover {
    color: var(--accent);
  }
</style>
