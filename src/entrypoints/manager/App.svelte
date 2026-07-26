<script lang="ts">
  import { onMount } from 'svelte';
  import EditTab from '@/lib/components/EditTab.svelte';
  import ExportTab from '@/lib/components/ExportTab.svelte';
  import ImportTab from '@/lib/components/ImportTab.svelte';
  import LanguageSwitcher from '@/lib/components/LanguageSwitcher.svelte';
  import SettingsTab from '@/lib/components/SettingsTab.svelte';
  import TabBar from '@/lib/components/TabBar.svelte';
  import ThemeToggle from '@/lib/components/ThemeToggle.svelte';
  import Toast from '@/lib/components/Toast.svelte';
  import { t } from '@/lib/i18n/index.svelte';
  import { isWriting } from '@/lib/stores/import-session.svelte';
  import { getRoute, navigate, startRouting } from '@/lib/stores/route.svelte';
  import { flushSettings, getSettings, updateSettings } from '@/lib/stores/settings.svelte';
  import { pushToast } from '@/lib/stores/toast.svelte';

  // Settings are loaded and awaited in main.ts, before this ever mounts.
  const settings = $derived(getSettings());

  onMount(() => {
    const stopRouting = startRouting();

    // Leaving mid-write would kill the queue with the tab (docs/03 §5).
    const onBeforeUnload = (event: BeforeUnloadEvent): void => {
      if (!isWriting()) return;
      event.preventDefault();
    };

    // Fires on tab close, navigation and backgrounding — unlike beforeunload it
    // cannot be cancelled, so it is the right place to shorten the 200 ms
    // window in which a just-changed setting is still unwritten.
    const onVisibilityChange = (): void => {
      if (globalThis.document?.visibilityState === 'hidden') void flushSettings();
    };

    globalThis.addEventListener('beforeunload', onBeforeUnload);
    globalThis.document?.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      stopRouting();
      globalThis.removeEventListener('beforeunload', onBeforeUnload);
      globalThis.document?.removeEventListener('visibilitychange', onVisibilityChange);
    };
  });

  /** Shared by the header controls so a silent failure there is impossible. */
  function save(patch: Parameters<typeof updateSettings>[0]): void {
    void updateSettings(patch).then((outcome) => {
      if (outcome.ok) pushToast(t('settings.saved'), 'success');
      else pushToast(outcome.detail ?? t('settings.saveFailed'), 'danger');
    });
  }
</script>

<header>
  <div class="brand">
    <span class="mark" aria-hidden="true">◆</span>
    <strong>{t('common.appName')}</strong>
  </div>
  <TabBar />
  <div class="controls">
    <LanguageSwitcher compact value={settings.locale} onchange={(locale) => save({ locale })} />
    <ThemeToggle compact value={settings.theme} onchange={(theme) => save({ theme })} />
  </div>
</header>

<main>
  {#if getRoute() === 'import'}
    <ImportTab />
  {:else if getRoute() === 'export'}
    <ExportTab />
  {:else if getRoute() === 'edit'}
    <EditTab />
  {:else if getRoute() === 'settings'}
    <SettingsTab />
  {:else}
    <!-- Phase 4's About tab lands in the next commit. -->
    <p class="placeholder">{t('common.comingSoon', { tab: t(`common.${getRoute()}`) })}</p>
  {/if}
</main>

<footer>
  <span>v0.1.0 · GPL-3.0</span>
  <nav>
    <!-- Gated like TabBar's tabs: navigating away mid-write unmounts ImportTab
         and strands the attestation resolver, deadlocking the import
         (docs/03 §5). The footer used to be the one way around that. -->
    <button
      disabled={isWriting()}
      title={isWriting() ? t('common.busy') : undefined}
      onclick={() => navigate('settings')}>{t('common.settings')}</button
    >
    <button
      disabled={isWriting()}
      title={isWriting() ? t('common.busy') : undefined}
      onclick={() => navigate('about')}>{t('common.about')}</button
    >
  </nav>
</footer>

<!-- Mounted once, outside <main>, so the route chain below cannot unmount it
     mid-dismiss and strand a timer (docs/06 §4). -->
<Toast />

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

  .controls {
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

  footer button:hover:not(:disabled) {
    color: var(--accent);
  }

  footer button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
</style>
