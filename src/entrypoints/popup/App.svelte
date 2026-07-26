<script lang="ts">
  import { onMount } from 'svelte';
  import { getAppVersion } from '@/lib/browser/app-info';
  import { getRootChildren } from '@/lib/browser/bookmarks';
  import { openManager } from '@/lib/browser/open-manager';
  import { num, t } from '@/lib/i18n/index.svelte';

  let counts = $state<{ bookmarks: number; folders: number } | undefined>();
  const version = getAppVersion();

  // Settings are loaded and awaited in main.ts, before this ever mounts.
  onMount(() => {
    void countTree();
  });

  /** Cheap stats for the footer. No heavy work ever runs here (docs/06 §2). */
  async function countTree(): Promise<void> {
    try {
      const roots = await getRootChildren();
      let bookmarks = 0;
      let folders = 0;
      const walk = (nodes: readonly { url?: string; children?: unknown[] }[]): void => {
        for (const node of nodes) {
          if (node.url === undefined) folders++;
          else bookmarks++;
          if (node.children !== undefined) {
            walk(node.children as { url?: string; children?: unknown[] }[]);
          }
        }
      };
      walk(roots);
      counts = { bookmarks, folders };
    } catch {
      counts = undefined;
    }
  }
</script>

<main>
  <header>
    <span class="mark" aria-hidden="true">◆</span>
    <strong>{t('common.appName')}</strong>
    {#if version !== ''}<span class="version">v{version}</span>{/if}
  </header>

  <div class="actions">
    <button onclick={() => void openManager('#import')}>⬆ {t('popup.import')}</button>
    <button onclick={() => void openManager('#export')}>⬇ {t('popup.export')}</button>
    <button onclick={() => void openManager('#edit')}>🗂 {t('popup.manage')}</button>
  </div>

  <footer>
    <span>
      {#if counts !== undefined}
        {t('popup.counts', { bookmarks: num(counts.bookmarks), folders: num(counts.folders) })}
      {/if}
    </span>
    <button
      class="settings"
      aria-label={t('common.settings')}
      title={t('common.settings')}
      onclick={() => void openManager('#settings')}
    >
      ⚙
    </button>
  </footer>
</main>

<style>
  main {
    width: 320px;
    padding: var(--sp-3);
  }

  header {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    padding-bottom: var(--sp-3);
    border-bottom: 1px solid var(--border);
  }

  .mark {
    color: var(--accent);
  }

  .actions {
    display: flex;
    flex-direction: column;
    gap: var(--sp-2);
    padding: var(--sp-3) 0;
  }

  .actions button {
    font: inherit;
    text-align: left;
    padding: var(--sp-2) var(--sp-3);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--bg-raised);
    color: var(--fg);
    cursor: pointer;
  }

  .actions button:hover {
    border-color: var(--accent);
  }

  footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-2);
    padding-top: var(--sp-2);
    border-top: 1px solid var(--border);
    color: var(--fg-muted);
    font-size: var(--fs-0);
    min-height: 1.5em;
  }

  .version {
    margin-left: auto;
    color: var(--fg-muted);
    font-size: var(--fs-0);
    font-variant-numeric: tabular-nums;
  }

  .settings {
    font: inherit;
    flex-shrink: 0;
    padding: 0 var(--sp-1);
    border: none;
    background: none;
    color: var(--fg-muted);
    cursor: pointer;
    font-size: var(--fs-2);
  }

  .settings:hover {
    color: var(--accent);
  }
</style>
