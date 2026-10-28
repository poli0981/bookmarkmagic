<script lang="ts">
  import type { LiveNode } from '../browser/bookmarks';
  import { checkStates, toggleSelection } from '../core/select';
  import FolderPickNode from './FolderPickNode.svelte';
  import { t } from '../i18n/index.svelte';

  interface Props {
    roots: readonly LiveNode[];
    /** `undefined` ⇒ "Everything"; a Set ⇒ explicit folder selection. */
    selection: ReadonlySet<string> | undefined;
    onchange: (selection: ReadonlySet<string> | undefined) => void;
  }

  let { roots, selection, onchange }: Props = $props();

  const everything = $derived(selection === undefined);
  const states = $derived(selection === undefined ? undefined : checkStates(roots, selection));
  let master: HTMLInputElement | undefined = $state();
  // "Everything" is half-checked while a partial selection exists (uL30);
  // `indeterminate` is a DOM property with no attribute, so it is set here.
  $effect(() => {
    if (master !== undefined) master.indeterminate = selection !== undefined && selection.size > 0;
  });

  function toggleNode(node: LiveNode, checked: boolean): void {
    // Leaving "Everything" materialises it into a real selection first, so the
    // untick has something concrete to subtract from.
    const base = selection ?? new Set(roots.map((root) => root.id));
    onchange(toggleSelection(roots, node, checked, base));
  }
</script>

<div class="pick">
  <label class="master">
    <input
      bind:this={master}
      type="checkbox"
      checked={everything}
      onchange={(e) => onchange(e.currentTarget.checked ? undefined : new Set())}
    />
    <strong>{t('export.everything')}</strong>
  </label>

  <ul aria-label={t('export.scope')}>
    {#each roots as root (root.id)}
      <FolderPickNode
        node={root}
        depth={1}
        checkState={states?.get(root.id) ?? 'checked'}
        resolve={(node) => states?.get(node.id) ?? 'checked'}
        ontoggle={toggleNode}
      />
    {/each}
  </ul>
</div>

<style>
  .pick {
    border: 1px solid var(--border-strong);
    border-radius: var(--radius);
    background: var(--bg);
    padding: var(--sp-2) var(--sp-3);
    max-height: min(62vh, 560px);
    overflow: auto;
  }

  .master {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    padding: var(--sp-1) 0 var(--sp-2);
    border-bottom: 1px solid var(--border);
    margin-bottom: var(--sp-2);
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    font-size: var(--fs-1);
  }
</style>
