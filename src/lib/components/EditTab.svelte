<script lang="ts">
  /**
   * The #edit tab — docs/03 §3, docs/06 §3.3. Markup and wiring only: state
   * and commands live in `stores/edit-session.svelte.ts`, live events in
   * `edit/live-sync.ts`.
   */
  import { onMount, untrack } from 'svelte';
  import { subscribe } from '../browser/bookmarks';
  import { copyToClipboard } from '../browser/clipboard';
  import { openBookmarkUrl } from '../browser/open-url';
  import { countDescendants, displayTitle, toEditNode } from '../edit/edit-node';
  import { createBatcher } from '../edit/live-sync';
  import { moveTargets } from '../edit/move-target';
  import { type EditNode, findNode } from '../edit/patch-tree';
  import { onTreeKey } from '../edit/tree-keys';
  import { getLocale, num, t, tPlural } from '../i18n/index.svelte';
  import { EditSession } from '../stores/edit-session.svelte';
  import { pushToast } from '../stores/toast.svelte';
  import ConfirmDialog from './ConfirmDialog.svelte';
  import DuplicatePanel from './DuplicatePanel.svelte';
  import EditToolbar from './EditToolbar.svelte';
  import ErrorCallout from './ErrorCallout.svelte';
  import MoveToDialog from './MoveToDialog.svelte';
  import TreeList from './TreeList.svelte';

  const session = new EditSession(undefined, getLocale);
  let searchInput = $state<HTMLInputElement | undefined>();
  let treeEl = $state<HTMLElement | undefined>();

  onMount(() => {
    void session.load();
    // One patch per frame, and a single re-read for bursts — an import in
    // another tab sends an event per node (docs/03 §3 "Live sync").
    const batcher = createBatcher({
      onFlush: session.applyLiveEvents,
      onBurst: () => void session.load(),
    });
    let importing = false;
    // Listeners attach on enter and detach on leave: a tab left subscribed
    // during an import would take one event per created node.
    const unsubscribe = subscribe({
      onCreated: (_id, node) => {
        if (importing || node.parentId === undefined) return;
        batcher.push({ kind: 'created', parentId: node.parentId, index: node.index, node: toEditNode(node) });
      },
      onRemoved: (id) => batcher.push({ kind: 'removed', id }),
      onChanged: (id, changes) => batcher.push({ kind: 'changed', id, changes }),
      onMoved: (id, info) => batcher.push({ kind: 'moved', id, ...info }),
      onChildrenReordered: () => batcher.resync(),
      onImportBegan: () => {
        importing = true;
      },
      onImportEnded: () => {
        importing = false;
        batcher.resync();
      },
    });
    globalThis.addEventListener('keydown', onWindowKeydown);
    return () => {
      unsubscribe();
      batcher.dispose();
      session.dispose();
      globalThis.removeEventListener('keydown', onWindowKeydown);
    };
  });

  // Search-opened folders are merged INTO `expanded`. Tracks the search only:
  // `expanded` is written inside, and tracking it made a collapsed
  // search-opened folder re-open immediately.
  $effect(() => {
    const wanted = session.search.expand;
    const active = session.filtering;
    untrack(() => session.syncSearchExpansion(wanted, active));
  });

  const focusedNode = $derived(findNode(session.roots, session.focusedId ?? ''));
  /** The folder the toolbar's Sort acts on: the focused folder, else the focused row's parent. */
  const sortFolder = $derived.by(() => {
    const node = focusedNode;
    if (node === undefined) return undefined;
    return node.url === undefined ? node : findNode(session.roots, node.parentId ?? '');
  });
  // Only while the dialog is open: it walks every folder in the tree.
  const targets = $derived(
    session.movingNode === undefined ? [] : moveTargets(session.roots, session.movingNode),
  );
  const descendantCount = $derived(countDescendants(session.pendingDelete));
  const pendingTitle = $derived(displayTitle(session.pendingDelete, t('edit.untitled')));

  const partialNote = $derived.by(() => {
    const partial = session.actionError?.partial;
    if (partial === undefined) return undefined;
    const key = partial.kind === 'sort' ? 'edit.sortPartial' : 'edit.keepFirstPartial';
    return t(key, { done: num(partial.done), total: num(partial.total) });
  });

  function sort(folder: EditNode | undefined): void {
    if (folder === undefined || session.busy) return;
    if (!session.requestSort(folder)) pushToast(t('edit.alreadySorted'), 'info');
  }

  /** Opening a refused scheme says so, instead of looking like a broken button (docs/09 T3). */
  async function open(node: EditNode): Promise<void> {
    if (node.url === undefined || node.url === '') return;
    if (!(await openBookmarkUrl(node.url))) pushToast(t('edit.unsafeUrl'), 'danger');
  }

  /** docs/06 §3.3's "Copy URL". Write-only, on an explicit action (docs/09 T8). */
  async function copy(node: EditNode): Promise<void> {
    if (node.url === undefined || node.url === '') return;
    const copied = await copyToClipboard(node.url);
    pushToast(t(copied ? 'edit.copied' : 'edit.copyFailed'), copied ? 'success' : 'danger');
  }

  function onKeydown(event: KeyboardEvent): void {
    onTreeKey(event, session, {
      open: (node) => void open(node),
      copy: (node) => void copy(node),
      scroll: scrollFocusedIntoView,
    });
  }

  /** Keep the focused row on screen — the tree is a fixed-height scroller. */
  function scrollFocusedIntoView(): void {
    const id = session.focusedId;
    if (treeEl === undefined || id === undefined) return;
    queueMicrotask(() => {
      treeEl?.querySelector(`[data-node-id="${CSS.escape(id)}"]`)?.scrollIntoView({ block: 'nearest' });
    });
  }

  /** ⌘/Ctrl-F focuses the search box, whatever the case of the F (docs/06 §3.3). */
  function onWindowKeydown(event: KeyboardEvent): void {
    if (event.key.toLowerCase() !== 'f' || !(event.ctrlKey || event.metaKey)) return;
    event.preventDefault();
    searchInput?.focus();
    searchInput?.select();
  }

  /** Focus follows a delete to the next row, not into the void (uM4). */
  async function confirmDelete(): Promise<void> {
    if (await session.confirmDelete()) treeEl?.focus();
  }
</script>

{#if session.loadError !== undefined}
  <ErrorCallout messageKey={session.loadError.messageKey} detail={session.loadError.detail} />
{:else}
  <EditToolbar
    bind:input={searchInput}
    query={session.query}
    busy={session.busy}
    duplicatesOpen={session.showDuplicates}
    canSort={sortFolder !== undefined && session.canSort(sortFolder)}
    onquery={session.setQuery}
    onnewFolder={() => void session.newFolder(t('edit.newFolderTitle'))}
    onsort={() => sort(sortFolder)}
    ontoggleDuplicates={() => (session.showDuplicates = !session.showDuplicates)}
    onexpandAll={session.expandAll}
    oncollapseAll={session.collapseAll}
  />

  {#if session.actionError !== undefined}
    <ErrorCallout
      messageKey={session.actionError.messageKey}
      detail={session.actionError.detail}
      note={partialNote}
    />
  {/if}

  <div class="split" class:with-panel={session.showDuplicates}>
    <TreeList
      bind:element={treeEl}
      {session}
      onkeydown={onKeydown}
      onopen={(node) => void open(node)}
      oncopy={(node) => void copy(node)}
      onsort={sort}
    />

    {#if session.showDuplicates}
      <DuplicatePanel
        groups={session.duplicateGroups}
        roots={session.roots}
        busy={session.busy}
        onclose={() => (session.showDuplicates = false)}
        ondelete={(node) => session.requestDelete(node, false)}
        onkeepFirst={() => (session.pendingKeepFirst = true)}
      />
    {/if}
  </div>
{/if}

<MoveToDialog
  node={session.movingNode}
  {targets}
  onpick={(parentId) => {
    const id = session.movingNode?.id;
    session.movingNode = undefined;
    if (id !== undefined) void session.moveTo(id, { parentId });
  }}
  oncancel={() => (session.movingNode = undefined)}
/>

<ConfirmDialog
  open={session.pendingDelete !== undefined}
  danger
  title={t('edit.deleteTitle')}
  body={descendantCount > 0
    ? tPlural('edit.deleteFolderBody', descendantCount, { title: pendingTitle })
    : t('edit.deleteBody', { title: pendingTitle })}
  confirmLabel={t('edit.delete')}
  cancelLabel={t('common.cancel')}
  onconfirm={() => void confirmDelete()}
  oncancel={() => (session.pendingDelete = undefined)}
/>

<ConfirmDialog
  open={session.pendingKeepFirst}
  danger
  title={t('edit.keepFirstTitle')}
  body={tPlural(
    'edit.keepFirstBody',
    session.duplicateGroups.reduce((n, g) => n + g.nodes.length - 1, 0),
  )}
  confirmLabel={t('edit.delete')}
  cancelLabel={t('common.cancel')}
  onconfirm={() => void session.keepFirst()}
  oncancel={() => (session.pendingKeepFirst = false)}
/>

<ConfirmDialog
  open={session.pendingSort !== undefined}
  title={t('edit.sortTitle', { title: displayTitle(session.pendingSort?.folder, t('edit.untitled')) })}
  body={tPlural('edit.sortBody', session.pendingSort?.moves.length ?? 0)}
  confirmLabel={t('edit.sort')}
  cancelLabel={t('common.cancel')}
  onconfirm={() => void session.confirmSort()}
  oncancel={() => (session.pendingSort = undefined)}
/>

<style>
  .split {
    display: grid;
    grid-template-columns: 1fr;
    gap: var(--sp-4);
    align-items: start;
  }

  .with-panel {
    grid-template-columns: 1fr var(--width-side);
  }

  @media (max-width: 820px) {
    .with-panel {
      grid-template-columns: 1fr;
    }
  }
</style>
