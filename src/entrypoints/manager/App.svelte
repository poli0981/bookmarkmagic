<script lang="ts">
  import { onMount } from 'svelte';
  import { getAppVersion } from '@/lib/browser/app-info';
  import AboutTab from '@/lib/components/AboutTab.svelte';
  import EditTab from '@/lib/components/EditTab.svelte';
  import ExportTab from '@/lib/components/ExportTab.svelte';
  import ImportTab from '@/lib/components/ImportTab.svelte';
  import LanguageSwitcher from '@/lib/components/LanguageSwitcher.svelte';
  import LegalGate from '@/lib/components/LegalGate.svelte';
  import SettingsTab from '@/lib/components/SettingsTab.svelte';
  import TabBar from '@/lib/components/TabBar.svelte';
  import ThemeToggle from '@/lib/components/ThemeToggle.svelte';
  import Toast from '@/lib/components/Toast.svelte';
  import { t } from '@/lib/i18n/index.svelte';
  import { isWriting } from '@/lib/stores/import-session.svelte';
  import { REPO_URL } from '@/lib/links';
  import {
    getBlockedRoutes,
    getLegalStatus,
    isGatedRoute,
    isGateRequired,
  } from '@/lib/stores/legal.svelte';
  import { getRoute, navigate, startRouting } from '@/lib/stores/route.svelte';
  import { flushSettings, getSettings, updateSettings } from '@/lib/stores/settings.svelte';
  import { pushToast } from '@/lib/stores/toast.svelte';

  // Settings are loaded and awaited in main.ts, before this ever mounts.
  const settings = $derived(getSettings());
  const version = getAppVersion();
  const legal = $derived(getLegalStatus());
  const gated = $derived(isGateRequired() && isGatedRoute(getRoute()));

  let mainEl: HTMLElement | undefined = $state();

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

  /**
   * Shared by the header controls so a silent failure there is impossible.
   *
   * The toast carries the LOCALIZED sentence, never the raw browser error —
   * `detail` is essentially always present for a storage rejection, so putting
   * it first made every translation of settings.saveFailed unreachable. The
   * header has no room for a detail block; #settings shows one.
   */
  function save(patch: Parameters<typeof updateSettings>[0]): void {
    void updateSettings(patch).then((outcome) => {
      pushToast(t(outcome.ok ? 'settings.saved' : 'settings.saveFailed'), outcome.ok ? 'success' : 'danger');
    });
  }
</script>

<header>
  <div class="brand">
    <span class="mark" aria-hidden="true">◆</span>
    <strong>{t('common.appName')}</strong>
  </div>
  <TabBar blocked={getBlockedRoutes()} />
  <div class="controls">
    <LanguageSwitcher compact value={settings.locale} onchange={(locale) => save({ locale })} />
    <ThemeToggle compact value={settings.theme} onchange={(theme) => save({ theme })} />
  </div>
</header>

<main bind:this={mainEl} tabindex="-1">
  {#if gated && legal.kind === 'required'}
    <!-- Fills the content region rather than covering the viewport. docs/06 §3
         calls it "a full overlay", but docs/14 §2 (echoed in docs/03 §4 and the
         docs/15 log) requires #settings and #about to stay reachable while it
         is up — a literal inset:0 scrim would bury the footer links that get
         you there. Header and footer stay live; the three blocked tabs are
         disabled via TabBar's `blocked`.

         Side effect worth keeping: the Import/Export/Edit tabs never mount
         before acceptance, so nothing touches chrome.bookmarks until the user
         has agreed to the terms. -->
    <LegalGate status={legal} onaccepted={() => mainEl?.focus()} />
  {:else if getRoute() === 'import'}
    <ImportTab />
  {:else if getRoute() === 'export'}
    <ExportTab />
  {:else if getRoute() === 'edit'}
    <EditTab />
  {:else if getRoute() === 'settings'}
    <SettingsTab />
  {:else}
    <AboutTab />
  {/if}
</main>

<footer>
  <span>
    {#if version !== ''}v{version} · {/if}GPL-3.0 ·
    <a href={REPO_URL} target="_blank" rel="noopener noreferrer">GitHub ↗</a>
  </span>
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
