<script lang="ts">
  import { isBlockedUrl } from '../browser/open-url';
  import { type DropZone, planDrop, zoneFor } from '../edit/move-target';
  import { hostOf } from '../edit/edit-node';
  import type { EditNode } from '../edit/patch-tree';
  import type { VisibleRow } from '../edit/tree-keyboard';
  import { t } from '../i18n/index.svelte';
  import type { EditSession } from '../stores/edit-session.svelte';
  import Icon from './icons/Icon.svelte';
  import RenameInput from './RenameInput.svelte';
  import RowActions from './RowActions.svelte';

  interface Props {
    row: VisibleRow;
    session: EditSession;
    onopen: (node: EditNode) => void;
    oncopy: (node: EditNode) => void;
    onsort: (node: EditNode) => void;
  }

  let { row, session, onopen, oncopy, onsort }: Props = $props();

  const node = $derived(row.node);
  const isFolder = $derived(node.url === undefined);
  const editable = $derived(session.isEditable(node));
  const focused = $derived(session.focusedId === node.id);
  const renaming = $derived(session.renamingId === node.id && editable);
  const domain = $derived(hostOf(node.url));
  const blocked = $derived(!isFolder && isBlockedUrl(node.url));

  /** Which part of this row a drag is over, when the drop there is legal. */
  let zone = $state<DropZone | undefined>();

  type RowDragEvent = DragEvent & { currentTarget: EventTarget & HTMLDivElement };

  function zoneAt(event: RowDragEvent): DropZone {
    const box = event.currentTarget.getBoundingClientRect();
    return zoneFor((event.clientY - box.top) / box.height, isFolder);
  }

  function onDragOver(event: RowDragEvent): void {
    const dragging = session.draggingId;
    if (dragging === undefined) return;
    const at = zoneAt(event);
    if (planDrop(session.roots, dragging, node.id, at) === undefined) {
      zone = undefined;
      return;
    }
    // preventDefault is what marks this as a valid drop target.
    event.preventDefault();
    zone = at;
  }
</script>

<!-- The row is presentation inside its `treeitem`: keyboard input goes to the
     tree (aria-activedescendant), and the buttons below are mouse shortcuts
     with keyboard equivalents — so none of them is a tab stop. -->
<div
  class="row"
  class:focused
  class:matched={session.search.matched.has(node.id)}
  class:dragging={session.draggingId === node.id}
  class:drop-before={zone === 'before'}
  class:drop-after={zone === 'after'}
  class:drop-into={zone === 'into'}
  style:--depth={row.depth - 1}
  onclick={() => (session.focusedId = node.id)}
  ondblclick={() => (isFolder ? session.toggle(node.id) : onopen(node))}
  onkeydown={() => {}}
  role="presentation"
  draggable={editable && !renaming && !session.busy}
  ondragstart={(event) => {
    event.dataTransfer?.setData('text/plain', node.id);
    if (event.dataTransfer !== null) event.dataTransfer.effectAllowed = 'move';
    session.draggingId = node.id;
  }}
  ondragend={() => {
    // Fires on every drag end — dropped, cancelled with Esc, or released
    // outside the tree. Without it a cancelled drag left every row lit up.
    session.draggingId = undefined;
    zone = undefined;
  }}
  ondragover={onDragOver}
  ondragleave={() => (zone = undefined)}
  ondrop={(event) => {
    event.preventDefault();
    const at = zone;
    zone = undefined;
    if (at !== undefined) void session.drop(node.id, at);
  }}
>
  {#if row.expandable}
    <button
      class="disclosure"
      tabindex="-1"
      aria-hidden="true"
      onclick={(event) => {
        // The row under it must not also take the click.
        event.stopPropagation();
        session.toggle(node.id);
      }}
    >
      <Icon name="chevron" size={12} turned={row.expanded} />
    </button>
  {:else}
    <span class="disclosure" aria-hidden="true"></span>
  {/if}

  <span class="glyph" class:folder={isFolder}>
    {#if node.unmodifiable !== undefined}
      <Icon name="lock" size={14} />
    {:else if isFolder}
      <Icon name={row.expandable && row.expanded ? 'folder-open' : 'folder'} size={14} />
    {:else}
      <Icon name="link" size={14} />
    {/if}
  </span>

  {#if renaming}
    <RenameInput {node} {session} />
  {:else}
    <span class="title" class:untitled={node.title === ''}>{node.title === '' ? (node.url ?? '') : node.title}</span>
    {#if domain !== ''}<span class="domain">{domain}</span>{/if}
    {#if isFolder}<span class="count">{node.children?.length ?? 0}</span>{/if}
    {#if blocked}
      <!-- docs/09 T3: a javascript:/data: bookmark must not look like an
           ordinary link that merely does nothing when clicked. -->
      <span class="unsafe" title={t('edit.unsafeUrl')}>
        <Icon name="warning" size={13} /><span class="sr-only">{t('edit.unsafeUrl')}</span>
      </span>
    {/if}

    <RowActions {node} {session} {editable} {onopen} {oncopy} {onsort} />
  {/if}
</div>

<style>
  .row {
    position: relative;
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    min-height: 28px;
    padding-block: 2px;
    padding-left: calc(var(--depth) * 18px + var(--sp-1));
    padding-right: var(--sp-2);
    border-radius: var(--radius-sm);
    cursor: default;
    user-select: none;
  }

  /* Indent rails: one faint line per ancestor level. */
  .row::before {
    content: '';
    position: absolute;
    inset-block: 0;
    left: var(--sp-1);
    width: calc(var(--depth) * 18px);
    background-image: linear-gradient(90deg, var(--border) 1px, transparent 1px);
    background-size: 18px 100%;
    background-position: 8px 0;
    pointer-events: none;
  }

  .row:hover {
    background: var(--bg-raised);
  }

  .focused {
    background: var(--accent-subtle);
    box-shadow: inset 2px 0 0 var(--accent);
  }

  .dragging {
    color: var(--fg-muted);
  }

  .drop-into {
    outline: 1px dashed var(--accent);
    outline-offset: -1px;
    background: var(--accent-subtle);
  }

  .drop-before {
    box-shadow: inset 0 2px 0 var(--accent);
  }

  .drop-after {
    box-shadow: inset 0 -2px 0 var(--accent);
  }

  .matched .title {
    color: var(--accent);
    font-weight: 600;
  }

  .disclosure {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    flex: none;
    background: none;
    border: none;
    color: var(--fg-muted);
    cursor: pointer;
    padding: 0;
  }

  .glyph {
    display: inline-flex;
    color: var(--fg-muted);
  }

  .glyph.folder {
    color: var(--accent);
  }

  /* The title keeps its room; the domain gives way first (at 375 px the title
     shrank to "D…" while the domain beside it stayed whole — v1.1.0 review). */
  .title {
    flex: 0 1 auto;
    min-width: 3ch;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .untitled {
    font-family: var(--font-mono);
    font-size: var(--fs-0);
    color: var(--fg-muted);
  }

  .domain,
  .count {
    font-family: var(--font-mono);
    font-size: var(--fs-0);
    color: var(--fg-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Basis 0: the domain only ever takes the room the title leaves, so it is
     gone before the title loses a single character. */
  .domain {
    flex: 1 1 0;
    min-width: 0;
  }

  .count {
    flex: none;
    padding: 0 5px;
    border: 1px solid var(--border);
    border-radius: 999px;
  }

  .unsafe {
    display: inline-flex;
    flex: none;
    color: var(--warn);
    cursor: help;
  }

  /* The buttons live in RowActions; showing them is the row's business. */
  .row :global(.actions) {
    visibility: hidden;
  }

  .row:hover :global(.actions),
  .focused :global(.actions) {
    visibility: visible;
  }
</style>
