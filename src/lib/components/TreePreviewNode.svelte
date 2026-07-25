<script lang="ts">
  import type { NodeStatus } from '../core/diff';
  import { t } from '../i18n/index.svelte';
  import { type BookmarkNode, isFolder } from '../core/model';
  import Self from './TreePreviewNode.svelte';

  interface Props {
    node: BookmarkNode;
    status: WeakMap<BookmarkNode, NodeStatus>;
    depth: number;
  }

  let { node, status, depth }: Props = $props();

  // Collapsed from depth 2 down. Children are only rendered while expanded, so
  // a 100k-node file never materializes as 100k DOM nodes (docs/05 §9).
  // `depth` is fixed for the lifetime of a node component, so capturing its
  // initial value here is deliberate.
  // svelte-ignore state_referenced_locally
  let expanded = $state(depth < 2);

  const folder = $derived(isFolder(node));
  const childCount = $derived(node.children?.length ?? 0);
  const badge = $derived(status.get(node));
</script>

<li
  role="treeitem"
  aria-expanded={folder ? expanded : undefined}
  aria-level={depth}
  aria-selected={false}
>
  <div class="row" style:padding-left="{(depth - 1) * 14}px">
    {#if folder}
      <button
        class="disclosure"
        aria-label={expanded ? t('import.collapse') : t('import.expand')}
        onclick={() => {
          expanded = !expanded;
        }}
        disabled={childCount === 0}
      >
        {childCount === 0 ? '·' : expanded ? '▾' : '▸'}
      </button>
      <span class="glyph" aria-hidden="true">🗀</span>
    {:else}
      <span class="disclosure" aria-hidden="true"></span>
      <span class="glyph" aria-hidden="true">🔗</span>
    {/if}

    <span class="title">{node.title}</span>

    {#if badge !== undefined}
      <span class="badge {badge}">{badge === 'new' ? t('import.badgeNew') : t('import.badgeDup')}</span>
    {/if}
  </div>

  {#if folder && expanded && childCount > 0}
    <ul role="group">
      {#each node.children ?? [] as child, i (i)}
        <Self node={child} {status} depth={depth + 1} />
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
    gap: var(--sp-2);
    padding-block: 2px;
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

  .disclosure:disabled {
    cursor: default;
    opacity: 0.4;
  }

  .title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .badge {
    font-size: var(--fs-0);
    padding: 0 var(--sp-1);
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    color: var(--fg-muted);
  }

  .badge.new {
    color: var(--success);
    border-color: var(--success);
  }
</style>
