<script lang="ts">
  import { onMount } from 'svelte';
  import {
    create,
    getRootChildren,
    move,
    remove,
    removeTree,
    subscribe,
    update,
  } from '../browser/bookmarks';
  import { BmBrowserError } from '../browser/errors';
  import { openBookmarkUrl } from '../browser/open-url';
  import { findDuplicateGroups } from '../core/dedupe';
  import { searchTree } from '../core/search';
  import {
    countDescendants,
    extraCopyIds,
    flattenTree,
    isEditable as canEdit,
    resolveNewFolderParent,
    toEditNode,
  } from '../edit/edit-node';
  import {
    changeNode,
    type EditNode,
    findNode,
    insertNode,
    moveNode,
    removeNode,
  } from '../edit/patch-tree';
  import { canMoveInto, moveTargets } from '../edit/move-target';
  import { resolveKey, visibleRows } from '../edit/tree-keyboard';
  import { num, t } from '../i18n/index.svelte';
  import Callout from './Callout.svelte';
  import ConfirmDialog from './ConfirmDialog.svelte';
  import DuplicatePanel from './DuplicatePanel.svelte';
  import EditToolbar from './EditToolbar.svelte';
  import MoveToDialog from './MoveToDialog.svelte';
  import TreeRow from './TreeRow.svelte';

  let roots = $state<EditNode[]>([]);
  let expanded = $state<Set<string>>(new Set());
  let focusedId = $state<string | undefined>();
  let renamingId = $state<string | undefined>();
  let query = $state('');
  let debounced = $state('');
  let showDuplicates = $state(false);
  let loadError = $state<string | undefined>();
  let pendingDelete = $state<EditNode | undefined>();
  let pendingKeepFirst = $state(false);
  let draggingId = $state<string | undefined>();
  let movingNode = $state<EditNode | undefined>();
  /** Per-operation failure, shown ABOVE the tree rather than replacing it. */
  let actionError = $state<{ message: string; detail: string | undefined } | undefined>();
  let searchInput = $state<HTMLInputElement | undefined>();
  let treeEl = $state<HTMLElement | undefined>();

  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  onMount(() => {
    void load();
    // Listeners attach on enter and detach on leave (docs/03 §3) — a tab left
    // subscribed during an import would take one event per created node.
    const unsubscribe = subscribe({
      onCreated: (_id, node) => {
        if (node.parentId !== undefined) {
          roots = insertNode(roots, node.parentId, node.index, toEditNode(node));
        }
      },
      onRemoved: (id) => {
        roots = removeNode(roots, id);
      },
      onChanged: (id, changes) => {
        roots = changeNode(roots, id, changes);
      },
      onMoved: (id, info) => {
        roots = moveNode(roots, id, info.parentId, info.index);
      },
    });
    globalThis.addEventListener('keydown', onWindowKeydown);
    return () => {
      unsubscribe();
      globalThis.removeEventListener('keydown', onWindowKeydown);
      if (debounceTimer !== undefined) clearTimeout(debounceTimer);
    };
  });

  /** Bound to the current tree, so callers pass only the node. */
  const isEditable = (node: EditNode): boolean => canEdit(roots, node);

  async function load(): Promise<void> {
    try {
      roots = (await getRootChildren()).map(toEditNode);
      expanded = new Set(roots.map((root) => root.id));
    } catch (err) {
      loadError = err instanceof BmBrowserError ? err.detail : t('errors.UNKNOWN');
    }
  }

  function onQuery(value: string): void {
    query = value;
    if (debounceTimer !== undefined) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounced = value;
    }, 150);
  }

  const search = $derived(searchTree(roots, debounced));
  const filtering = $derived(debounced.trim() !== '');

  // Search-opened ancestors are merged INTO `expanded` rather than unioned at
  // render time. Reading from a union that toggle() cannot write to made the
  // disclosure button and ArrowLeft dead keys on every search-expanded folder.
  $effect(() => {
    if (search.expand.size === 0) return;
    const missing = [...search.expand].filter((id) => !expanded.has(id));
    if (missing.length > 0) expanded = new Set([...expanded, ...missing]);
  });

  const rows = $derived(visibleRows(roots, expanded, filtering ? search.visible : undefined));

  const duplicateGroups = $derived(
    findDuplicateGroups(flattenTree(roots).filter((node) => node.url !== undefined)),
  );

  /**
   * Run a mutation, and on failure resync from the browser — the only source of
   * truth. A snapshot restore would resurrect rows that earlier iterations of a
   * bulk operation legitimately deleted.
   */
  async function guardEdit(run: () => Promise<void>): Promise<void> {
    actionError = undefined;
    try {
      await run();
    } catch (err) {
      actionError =
        err instanceof BmBrowserError
          ? { message: t('errors.BROWSER'), detail: err.detail }
          : { message: t('errors.UNKNOWN'), detail: err instanceof Error ? err.message : undefined };
      await load();
    }
  }

  function toggle(id: string): void {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    expanded = next;
  }

  function onKeydown(event: KeyboardEvent): void {
    if (renamingId !== undefined) return;
    // Keys aimed at a row's own button (or the rename input) belong to that
    // control — stealing them cancelled the button's activation.
    if (event.target !== event.currentTarget) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    const action = resolveKey(event.key, focusedId, rows);
    if (action.kind === 'none') return;
    event.preventDefault();

    switch (action.kind) {
      case 'focus':
        focusedId = action.id;
        scrollFocusedIntoView();
        break;
      case 'expand':
      case 'collapse':
        toggle(action.id);
        break;
      case 'rename': {
        const node = findNode(roots, action.id);
        if (node !== undefined && isEditable(node)) renamingId = action.id;
        break;
      }
      case 'delete': {
        const node = findNode(roots, action.id);
        if (node !== undefined && isEditable(node)) pendingDelete = node;
        break;
      }
      case 'activate': {
        const node = findNode(roots, action.id);
        if (node?.url !== undefined) void openBookmarkUrl(node.url);
        else if (node !== undefined) toggle(node.id);
        break;
      }
    }
  }

  async function commitRename(id: string, title: string): Promise<void> {
    renamingId = undefined;
    const node = findNode(roots, id);
    if (node === undefined || !isEditable(node)) return;
    if (node.title === title || title.trim() === '') return;
    await guardEdit(async () => {
      // Optimistic: the onChanged event confirms it, guardEdit resyncs on failure.
      roots = changeNode(roots, id, { title });
      await update(id, { title });
    });
  }

  async function confirmDelete(): Promise<void> {
    const node = pendingDelete;
    pendingDelete = undefined;
    if (node === undefined || !isEditable(node)) return;
    await guardEdit(async () => {
      roots = removeNode(roots, node.id);
      if (node.url === undefined) await removeTree(node.id);
      else await remove(node.id);
    });
  }

  async function newFolder(): Promise<void> {
    const parentId = resolveNewFolderParent(roots, findNode(roots, focusedId ?? ''));
    if (parentId === undefined) return;

    await guardEdit(async () => {
      const created = await create({ parentId, title: t('edit.newFolderTitle') });
      // The row must be rendered before the inline rename input can mount —
      // otherwise renamingId locks every tree key with nothing to type into.
      expanded = new Set([...expanded, parentId]);
      focusedId = created.id;
      renamingId = created.id;
    });
  }

  async function keepFirstInEachGroup(): Promise<void> {
    pendingKeepFirst = false;
    // Snapshot the ids first: duplicateGroups is $derived from `roots`, so
    // reading it inside the loop would recompute mid-iteration.
    const doomed = extraCopyIds(duplicateGroups);
    await guardEdit(async () => {
      for (const id of doomed) {
        roots = removeNode(roots, id);
        await remove(id);
      }
    });
  }

  /** Shared by the drag path and the keyboard "Move to…" path. */
  async function moveInto(id: string, parentId: string): Promise<void> {
    const node = findNode(roots, id);
    if (node === undefined || !isEditable(node)) return;
    if (!canMoveInto(roots, id, parentId)) return;
    await guardEdit(async () => {
      roots = moveNode(roots, id, parentId, undefined);
      await move(id, { parentId });
    });
  }

  function onDrop(targetId: string): void {
    const id = draggingId;
    draggingId = undefined;
    if (id !== undefined) void moveInto(id, targetId);
  }

  const targets = $derived(moveTargets(roots, movingNode));

  /** Keep the focused row on screen — the tree is a fixed-height scroller. */
  function scrollFocusedIntoView(): void {
    if (treeEl === undefined || focusedId === undefined) return;
    queueMicrotask(() => {
      treeEl
        ?.querySelector(`[data-node-id="${CSS.escape(focusedId ?? '')}"]`)
        ?.scrollIntoView({ block: 'nearest' });
    });
  }

  /** ⌘/Ctrl-F focuses the search box — docs/06 §3.3. */
  function onWindowKeydown(event: KeyboardEvent): void {
    if (event.key !== 'f' || !(event.ctrlKey || event.metaKey)) return;
    event.preventDefault();
    searchInput?.focus();
    searchInput?.select();
  }

  const descendantCount = $derived(countDescendants(pendingDelete));
</script>

{#if loadError !== undefined}
  <Callout tone="danger">{loadError}</Callout>
{:else}
  <EditToolbar
    bind:input={searchInput}
    {query}
    onquery={onQuery}
    onnewFolder={() => void newFolder()}
    ontoggleDuplicates={() => (showDuplicates = !showDuplicates)}
    onexpandAll={() => (expanded = new Set(flattenTree(roots).map((node) => node.id)))}
    oncollapseAll={() => (expanded = new Set())}
  />

  {#if actionError !== undefined}
    <div class="action-error">
      <Callout tone="danger">{actionError.message}</Callout>
      {#if actionError.detail !== undefined}
        <pre>{actionError.detail}</pre>
      {/if}
    </div>
  {/if}

  <div class="split" class:with-panel={showDuplicates}>
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <ul
      bind:this={treeEl}
      class="tree"
      role="tree"
      aria-label={t('common.edit')}
      tabindex="0"
      aria-activedescendant={focusedId === undefined ? undefined : `node-${focusedId}`}
      onkeydown={onKeydown}
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
            matched={search.matched.has(row.node.id)}
            renaming={renamingId === row.node.id}
            ontoggle={() => toggle(row.node.id)}
            onfocus={() => (focusedId = row.node.id)}
            onstartRename={() => (renamingId = row.node.id)}
            onrename={(title) => void commitRename(row.node.id, title)}
            oncancelRename={() => (renamingId = undefined)}
            ondelete={() => (pendingDelete = row.node)}
            onopen={() => void openBookmarkUrl(row.node.url ?? '')}
            onmoveTo={() => (movingNode = row.node)}
            ondragstart={() => (draggingId = row.node.id)}
            ondropinto={() => onDrop(row.node.id)}
            dropTarget={draggingId !== undefined &&
              canMoveInto(roots, draggingId, row.node.id)}
            draggable={isEditable(row.node)}
            editable={isEditable(row.node)}
          />
        </li>
      {/each}

      {#if rows.length === 0}
        <li class="empty">{filtering ? t('edit.noMatches') : t('edit.empty')}</li>
      {/if}
    </ul>

    {#if showDuplicates}
      <DuplicatePanel
        groups={duplicateGroups}
        onclose={() => (showDuplicates = false)}
        ondelete={(node) => (pendingDelete = node)}
        onkeepFirst={() => (pendingKeepFirst = true)}
      />
    {/if}
  </div>
{/if}

{#if movingNode !== undefined}
  <MoveToDialog
    node={movingNode}
    {targets}
    onpick={(parentId) => {
      const id = movingNode?.id;
      movingNode = undefined;
      if (id !== undefined) void moveInto(id, parentId);
    }}
    oncancel={() => (movingNode = undefined)}
  />
{/if}

<ConfirmDialog
  open={pendingDelete !== undefined}
  danger
  title={t('edit.deleteTitle')}
  body={descendantCount > 0
    ? t('edit.deleteFolderBody', { title: pendingDelete?.title ?? '', n: num(descendantCount) })
    : t('edit.deleteBody', { title: pendingDelete?.title ?? '' })}
  confirmLabel={t('edit.delete')}
  cancelLabel={t('common.cancel')}
  onconfirm={() => void confirmDelete()}
  oncancel={() => (pendingDelete = undefined)}
/>

<ConfirmDialog
  open={pendingKeepFirst}
  danger
  title={t('edit.keepFirstTitle')}
  body={t('edit.keepFirstBody', {
    n: num(duplicateGroups.reduce((n, g) => n + g.nodes.length - 1, 0)),
  })}
  confirmLabel={t('edit.delete')}
  cancelLabel={t('common.cancel')}
  onconfirm={() => void keepFirstInEachGroup()}
  oncancel={() => (pendingKeepFirst = false)}
/>

<style>
  .split {
    display: grid;
    grid-template-columns: 1fr;
    gap: var(--sp-4);
    align-items: start;
  }

  .with-panel {
    grid-template-columns: 1fr 340px;
  }

  @media (max-width: 780px) {
    .with-panel {
      grid-template-columns: 1fr;
    }
  }

  .tree {
    list-style: none;
    margin: 0;
    padding: 0;
    font-size: var(--fs-1);
    max-height: 560px;
    overflow: auto;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: var(--sp-2);
  }

  .tree:focus-visible {
    outline: 2px solid var(--accent);
  }

  .action-error {
    margin-bottom: var(--sp-3);
  }

  .action-error pre {
    margin: var(--sp-2) 0 0;
    font-size: var(--fs-0);
    background: var(--bg-raised);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: var(--sp-2);
    overflow: auto;
    user-select: all;
  }

  .empty {
    color: var(--fg-muted);
    padding: var(--sp-4);
    text-align: center;
  }

</style>
