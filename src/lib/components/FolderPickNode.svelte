<script lang="ts">
  import type { LiveNode } from '../browser/bookmarks';
  import type { CheckState } from '../core/select';
  import { num, t, tPlural } from '../i18n/index.svelte';
  import Icon from './icons/Icon.svelte';
  import Self from './FolderPickNode.svelte';

  interface Props {
    node: LiveNode;
    depth: number;
    checkState: CheckState;
    resolve: (node: LiveNode) => CheckState;
    ontoggle: (node: LiveNode, checked: boolean) => void;
  }

  let { node, depth, checkState, resolve, ontoggle }: Props = $props();

  const CHUNK = 500;

  // svelte-ignore state_referenced_locally
  let expanded = $state(depth < 2);
  let limit = $state(CHUNK);

  /** Only folders are pickable — a bookmark travels with its parent. */
  const folders = $derived((node.children ?? []).filter((child) => child.url === undefined));
  const bookmarks = $derived((node.children ?? []).filter((child) => child.url !== undefined).length);
  const shown = $derived(folders.length > limit ? folders.slice(0, limit) : folders);

  let input: HTMLInputElement | undefined = $state();

  // `indeterminate` is a DOM property with no HTML attribute, so it has to be
  // set imperatively — and re-set whenever checkState changes. A parameterless
  // `use:` action would run only once at creation and never update.
  $effect(() => {
    if (input !== undefined) input.indeterminate = checkState === 'indeterminate';
  });
</script>

<!-- Nested lists of checkboxes, not role="tree": the checkboxes are the
     keyboard interface, and a tree role promised arrow keys it never had (uM5). -->
<li>
  <div class="row" style:--depth={depth - 1}>
    {#if folders.length > 0}
      <button
        class="disclosure"
        aria-expanded={expanded}
        aria-label={`${expanded ? t('import.collapse') : t('import.expand')}: ${node.title}`}
        onclick={() => {
          expanded = !expanded;
        }}><Icon name="chevron" size={12} turned={expanded} /></button
      >
    {:else}
      <span class="disclosure" aria-hidden="true"></span>
    {/if}

    <label>
      <input
        type="checkbox"
        bind:this={input}
        checked={checkState === 'checked'}
        onchange={(e) => ontoggle(node, e.currentTarget.checked)}
      />
      <span class="glyph"><Icon name="folder" size={14} /></span>
      <span class="title">{node.title}</span>
      {#if bookmarks > 0}<span class="count mono">{num(bookmarks)}</span>{/if}
    </label>
  </div>

  {#if expanded && folders.length > 0}
    <ul>
      {#each shown as child (child.id)}
        <Self node={child} depth={depth + 1} checkState={resolve(child)} {resolve} {ontoggle} />
      {/each}
    </ul>
    {#if folders.length > shown.length}
      <button class="more mono" style:--depth={depth} onclick={() => (limit += CHUNK)}>
        {tPlural('edit.showMore', Math.min(folders.length - shown.length, CHUNK), {
          total: num(folders.length - shown.length),
        })}
      </button>
    {/if}
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
    min-height: 26px;
    padding-left: calc(var(--depth) * 18px);
    border-radius: var(--radius-sm);
  }

  .row:hover {
    background: var(--bg-raised);
  }

  label {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    cursor: pointer;
    min-width: 0;
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
    color: var(--accent);
  }

  .title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .count {
    font-size: var(--fs-0);
    color: var(--fg-muted);
    padding: 0 5px;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
  }

  .more {
    display: block;
    margin: 2px 0 2px calc(var(--depth) * 18px + 22px);
    font: inherit;
    font-size: var(--fs-0);
    background: none;
    border: 1px dashed var(--border-strong);
    border-radius: var(--radius-sm);
    color: var(--accent);
    cursor: pointer;
    padding: 1px var(--sp-2);
  }
</style>
