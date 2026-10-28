<script lang="ts">
  import type { NodeStatus } from '../core/diff';
  import type { BookmarkNode } from '../core/model';
  import TreePreviewNode from './TreePreviewNode.svelte';

  interface Props {
    roots: readonly BookmarkNode[];
    status: WeakMap<BookmarkNode, NodeStatus>;
    /** Accessible name of the list. */
    label: string;
  }

  let { roots, status, label }: Props = $props();
</script>

<!-- Read-only preview, as nested lists with disclosure buttons — not
     role="tree": a tree promises arrow-key navigation, and a read-only preview
     that did not provide it announced a widget that ignored the keyboard (uM5).
     Folders below depth 2 start collapsed and mount children lazily, 500 at a
     time, so the DOM never holds the whole file (docs/05 §9). -->
<div class="frame">
  <ul class="list" aria-label={label}>
    {#each roots as node, i (i)}
      <TreePreviewNode {node} {status} depth={1} />
    {/each}
  </ul>
</div>

<style>
  .frame {
    border: 1px solid var(--border-strong);
    border-radius: var(--radius);
    background: var(--bg);
  }

  .list {
    list-style: none;
    margin: 0;
    padding: var(--sp-2);
    font-size: var(--fs-1);
    max-height: min(62vh, 560px);
    overflow: auto;
  }
</style>
