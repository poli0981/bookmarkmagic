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
   * Rendering is bounded (docs/05 §9): a window of 500 rows that always holds
   * the focused one, with "Show earlier" / "Show more" around it. 1.0.x
   * rendered every visible row in one pass, so "Expand all" on a large profile
   * froze the tab; 1.1.0's first cut grew a prefix from row 0, so End did the
   * same (`edit/row-window.ts`).
   */
  import { untrack } from 'svelte';
  import type { EditNode } from '../edit/patch-tree';
  import {
    follow,
    INITIAL_WINDOW,
    mounted,
    type RowWindow,
    showEarlier,
    showLater,
    WINDOW,
  } from '../edit/row-window';
  import { num, t, tPlural } from '../i18n/index.svelte';
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

  let win = $state<RowWindow>(INITIAL_WINDOW);

  const rows = $derived(session.rows);
  const focusIndex = $derived(rows.findIndex((row) => row.node.id === session.focusedId));
  // Derived, not written back by an effect: the active descendant must be in
  // the DOM in the same render that focuses it, or the screen reader and the
  // scroll-into-view both lose it.
  const range = $derived(mounted(follow(win, focusIndex, rows.length), rows.length));
  const shown = $derived(rows.slice(range.from, range.to));
  const later = $derived(rows.length - range.to);

  // A focused row that left the screen (collapsed, moved, filtered out,
  // deleted elsewhere) hands focus to its nearest visible folder, and a
  // rename whose row is hidden is dropped.
  $effect(() => {
    void rows;
    void session.focusedId;
    void session.renamingId;
    untrack(() => session.repairFocus());
  });

  // Keep the focused row on screen — the tree is a fixed-height scroller.
  // Tracks the focus alone: following every tree change would yank the view
  // back to the focus each time a live event landed while the user scrolled.
  $effect(() => {
    const id = session.focusedId;
    if (id === undefined || element === undefined) return;
    untrack(() =>
      element?.querySelector(`[data-node-id="${CSS.escape(id)}"]`)?.scrollIntoView({ block: 'nearest' }),
    );
  });

  function grow(next: (current: RowWindow, total: number) => RowWindow): void {
    win = next(follow(win, focusIndex, rows.length), rows.length);
  }

  /** Tabbing in with nothing focused focuses the first row, so arrows work at once (uL6). */
  function onFocus(): void {
    if (session.focusedId === undefined) session.focusedId = rows[0]?.node.id;
  }
</script>

<div class="frame">
  {#if range.from > 0}
    <button class="more" onclick={() => grow(showEarlier)}>
      {tPlural('edit.showEarlier', Math.min(range.from, WINDOW))}
    </button>
  {/if}
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

  {#if later > 0}
    <button class="more" onclick={() => grow(showLater)}>
      {tPlural('edit.showMore', Math.min(later, WINDOW), { total: num(later) })}
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
    border-block: 1px solid var(--border);
    background: var(--bg-raised);
    color: var(--accent);
    cursor: pointer;
  }

  .more:hover {
    background: var(--accent-subtle);
  }
</style>
