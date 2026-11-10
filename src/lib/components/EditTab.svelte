<script lang="ts">
  /**
   * The #edit tab — docs/03 §3, docs/06 §3.3. Markup and wiring only: state
   * and commands live in `stores/edit-session.svelte.ts`, live events in
   * `edit/live-sync.ts` (wired by `stores/edit-live.ts`), the dialogs' markup
   * in `EditDialogs.svelte`.
   */
  import { onMount, tick, untrack } from 'svelte';
  import { copyToClipboard } from '../browser/clipboard';
  import { openBookmarkUrl } from '../browser/open-url';
  import { displayTitle } from '../edit/edit-node';
  import { type EditNode, findNode } from '../edit/patch-tree';
  import { onTreeKey } from '../edit/tree-keys';
  import { getLocale, num, t } from '../i18n/index.svelte';
  import { connectLive } from '../stores/edit-live';
  import { EditSession } from '../stores/edit-session.svelte';
  import { pushToast } from '../stores/toast.svelte';
  import DuplicatePanel from './DuplicatePanel.svelte';
  import EditDialogs from './EditDialogs.svelte';
  import EditToolbar from './EditToolbar.svelte';
  import ErrorCallout from './ErrorCallout.svelte';
  import { focusIfLost } from './focus-heading';
  import TreeList from './TreeList.svelte';

  const session = new EditSession(undefined, getLocale);
  let searchInput = $state<HTMLInputElement | undefined>();
  let treeEl = $state<HTMLElement | undefined>();
  let panelEl = $state<HTMLElement | undefined>();
  /** What Alt+↑/↓ just did, for the live region below (docs/06 §5). */
  let announcement = $state('');

  onMount(() => {
    void session.load();
    const disconnect = connectLive(session);
    globalThis.addEventListener('keydown', onWindowKeydown);
    return () => {
      disconnect();
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

  /**
   * Alt+↑ / Alt+↓. The row's `aria-posinset` changes, but a screen reader does
   * not re-read the active descendant for that — so the new place is spoken.
   */
  async function nudge(id: string, direction: -1 | 1): Promise<void> {
    const placed = await session.nudge(id, direction);
    if (placed === undefined) return;
    // Emptied first: a region set to the text it already holds says nothing,
    // and two rows of one name can land on one position.
    announcement = '';
    await tick();
    announcement = t('edit.movedPosition', {
      title: displayTitle(findNode(session.roots, id), t('edit.untitled')),
      position: num(placed.position),
      total: num(placed.total),
    });
    await tick();
    treeEl?.querySelector(`[data-node-id="${CSS.escape(id)}"]`)?.scrollIntoView({ block: 'nearest' });
  }

  function onKeydown(event: KeyboardEvent): void {
    onTreeKey(event, session, {
      open: (node) => void open(node),
      copy: (node) => void copy(node),
      nudge: (id, direction) => void nudge(id, direction),
    });
  }

  /** ⌘/Ctrl-F focuses the search box, whatever the case of the F (docs/06 §3.3). */
  function onWindowKeydown(event: KeyboardEvent): void {
    if (event.key.toLowerCase() !== 'f' || !(event.ctrlKey || event.metaKey)) return;
    event.preventDefault();
    searchInput?.focus();
    searchInput?.select();
  }

  /**
   * Focus goes back where the delete was asked for (uM4). The dialog cannot
   * hand it back to the button that opened it — that button went with what it
   * deleted — so a panel delete lands on the next copy's button, else on the
   * panel's close button.
   */
  async function confirmDelete(): Promise<void> {
    const origin = await session.confirmDelete();
    await tick();
    if (origin === 'tree') treeEl?.focus();
    else if (origin === 'panel') {
      focusIfLost(
        panelEl?.querySelector<HTMLElement>('[data-copy-delete]') ??
          panelEl?.querySelector<HTMLElement>('[data-panel-close]'),
      );
    }
  }

  /**
   * A bulk command disables the button that started it for as long as it runs
   * (Sort A→Z), or removes it with what it deleted (keep-first), and the
   * closing dialog cannot return focus to either. Once the command is over,
   * a focus that fell to `<body>` is put somewhere deliberate.
   */
  async function afterBulk(run: Promise<void>, target: () => HTMLElement | null | undefined): Promise<void> {
    await run;
    await tick();
    focusIfLost(target());
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
        bind:element={panelEl}
        groups={session.duplicateGroups}
        roots={session.roots}
        busy={session.busy}
        onclose={() => (session.showDuplicates = false)}
        ondelete={(node) => session.requestDelete(node, 'panel')}
        onkeepFirst={() => (session.pendingKeepFirst = true)}
      />
    {/if}
  </div>
{/if}

<!-- Always in the page, and only its text changes: a region inserted already
     filled is not reliably announced (the same rule as ImportAnnouncer). -->
<p class="sr-only" role="status" aria-live="polite">{announcement}</p>

<EditDialogs
  {session}
  ondelete={() => void confirmDelete()}
  onkeepFirst={() =>
    void afterBulk(
      session.keepFirst(),
      () => panelEl?.querySelector<HTMLElement>('[data-panel-close]') ?? treeEl,
    )}
  onsort={() => void afterBulk(session.confirmSort(), () => treeEl)}
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
