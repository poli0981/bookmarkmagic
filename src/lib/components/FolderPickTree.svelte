<script lang="ts">
  import type { LiveNode } from '../browser/bookmarks';
  import { checkStateOf, toggleSelection } from '../core/select';
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
      type="checkbox"
      checked={everything}
      onchange={(e) => onchange((e.currentTarget as HTMLInputElement).checked ? undefined : new Set())}
    />
    <strong>{t('export.everything')}</strong>
  </label>

  <ul role="tree" aria-label={t('export.scope')}>
    {#each roots as root (root.id)}
      <FolderPickNode
        node={root}
        depth={1}
        checkState={everything ? 'checked' : checkStateOf(roots, root, selection ?? new Set())}
        resolve={(node) =>
          everything ? 'checked' : checkStateOf(roots, node, selection ?? new Set())}
        ontoggle={toggleNode}
      />
    {/each}
  </ul>
</div>

<style>
  .pick {
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: var(--sp-3);
    max-height: 420px;
    overflow: auto;
  }

  .master {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    padding-bottom: var(--sp-2);
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
