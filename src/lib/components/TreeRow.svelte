<script lang="ts">
  import type { EditNode } from '../edit/patch-tree';
  import { t } from '../i18n/index.svelte';

  interface Props {
    node: EditNode;
    depth: number;
    expandable: boolean;
    expanded: boolean;
    focused: boolean;
    matched: boolean;
    renaming: boolean;
    ontoggle: () => void;
    onfocus: () => void;
    onrename: (title: string) => void;
    oncancelRename: () => void;
    onstartRename: () => void;
    ondelete: () => void;
    onopen: () => void;
    onmoveTo: () => void;
    ondragstart: () => void;
    ondropinto: () => void;
    dropTarget: boolean;
    draggable: boolean;
    /** False for permanent roots and policy-managed nodes — docs/02 §4. */
    editable: boolean;
  }

  let {
    node,
    depth,
    expandable,
    expanded,
    focused,
    matched,
    renaming,
    ontoggle,
    onfocus,
    onrename,
    oncancelRename,
    onstartRename,
    ondelete,
    onopen,
    onmoveTo,
    ondragstart,
    ondropinto,
    dropTarget,
    draggable,
    editable,
  }: Props = $props();

  const isFolder = $derived(node.url === undefined);
  const domain = $derived(hostOf(node.url));

  function hostOf(url: string | undefined): string {
    if (url === undefined) return '';
    try {
      return new URL(url).host;
    } catch {
      // javascript:, data:, malformed — show nothing rather than guessing.
      return '';
    }
  }
</script>

<div
  class="row"
  class:focused
  class:matched
  class:drop-target={dropTarget}
  style:padding-left="{(depth - 1) * 16}px"
  onclick={onfocus}
  onkeydown={() => {}}
  role="presentation"
  {draggable}
  ondragstart={(e) => {
    e.dataTransfer?.setData('text/plain', node.id);
    ondragstart();
  }}
  ondragover={(e) => {
    // Only folders accept a drop; preventDefault is what marks it as valid.
    if (isFolder) e.preventDefault();
  }}
  ondrop={(e) => {
    e.preventDefault();
    ondropinto();
  }}
>
  {#if expandable}
    <button
      class="disclosure"
      aria-label={expanded ? t('import.collapse') : t('import.expand')}
      onclick={(e) => {
        e.stopPropagation();
        ontoggle();
      }}>{expanded ? '▾' : '▸'}</button
    >
  {:else}
    <span class="disclosure" aria-hidden="true"></span>
  {/if}

  <span class="glyph" aria-hidden="true">{isFolder ? '🗀' : '🔗'}</span>

  {#if renaming && editable}
    <!-- svelte-ignore a11y_autofocus -->
    <input
      class="rename"
      value={node.title}
      autofocus
      onkeydown={(e) => {
        if (e.key === 'Enter') onrename((e.currentTarget as HTMLInputElement).value);
        if (e.key === 'Escape') oncancelRename();
        e.stopPropagation();
      }}
      onblur={(e) => onrename((e.currentTarget as HTMLInputElement).value)}
    />
  {:else}
    <span class="title">{node.title}</span>
    {#if domain !== ''}<span class="domain">{domain}</span>{/if}

    <span class="actions">
      {#if editable}
        <button
          title={t('edit.rename')}
        onclick={(e) => {
          e.stopPropagation();
          onstartRename();
          }}>✎</button
        >
      {/if}
      {#if !isFolder}
        <button
          title={t('edit.open')}
          onclick={(e) => {
            e.stopPropagation();
            onopen();
          }}>↗</button
        >
      {/if}
      {#if editable}
        <button
          title={t('edit.moveTo')}
          onclick={(e) => {
            e.stopPropagation();
            onmoveTo();
          }}>⇄</button
        >
        <button
          title={t('edit.delete')}
          onclick={(e) => {
            e.stopPropagation();
            ondelete();
          }}>🗑</button
        >
      {/if}
    </span>
  {/if}
</div>

<style>
  .row {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    padding-block: 3px;
    padding-right: var(--sp-2);
    border-radius: var(--radius-sm);
    cursor: default;
  }

  .row:hover {
    background: var(--bg-raised);
  }

  .focused {
    background: var(--bg-raised);
    outline: 2px solid var(--accent);
    outline-offset: -2px;
  }

  .drop-target {
    outline: 2px dashed var(--accent);
    outline-offset: -2px;
  }

  .matched .title {
    color: var(--accent);
    font-weight: 600;
  }

  .disclosure {
    width: 1.2em;
    font: inherit;
    background: none;
    border: none;
    color: var(--fg-muted);
    cursor: pointer;
    padding: 0;
  }

  .title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .domain {
    font-size: var(--fs-0);
    color: var(--fg-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .rename {
    font: inherit;
    flex: 1;
    min-width: 0;
    background: var(--bg);
    color: var(--fg);
    border: 1px solid var(--accent);
    border-radius: var(--radius-sm);
    padding: 1px var(--sp-2);
  }

  .actions {
    margin-left: auto;
    display: none;
    gap: var(--sp-1);
  }

  .row:hover .actions,
  .focused .actions {
    display: flex;
  }

  .actions button {
    font: inherit;
    background: none;
    border: none;
    color: var(--fg-muted);
    cursor: pointer;
    padding: 0 var(--sp-1);
  }

  .actions button:hover {
    color: var(--accent);
  }
</style>
