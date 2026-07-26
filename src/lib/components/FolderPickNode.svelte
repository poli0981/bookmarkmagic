<script lang="ts">
  import type { LiveNode } from '../browser/bookmarks';
  import type { CheckState } from '../core/select';
  import { num, t } from '../i18n/index.svelte';
  import Self from './FolderPickNode.svelte';

  interface Props {
    node: LiveNode;
    depth: number;
    checkState: CheckState;
    resolve: (node: LiveNode) => CheckState;
    ontoggle: (node: LiveNode, checked: boolean) => void;
  }

  let { node, depth, checkState, resolve, ontoggle }: Props = $props();

  // svelte-ignore state_referenced_locally
  let expanded = $state(depth < 2);

  /** Only folders are pickable — a bookmark travels with its parent. */
  const folders = $derived((node.children ?? []).filter((child) => child.url === undefined));
  const bookmarks = $derived((node.children ?? []).filter((child) => child.url !== undefined).length);

  let input: HTMLInputElement | undefined = $state();

  // `indeterminate` is a DOM property with no HTML attribute, so it has to be
  // set imperatively — and re-set whenever checkState changes. A parameterless
  // `use:` action would run only once at creation and never update.
  $effect(() => {
    if (input !== undefined) input.indeterminate = checkState === 'indeterminate';
  });
</script>

<li role="treeitem" aria-expanded={folders.length > 0 ? expanded : undefined} aria-level={depth} aria-selected={checkState === 'checked'}>
  <div class="row" style:padding-left="{(depth - 1) * 14}px">
    {#if folders.length > 0}
      <button
        class="disclosure"
        aria-label={expanded ? t('import.collapse') : t('import.expand')}
        onclick={() => {
          expanded = !expanded;
        }}>{expanded ? '▾' : '▸'}</button
      >
    {:else}
      <span class="disclosure" aria-hidden="true"></span>
    {/if}

    <label>
      <input
        type="checkbox"
        bind:this={input}
        checked={checkState === 'checked'}
        onchange={(e) => ontoggle(node, (e.currentTarget as HTMLInputElement).checked)}
      />
      <span class="title">{node.title}</span>
      {#if bookmarks > 0}<span class="count">{num(bookmarks)}</span>{/if}
    </label>
  </div>

  {#if expanded && folders.length > 0}
    <ul role="group">
      {#each folders as child (child.id)}
        <Self node={child} depth={depth + 1} checkState={resolve(child)} {resolve} {ontoggle} />
      {/each}
    </ul>
  {/if}
</li>

<style>
  li {
    list-style: none;
  }

  ul {
    margin: 0;
    padding: 0;
  }

  .row {
    display: flex;
    align-items: center;
    gap: var(--sp-1);
    padding-block: 2px;
  }

  label {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    cursor: pointer;
    min-width: 0;
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

  .count {
    font-size: var(--fs-0);
    color: var(--fg-muted);
  }
</style>
