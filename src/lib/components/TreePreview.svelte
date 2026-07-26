<script lang="ts">
  import type { BookmarkNode } from '../core/model';
  import type { NodeStatus } from '../core/diff';
  import { t } from '../i18n/index.svelte';
  import TreePreviewNode from './TreePreviewNode.svelte';

  interface Props {
    roots: readonly BookmarkNode[];
    status: WeakMap<BookmarkNode, NodeStatus>;
  }

  let { roots, status }: Props = $props();
</script>

<!-- Read-only preview. Folders below depth 2 start collapsed and mount their
     children lazily, so the DOM never holds the whole tree (docs/05 §9). -->
<ul class="tree" role="tree" aria-label={t('import.preview')}>
  {#each roots as node, i (i)}
    <TreePreviewNode {node} {status} depth={1} />
  {/each}
</ul>

<style>
  .tree {
    list-style: none;
    margin: 0;
    padding: 0;
    font-size: var(--fs-1);
    max-height: 420px;
    overflow: auto;
  }
</style>
