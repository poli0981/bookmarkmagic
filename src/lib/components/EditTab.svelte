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
  import { copyToClipboard } from '../browser/clipboard';
  import { type DescribedError, describeError } from '../browser/describe-error';
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
  import { deleteEach } from '../edit/bulk-delete';
  import { canMoveInto, moveTargets } from '../edit/move-target';
  import {
    collapseSearchExpansion,
    forgetSearchExpansion,
    mergeSearchExpansion,
  } from '../edit/search-expansion';
  import { resolveKey, visibleRows } from '../edit/tree-keyboard';
  import { num, t } from '../i18n/index.svelte';
  import { pushToast } from '../stores/toast.svelte';
  import ErrorCallout from './ErrorCallout.svelte';
  import ConfirmDialog from './ConfirmDialog.svelte';
  import DuplicatePanel from './DuplicatePanel.svelte';
  import EditToolbar from './EditToolbar.svelte';
  import MoveToDialog from './MoveToDialog.svelte';
  import TreeList from './TreeList.svelte';

  let roots = $state<EditNode[]>([]);
  let expanded = $state<ReadonlySet<string>>(new Set());
  let focusedId = $state<string | undefined>();
  let renamingId = $state<string | undefined>();
  let query = $state('');
  let debounced = $state('');
  let showDuplicates = $state(false);
  let loadError = $state<DescribedError | undefined>();
  let pendingDelete = $state<EditNode | undefined>();
  let pendingKeepFirst = $state(false);
  let draggingId = $state<string | undefined>();
  let movingNode = $state<EditNode | undefined>();
  /** Per-operation failure, shown ABOVE the tree rather than replacing it. */
  let actionError = $state<
    (DescribedError & { partial?: { done: number; total: number } }) | undefined
  >();
  /** Folders the search opened, so clearing the search can close them again. */
  let searchOpened = $state<ReadonlySet<string>>(new Set());
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
      // Was `err.detail` alone: a raw English Chrome string as the entire
      // screen, in every language (docs/02 §7).
      loadError = describeError(err);
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
  //
  // The merge is remembered so it can be undone: a one-character query expands
  // most of a large tree, and clearing the box used to render every one of
  // those rows at once, in a single synchronous pass, with no virtualization.
  $effect(() => {
    if (!filtering) {
      if (searchOpened.size === 0) return;
      expanded = collapseSearchExpansion(expanded, searchOpened);
      searchOpened = new Set();
      return;
    }
    const merged = mergeSearchExpansion(expanded, search.expand, searchOpened);
    if (merged.expanded === expanded) return;
    expanded = merged.expanded;
    searchOpened = merged.opened;
  });

  const rows = $derived(visibleRows(roots, expanded, filtering ? search.visible : undefined));

  const partialNote = $derived(
    actionError?.partial === undefined
      ? undefined
      : t('edit.keepFirstPartial', {
          done: num(actionError.partial.done),
          total: num(actionError.partial.total),
        }),
  );

  // `isEditable` matters as much as the url check: without it, duplicates
  // inside a policy-managed subtree were offered for bulk deletion, and the
  // browser rejects every one of them. The single-delete path has always
  // filtered; docs/15 makes it normative that unmodifiable nodes offer no
  // destructive affordance at all.
  const duplicateGroups = $derived(
    findDuplicateGroups(
      flattenTree(roots).filter((node) => node.url !== undefined && isEditable(node)),
    ),
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
      actionError = describeError(err);
      await load();
    }
  }

  function toggle(id: string): void {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    expanded = next;
    // Touching a folder makes it the user's, so clearing the search must not
    // close it again.
    searchOpened = forgetSearchExpansion(searchOpened, id);
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
        if (node?.url !== undefined) void openUrl(node.url);
        else if (node !== undefined) toggle(node.id);
        break;
      }
    }
  }

  /**
   * Open a bookmark, saying so when the scheme is refused.
   *
   * The boolean was previously discarded with `void`, so clicking ↗ on a
   * `javascript:` bookmark did nothing at all and looked like a broken button
   * rather than a deliberate refusal (docs/09 T3).
   */
  async function openUrl(url: string): Promise<void> {
    if (url === '') return;
    if (!(await openBookmarkUrl(url))) pushToast(t('edit.unsafeUrl'), 'danger');
  }

  /** docs/06 §3.3's "Copy URL". Write-only, on an explicit click (docs/09 T8). */
  async function copyUrl(url: string): Promise<void> {
    if (url === '') return;
    const copied = await copyToClipboard(url);
    pushToast(t(copied ? 'edit.copied' : 'edit.copyFailed'), copied ? 'success' : 'danger');
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
    actionError = undefined;

    const outcome = await deleteEach(doomed, remove, (id) => {
      roots = removeNode(roots, id);
    });
    if (outcome.error === undefined) return;

    // The dialog promised an exact number. Saying only "the browser refused"
    // after deleting some of them leaves the user unable to tell how many
    // copies are left, on an action that cannot be undone.
    actionError = {
      ...describeError(outcome.error),
      partial: { done: outcome.deleted, total: outcome.total },
    };
    await load();
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
  <ErrorCallout messageKey={loadError.messageKey} detail={loadError.detail} />
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
    <ErrorCallout
      messageKey={actionError.messageKey}
      detail={actionError.detail}
      note={partialNote}
    />
  {/if}

  <div class="split" class:with-panel={showDuplicates}>
    <TreeList
      bind:element={treeEl}
      {rows}
      {focusedId}
      {renamingId}
      {filtering}
      {draggingId}
      matched={search.matched}
      editable={isEditable}
      canDropInto={(id) => draggingId !== undefined && canMoveInto(roots, draggingId, id)}
      onkeydown={onKeydown}
      ontoggle={toggle}
      onfocusRow={(id) => (focusedId = id)}
      onstartRename={(id) => (renamingId = id)}
      onrename={(id, title) => void commitRename(id, title)}
      oncancelRename={() => (renamingId = undefined)}
      ondelete={(node) => (pendingDelete = node)}
      onopen={(node) => void openUrl(node.url ?? "")}
      oncopyUrl={(node) => void copyUrl(node.url ?? "")}
      onmoveTo={(node) => (movingNode = node)}
      ondragstart={(id) => (draggingId = id)}
      ondropinto={(id) => onDrop(id)}
    />

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



</style>
