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
  import Icon from '@/lib/components/icons/Icon.svelte';
  import { t } from '@/lib/i18n/index.svelte';
  import { isWriting } from '@/lib/stores/import-session.svelte';
  import { REPO_URL } from '@/lib/links';
  import {
    getBlockedRoutes,
    getLegalStatus,
    isGatedRoute,
    isGateRequired,
  } from '@/lib/stores/legal.svelte';
  import { getRoute, isRoute, navigate, startRouting } from '@/lib/stores/route.svelte';
  import { subscribeStorage } from '@/lib/browser/storage';
  import { MANAGER_CHANNEL, type NavigateMessage } from '@/lib/browser/open-manager';
  import { adoptExternalLegal } from '@/lib/stores/legal.svelte';
  import {
    adoptExternalSettings,
    flushSettings,
    getSettings,
    updateSettings,
  } from '@/lib/stores/settings.svelte';
  import { pushToast } from '@/lib/stores/toast.svelte';

  // Settings are loaded and awaited in main.ts, before this ever mounts.
  const settings = $derived(getSettings());
  const version = getAppVersion();
  const legal = $derived(getLegalStatus());
  const gated = $derived(isGateRequired() && isGatedRoute(getRoute()));

  let mainEl: HTMLElement | undefined = $state();

  const ROUTE_KEYS = {
    import: 'common.import',
    export: 'common.export',
    edit: 'common.edit',
    settings: 'common.settings',
    about: 'common.about',
  } as const;

  // Each route names its own tab in the browser's tab strip and history (uL16).
  $effect(() => {
    document.title = `${t(ROUTE_KEYS[getRoute()])} · ${t('common.appName')}`;
  });

  onMount(() => {
    // The tab bar and the footer already refuse to navigate mid-write. This
    // closes the third door: browser Back, which fires `hashchange` directly
    // and — during the backup attestation — used to unmount ImportTab and leave
    // the Manager permanently locked.
    const stopRouting = startRouting({
      isBlocked: isWriting,
      onBlocked: () => pushToast(t('common.busy'), 'info'),
    });

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

    // Two Manager tabs used to overwrite each other silently: `save()` writes
    // the whole settings object, so a tab holding a stale locale reverted the
    // other tab's language change the moment its own theme toggle fired.
    // Registered here rather than in main.ts because this is the only place
    // with a teardown path.
    const stopStorage = subscribeStorage((change) => {
      if (change.settings !== undefined) adoptExternalSettings(change.settings);
      if ('legal' in change) adoptExternalLegal(change.legal ?? null);
    });

    // The popup asks an open Manager to switch route (uM12). Refused while an
    // import is writing, exactly like the tab bar and browser Back.
    const channel = new BroadcastChannel(MANAGER_CHANNEL);
    channel.onmessage = (event: MessageEvent<NavigateMessage>) => {
      if (event.data?.kind !== 'navigate') return;
      if (isWriting()) {
        pushToast(t('common.busy'), 'info');
        return;
      }
      const route = String(event.data.route).replace(/^#/, '');
      if (isRoute(route)) navigate(route);
    };

    globalThis.addEventListener('beforeunload', onBeforeUnload);
    globalThis.document?.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      stopRouting();
      stopStorage();
      channel.close();
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
    <span class="mark"><Icon name="logo" size={20} motion="pulse" /></span>
    <strong>{t('common.appName')}</strong>
    <span class="crumb mono" aria-hidden="true">~/{getRoute()}</span>
  </div>
  <TabBar blocked={getBlockedRoutes()} />
  <div class="controls">
    <LanguageSwitcher compact value={settings.locale} onchange={(locale) => save({ locale })} />
    <ThemeToggle compact value={settings.theme} onchange={(theme) => save({ theme })} />
  </div>
</header>

<main bind:this={mainEl} tabindex="-1">
  {#if gated && legal.kind === 'required'}
    <!-- Fills the content region rather than covering the viewport: docs/14 §2
         requires #settings and #about to stay reachable while it is up, and a
         literal inset:0 scrim would bury the status-bar links that get you
         there. The three blocked tabs never mount before acceptance, so
         nothing touches chrome.bookmarks until the user has agreed. -->
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

<!-- An IDE-style status bar: what this build is, what it can touch, and the
     two secondary routes. -->
<footer class="mono">
  <span class="cell local" title={t('status.localNote')}>
    <span class="dot" aria-hidden="true"></span>{t('status.local')}
  </span>
  <span class="cell" title={t('status.permissionsNote')}>
    <Icon name="shield" size={12} />bookmarks, storage
  </span>
  {#if version !== ''}<span class="cell">v{version}</span>{/if}
  <span class="cell">GPL-3.0</span>
  <a class="cell" href={REPO_URL} target="_blank" rel="noopener noreferrer">
    <Icon name="code" size={12} />GitHub
  </a>
  <nav aria-label={t('status.more')}>
    <!-- Gated like TabBar's tabs: navigating away mid-write unmounts ImportTab
         and strands the attestation resolver, deadlocking the import
         (docs/03 §5). -->
    <button
      class="cell"
      aria-current={getRoute() === 'settings' ? 'page' : undefined}
      disabled={isWriting()}
      title={isWriting() ? t('common.busy') : undefined}
      onclick={() => navigate('settings')}
    >
      <Icon name="gear" size={12} motion="spin" />{t('common.settings')}
    </button>
    <button
      class="cell"
      aria-current={getRoute() === 'about' ? 'page' : undefined}
      disabled={isWriting()}
      title={isWriting() ? t('common.busy') : undefined}
      onclick={() => navigate('about')}
    >
      <Icon name="info" size={12} />{t('common.about')}
    </button>
  </nav>
</footer>

<!-- Mounted once, outside <main>, so the route chain below cannot unmount it
     mid-dismiss and strand a timer (docs/06 §4). -->
<Toast />

<style>
  header {
    position: sticky;
    top: 0;
    z-index: 10;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-3) var(--sp-4);
    padding: var(--sp-2) max(var(--sp-4), calc((100% - var(--width-page)) / 2));
    border-bottom: 1px solid var(--border);
    background: color-mix(in srgb, var(--bg) 88%, transparent);
    backdrop-filter: blur(8px);
  }

  .brand {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    min-width: 0;
  }

  .mark {
    display: inline-flex;
    padding: 5px;
    border-radius: var(--radius-sm);
    background: var(--accent);
    color: var(--accent-fg);
  }

  .crumb {
    color: var(--fg-muted);
    font-size: var(--fs-0);
    padding: 1px 6px;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--bg-sunken);
  }

  .controls {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
  }

  /* The page is a column: header, content, status bar — the bar sits at the
     bottom of the window even when the content is short. */
  :global(#app) {
    display: flex;
    flex-direction: column;
    min-height: 100dvh;
  }

  main {
    flex: 1;
    width: 100%;
    max-width: var(--width-page);
    margin: 0 auto;
    padding: var(--sp-5) var(--sp-4) var(--sp-6);
  }

  main:focus {
    outline: none;
  }

  footer {
    position: sticky;
    bottom: 0;
    display: flex;
    flex-wrap: wrap;
    align-items: stretch;
    gap: 0;
    padding: 0 max(var(--sp-2), calc((100% - var(--width-page)) / 2));
    border-top: 1px solid var(--border);
    background: var(--bg-sunken);
    color: var(--fg-muted);
    font-size: var(--fs-0);
  }

  .cell {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px var(--sp-2);
    border-right: 1px solid var(--border);
    color: inherit;
    text-decoration: none;
    white-space: nowrap;
  }

  .local {
    color: var(--success);
  }

  .dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: currentColor;
  }

  footer nav {
    display: flex;
    margin-left: auto;
  }

  footer nav .cell:last-child {
    border-right: none;
  }

  footer button {
    font: inherit;
    background: none;
    border: none;
    border-left: 1px solid var(--border);
    cursor: pointer;
  }

  a.cell:hover,
  footer button:hover:not(:disabled),
  footer button[aria-current='page'] {
    color: var(--accent);
    background: var(--bg-raised);
  }

  footer button:disabled {
    cursor: not-allowed;
  }

  @media (max-width: 640px) {
    .crumb {
      display: none;
    }
  }
</style>
