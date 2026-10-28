<script lang="ts">
  /**
   * The `role="tree"` container and its rows — docs/06 §3.3, docs/05 §9.
   *
   * The ARIA tree pattern lives here: roving focus through
   * `aria-activedescendant`, `aria-level` from 1, `aria-expanded` only on
   * expandable rows, and — because rows render flat — explicit
   * `aria-setsize`/`aria-posinset`. The keydown handler sits on this focusable
   * `<ul>`; one on a non-focusable wrapper would never fire.
   *
   * Rendering is bounded (docs/05 §9): rows mount in chunks of 500, a "Show
   * more" button adds the next chunk, and moving the focus past the end mounts
   * enough to show it. 1.0.x rendered every visible row in one pass, so "Expand
   * all" on a large profile froze the tab.
   */
  import type { EditNode } from '../edit/patch-tree';
  import { num, t } from '../i18n/index.svelte';
  import type { EditSession } from '../stores/edit-session.svelte';
  import TreeRow from './TreeRow.svelte';

  interface Props {
    session: EditSession;
    element?: HTMLElement | undefined;
    onkeydown: (event: KeyboardEvent) => void;
    onopen: (node: EditNode) => void;
    oncopy: (node: EditNode) => void;
    onsort: (node: EditNode) => void;
  }

  let { session, element = $bindable(), onkeydown, onopen, oncopy, onsort }: Props = $props();

  const CHUNK = 500;
  let limit = $state(CHUNK);

  const rows = $derived(session.rows);
  const shown = $derived(rows.length > limit ? rows.slice(0, limit) : rows);
  const hidden = $derived(rows.length - shown.length);

  // The active descendant must exist in the DOM, or the screen reader and the
  // scroll-into-view both lose it.
  $effect(() => {
    const id = session.focusedId;
    if (id === undefined) return;
    const index = rows.findIndex((row) => row.node.id === id);
    if (index >= limit) limit = Math.ceil((index + 1) / CHUNK) * CHUNK;
  });

  /** Tabbing in with nothing focused focuses the first row, so arrows work at once (uL6). */
  function onFocus(): void {
    if (session.focusedId === undefined) session.focusedId = rows[0]?.node.id;
  }
</script>

<div class="frame">
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <ul
    bind:this={element}
    class="tree"
    role="tree"
    aria-label={t('edit.tree')}
    aria-busy={session.busy}
    tabindex="0"
    aria-activedescendant={session.focusedId === undefined ? undefined : `node-${session.focusedId}`}
    {onkeydown}
    onfocus={onFocus}
  >
    {#each shown as row (row.node.id)}
      <li
        id="node-{row.node.id}"
        data-node-id={row.node.id}
        role="treeitem"
        aria-level={row.depth}
        aria-setsize={row.setSize}
        aria-posinset={row.posInSet}
        aria-expanded={row.expandable ? row.expanded : undefined}
        aria-selected={session.focusedId === row.node.id}
      >
        <TreeRow {row} {session} {onopen} {oncopy} {onsort} />
      </li>
    {/each}
  </ul>

  {#if rows.length === 0}
    <p class="empty">
      {session.loading ? t('edit.loading') : session.filtering ? t('edit.noMatches') : t('edit.empty')}
    </p>
  {/if}

  {#if hidden > 0}
    <button class="more" onclick={() => (limit += CHUNK)}>
      {t('edit.showMore', { n: num(Math.min(hidden, CHUNK)), total: num(hidden) })}
    </button>
  {/if}
</div>

<style>
  .frame {
    border: 1px solid var(--border-strong);
    border-radius: var(--radius);
    background: var(--bg);
    overflow: hidden;
  }

  .tree {
    list-style: none;
    margin: 0;
    padding: var(--sp-2);
    font-size: var(--fs-1);
    min-height: 160px;
    max-height: min(62vh, 620px);
    overflow: auto;
  }

  .tree:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: -2px;
  }

  .empty {
    margin: 0;
    color: var(--fg-muted);
    padding: var(--sp-4);
    text-align: center;
    border-top: 1px solid var(--border);
  }

  .more {
    display: block;
    width: 100%;
    font: inherit;
    font-family: var(--font-mono);
    font-size: var(--fs-0);
    padding: var(--sp-2);
    border: none;
    border-top: 1px solid var(--border);
    background: var(--bg-raised);
    color: var(--accent);
    cursor: pointer;
  }

  .more:hover {
    background: var(--accent-subtle);
  }
</style>
