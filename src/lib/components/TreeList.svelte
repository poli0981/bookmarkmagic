<script lang="ts">
  /**
   * The `role="tree"` container and its rows — docs/06 §3.3.
   *
   * Split out of `EditTab` so the ARIA structure lives in one place rather than
   * inside a component that also owns loading, searching, mutation and five
   * dialogs. The WAI-ARIA tree pattern is exacting — roving focus expressed
   * through `aria-activedescendant`, `aria-level` starting at 1, `aria-expanded`
   * present only on expandable rows — and it is easier to keep right when it is
   * not surrounded by unrelated state.
   *
   * The keydown handler lives on this `<ul>`, not on a wrapper: a keydown
   * handler on a non-focusable container never fires, and svelte-check flags it.
   */
  import type { EditNode } from '../edit/patch-tree';
  import type { VisibleRow } from '../edit/tree-keyboard';
  import { t } from '../i18n/index.svelte';
  import TreeRow from './TreeRow.svelte';

  interface Props {
    rows: readonly VisibleRow[];
    focusedId: string | undefined;
    renamingId: string | undefined;
    /** Ids matching the current search, highlighted rather than filtered. */
    matched: ReadonlySet<string>;
    /** True while a search is narrowing the tree — picks the empty message. */
    filtering: boolean;
    draggingId: string | undefined;
    editable: (node: EditNode) => boolean;
    canDropInto: (id: string) => boolean;
    element?: HTMLElement | undefined;
    onkeydown: (event: KeyboardEvent) => void;
    ontoggle: (id: string) => void;
    onfocusRow: (id: string) => void;
    onstartRename: (id: string) => void;
    onrename: (id: string, title: string) => void;
    oncancelRename: () => void;
    ondelete: (node: EditNode) => void;
    onopen: (node: EditNode) => void;
    oncopyUrl: (node: EditNode) => void;
    onmoveTo: (node: EditNode) => void;
    ondragstart: (id: string) => void;
    ondropinto: (id: string) => void;
  }

  let {
    rows,
    focusedId,
    renamingId,
    matched,
    filtering,
    draggingId,
    editable,
    canDropInto,
    element = $bindable(),
    onkeydown,
    ontoggle,
    onfocusRow,
    onstartRename,
    onrename,
    oncancelRename,
    ondelete,
    onopen,
    oncopyUrl,
    onmoveTo,
    ondragstart,
    ondropinto,
  }: Props = $props();
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<ul
  bind:this={element}
  class="tree"
  role="tree"
  aria-label={t('common.edit')}
  tabindex="0"
  aria-activedescendant={focusedId === undefined ? undefined : `node-${focusedId}`}
  {onkeydown}
>
  {#each rows as row (row.node.id)}
    <li
      id="node-{row.node.id}"
      data-node-id={row.node.id}
      role="treeitem"
      aria-level={row.depth}
      aria-expanded={row.expandable ? row.expanded : undefined}
      aria-selected={focusedId === row.node.id}
    >
      <TreeRow
        node={row.node}
        depth={row.depth}
        expandable={row.expandable}
        expanded={row.expanded}
        focused={focusedId === row.node.id}
        matched={matched.has(row.node.id)}
        renaming={renamingId === row.node.id}
        ontoggle={() => ontoggle(row.node.id)}
        onfocus={() => onfocusRow(row.node.id)}
        onstartRename={() => onstartRename(row.node.id)}
        onrename={(title) => onrename(row.node.id, title)}
        {oncancelRename}
        ondelete={() => ondelete(row.node)}
        onopen={() => onopen(row.node)}
        oncopyUrl={() => oncopyUrl(row.node)}
        onmoveTo={() => onmoveTo(row.node)}
        ondragstart={() => ondragstart(row.node.id)}
        ondropinto={() => ondropinto(row.node.id)}
        dropTarget={draggingId !== undefined && canDropInto(row.node.id)}
        draggable={editable(row.node)}
        editable={editable(row.node)}
      />
    </li>
  {/each}

  {#if rows.length === 0}
    <li class="empty">{filtering ? t('edit.noMatches') : t('edit.empty')}</li>
  {/if}
</ul>

<style>
  .tree {
    list-style: none;
    margin: 0;
    padding: var(--sp-2);
    font-size: var(--fs-1);
    max-height: 560px;
    overflow: auto;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
  }

  .tree:focus-visible {
    outline: 2px solid var(--accent);
  }

  .empty {
    color: var(--fg-muted);
    padding: var(--sp-4);
    text-align: center;
  }
</style>
