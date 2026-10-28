<script lang="ts">
  import { onMount } from 'svelte';
  import { getAppVersion } from '@/lib/browser/app-info';
  import { getRootChildren } from '@/lib/browser/bookmarks';
  import { type ManagerRoute, openManager } from '@/lib/browser/open-manager';
  import Icon, { type IconName } from '@/lib/components/icons/Icon.svelte';
  import { num, t, tPlural } from '@/lib/i18n/index.svelte';

  let counts = $state<{ bookmarks: number; folders: number } | undefined>();
  const version = getAppVersion();

  const TILES: { hash: ManagerRoute; icon: IconName; label: string; hint: string }[] = [
    { hash: '#import', icon: 'upload', label: 'popup.import', hint: 'popup.importHint' },
    { hash: '#export', icon: 'download', label: 'popup.export', hint: 'popup.exportHint' },
    { hash: '#edit', icon: 'edit', label: 'popup.manage', hint: 'popup.manageHint' },
  ];

  // Settings are loaded and awaited in main.ts, before this ever mounts.
  onMount(() => {
    void countTree();
  });

  /**
   * Cheap stats for the readout. No heavy work ever runs here (docs/06 §2).
   * Counts what lives INSIDE the roots: 1.0.x counted the three permanent root
   * folders too, so an empty profile reported "0 bookmarks · 3 folders".
   */
  async function countTree(): Promise<void> {
    try {
      let bookmarks = 0;
      let folders = 0;
      const stack: { url?: string; children?: unknown[] }[] = [];
      for (const root of await getRootChildren()) {
        // A loop, not push(...spread): Other Bookmarks can hold 100k children.
        for (const child of root.children ?? []) stack.push(child);
      }
      while (stack.length > 0) {
        const node = stack.pop();
        if (node === undefined) break;
        if (node.url === undefined) folders++;
        else bookmarks++;
        // SAFETY: children of a LiveNode are LiveNodes, which have this shape.
        for (const child of (node.children ?? []) as typeof stack) stack.push(child);
      }
      counts = { bookmarks, folders };
    } catch {
      counts = undefined;
    }
  }
</script>

<main>
  <header>
    <span class="mark"><Icon name="logo" size={16} /></span>
    <strong>{t('common.appName')}</strong>
    {#if version !== ''}<span class="version mono">v{version}</span>{/if}
  </header>

  <dl class="readout" aria-live="polite">
    <div>
      <dt class="eyebrow">{tPlural('popup.bookmarks', counts?.bookmarks ?? 0)}</dt>
      <dd class="mono">{counts === undefined ? '—' : num(counts.bookmarks)}</dd>
    </div>
    <div>
      <dt class="eyebrow">{tPlural('popup.folders', counts?.folders ?? 0)}</dt>
      <dd class="mono">{counts === undefined ? '—' : num(counts.folders)}</dd>
    </div>
  </dl>

  <div class="tiles">
    {#each TILES as tile (tile.hash)}
      <button class="tile" onclick={() => void openManager(tile.hash)}>
        <span class="icon"><Icon name={tile.icon} size={18} motion="bob" /></span>
        <span class="text">
          <span class="label">{t(tile.label)}</span>
          <span class="hint">{t(tile.hint)}</span>
        </span>
        <Icon name="chevron" size={12} />
      </button>
    {/each}
  </div>

  <footer class="mono">
    <span class="local"><span class="dot" aria-hidden="true"></span>{t('status.local')}</span>
    <button
      class="settings"
      aria-label={t('common.settings')}
      title={t('common.settings')}
      onclick={() => void openManager('#settings')}
    >
      <Icon name="gear" size={15} motion="spin" />
    </button>
  </footer>
</main>

<style>
  main {
    width: 340px;
    padding: var(--sp-3);
    display: flex;
    flex-direction: column;
    gap: var(--sp-3);
  }

  header {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
  }

  .mark {
    display: inline-flex;
    padding: 4px;
    border-radius: var(--radius-sm);
    background: var(--accent);
    color: var(--accent-fg);
  }

  .version {
    margin-left: auto;
    color: var(--fg-muted);
    font-size: var(--fs-0);
  }

  .readout {
    display: grid;
    grid-template-columns: 1fr 1fr;
    margin: 0;
    border: 1px solid var(--border-strong);
    border-radius: var(--radius);
    background: var(--bg-sunken);
  }

  .readout div {
    padding: var(--sp-2) var(--sp-3);
  }

  .readout div + div {
    border-left: 1px solid var(--border);
  }

  dt {
    margin: 0;
  }

  dd {
    margin: 0;
    font-size: var(--fs-4);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    line-height: 1.2;
  }

  .tiles {
    display: flex;
    flex-direction: column;
    gap: var(--sp-2);
  }

  .tile {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    font: inherit;
    text-align: left;
    padding: var(--sp-2) var(--sp-3);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius);
    background: var(--bg);
    color: var(--fg-muted);
    cursor: pointer;
  }

  .tile:hover {
    border-color: var(--accent);
    color: var(--accent);
  }

  .icon {
    display: inline-flex;
    padding: 6px;
    border-radius: var(--radius-sm);
    background: var(--accent-subtle);
    color: var(--accent);
  }

  .text {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .label {
    color: var(--fg);
    font-size: var(--fs-1);
    font-weight: 600;
  }

  .hint {
    font-size: var(--fs-0);
    color: var(--fg-muted);
  }

  footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-top: var(--sp-2);
    border-top: 1px solid var(--border);
    font-size: var(--fs-0);
  }

  .local {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    color: var(--success);
  }

  .dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: currentColor;
  }

  .settings {
    display: inline-flex;
    padding: 3px;
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    background: none;
    color: var(--fg-muted);
    cursor: pointer;
  }

  .settings:hover {
    color: var(--accent);
    border-color: var(--border);
  }
</style>
