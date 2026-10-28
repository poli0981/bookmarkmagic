<script lang="ts">
  import type { NodeStatus } from '../core/diff';
  import { type BookmarkNode, isFolder } from '../core/model';
  import { num, t, tPlural } from '../i18n/index.svelte';
  import Icon from './icons/Icon.svelte';
  import Self from './TreePreviewNode.svelte';

  interface Props {
    node: BookmarkNode;
    status: WeakMap<BookmarkNode, NodeStatus>;
    depth: number;
  }

  let { node, status, depth }: Props = $props();

  const CHUNK = 500;

  // Collapsed from depth 2 down; `depth` is fixed for the life of a node
  // component, so capturing its initial value is deliberate.
  // svelte-ignore state_referenced_locally
  let expanded = $state(depth < 2);
  let limit = $state(CHUNK);

  const folder = $derived(isFolder(node));
  const children = $derived(node.children ?? []);
  const shown = $derived(children.length > limit ? children.slice(0, limit) : children);
  const badge = $derived(status.get(node));
  /** Where Merge and Replace send this folder's contents — shown on the top level only. */
  const target = $derived(
    depth !== 1 || !folder
      ? undefined
      : node.toolbar === true
        ? 'bar'
        : node.root === 'other'
          ? 'unfiled'
          : node.root === 'mobile'
            ? 'mobile'
            : undefined,
  );
</script>

<li>
  <div class="row" style:--depth={depth - 1}>
    {#if folder && children.length > 0}
      <button
        class="disclosure"
        aria-expanded={expanded}
        aria-label={`${expanded ? t('import.collapse') : t('import.expand')}: ${node.title}`}
        onclick={() => {
          expanded = !expanded;
        }}
      >
        <Icon name="chevron" size={12} turned={expanded} />
      </button>
    {:else}
      <span class="disclosure" aria-hidden="true"></span>
    {/if}
    <span class="glyph" class:folder aria-hidden="true">
      <Icon name={folder ? (expanded && children.length > 0 ? 'folder-open' : 'folder') : 'link'} size={14} />
    </span>

    <span class="title" class:untitled={node.title === ''}>
      {node.title === '' ? (node.url ?? '') : node.title}
    </span>

    {#if folder}<span class="count mono">{num(children.length)}</span>{/if}
    {#if target !== undefined}
      <span class="target mono" title={t('import.targetNote')}>→ {t(`import.target.${target}`)}</span>
    {/if}
    {#if badge !== undefined}
      <span class="badge mono {badge}">{badge === 'new' ? t('import.badgeNew') : t('import.badgeDup')}</span>
    {/if}
  </div>

  {#if folder && expanded && children.length > 0}
    <ul>
      {#each shown as child, i (i)}
        <Self node={child} {status} depth={depth + 1} />
      {/each}
    </ul>
    {#if children.length > shown.length}
      <button class="more mono" style:--depth={depth} onclick={() => (limit += CHUNK)}>
        {tPlural('edit.showMore', Math.min(children.length - shown.length, CHUNK), {
          total: num(children.length - shown.length),
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
    gap: var(--sp-2);
    min-height: 26px;
    padding-left: calc(var(--depth) * 18px);
    border-radius: var(--radius-sm);
  }

  .row:hover {
    background: var(--bg-raised);
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

  .title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .untitled {
    font-family: var(--font-mono);
    font-size: var(--fs-0);
    color: var(--fg-muted);
  }

  .count,
  .badge,
  .target {
    flex: none;
    font-size: var(--fs-0);
    padding: 0 5px;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    color: var(--fg-muted);
  }

  .target {
    color: var(--accent);
    border-color: var(--accent);
    cursor: help;
  }

  .badge.new {
    color: var(--success);
    border-color: var(--success);
  }

  .badge.exists {
    color: var(--warn);
    border-color: var(--warn);
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
