<script lang="ts">
  import { onMount } from 'svelte';
  import { getRootChildren } from '@/lib/browser/bookmarks';
  import { openManager } from '@/lib/browser/open-manager';
  import { num, t } from '@/lib/i18n/index.svelte';
  import { loadSettings } from '@/lib/stores/settings.svelte';

  let counts = $state<{ bookmarks: number; folders: number } | undefined>();

  onMount(() => {
    void loadSettings();
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
  </header>

  <div class="actions">
    <button onclick={() => void openManager('#import')}>⬆ {t('popup.import')}</button>
    <button onclick={() => void openManager('#export')}>⬇ {t('popup.export')}</button>
    <button onclick={() => void openManager('#edit')}>🗂 {t('popup.manage')}</button>
  </div>

  <footer>
    {#if counts !== undefined}
      {t('popup.counts', { bookmarks: num(counts.bookmarks), folders: num(counts.folders) })}
    {/if}
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
    padding-top: var(--sp-2);
    border-top: 1px solid var(--border);
    color: var(--fg-muted);
    font-size: var(--fs-0);
    min-height: 1.5em;
  }
</style>
