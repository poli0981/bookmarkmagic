<script lang="ts">
  import type { MoveTarget } from '../edit/move-target';
  import type { EditNode } from '../edit/patch-tree';
  import { t } from '../i18n/index.svelte';
  import Icon from './icons/Icon.svelte';
  import Modal from './Modal.svelte';

  interface Props {
    /** The node being moved; `undefined` keeps the dialog closed. */
    node: EditNode | undefined;
    targets: readonly MoveTarget[];
    onpick: (parentId: string) => void;
    oncancel: () => void;
  }

  let { node, targets, onpick, oncancel }: Props = $props();

  let filter = $state('');
  const shown = $derived.by(() => {
    const needle = filter.trim().toLowerCase();
    return needle === '' ? targets : targets.filter((target) => target.label.toLowerCase().includes(needle));
  });

  // A fresh filter every time the dialog opens for another node.
  $effect(() => {
    if (node !== undefined) filter = '';
  });
</script>

<!-- Keyboard parity for drag & drop (docs/06 §3.3): every move reachable
     without a mouse, from a real modal that focus enters and Esc leaves. -->
<Modal open={node !== undefined} title={t('edit.moveTo')} wide {oncancel}>
  <p class="lead">{t('edit.moveToBody', { title: node?.title ?? '' })}</p>
  <input
    class="filter"
    type="search"
    placeholder={t('edit.search')}
    aria-label={t('edit.search')}
    bind:value={filter}
  />
  <ul>
    {#each shown as target (target.id)}
      <li>
        <button style:padding-left="calc({target.depth - 1} * 14px + var(--sp-2))" onclick={() => onpick(target.id)}>
          <Icon name="folder" size={14} />
          <span class="label">{target.label}</span>
        </button>
      </li>
    {/each}
    {#if shown.length === 0}
      <li class="muted">{t(targets.length === 0 ? 'edit.noMoveTargets' : 'edit.noMatches')}</li>
    {/if}
  </ul>
</Modal>

<style>
  .lead {
    margin: 0 0 var(--sp-3);
    color: var(--fg-muted);
  }

  .filter {
    width: 100%;
    font: inherit;
    padding: 6px var(--sp-2);
    margin-bottom: var(--sp-3);
    color: var(--fg);
    background: var(--bg-sunken);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-sm);
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
    max-height: 46vh;
    overflow: auto;
  }

  button {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    width: 100%;
    font: inherit;
    text-align: left;
    background: none;
    border: none;
    border-radius: var(--radius-sm);
    color: var(--fg);
    cursor: pointer;
    padding-block: var(--sp-1);
    padding-right: var(--sp-2);
  }

  button:hover,
  button:focus-visible {
    background: var(--accent-subtle);
  }

  .label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .muted {
    color: var(--fg-muted);
    padding: var(--sp-2);
  }
</style>
