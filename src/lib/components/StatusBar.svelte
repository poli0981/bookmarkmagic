<script lang="ts">
  /**
   * The Manager's IDE-style status bar — docs/06 §2: what this build is, what
   * it can touch, and the two secondary routes. Those two are gated like the
   * tab bar: navigating away mid-write unmounts ImportTab and strands the
   * attestation resolver, which deadlocked the whole import — docs/03 §5.
   */
  import { getAppVersion } from '../browser/app-info';
  import { t } from '../i18n/index.svelte';
  import { REPO_URL } from '../links';
  import { isWriting } from '../stores/import-session.svelte';
  import { getRoute, navigate } from '../stores/route.svelte';
  import Icon from './icons/Icon.svelte';

  const version = getAppVersion();
</script>

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

<style>
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
</style>
