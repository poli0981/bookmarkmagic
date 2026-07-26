<script lang="ts">
  import type { MoveTarget } from '../edit/move-target';
  import type { EditNode } from '../edit/patch-tree';
  import { t } from '../i18n/index.svelte';
  import Button from './Button.svelte';

  interface Props {
    /** The node being moved. Rendering is caller-gated on this existing. */
    node: EditNode;
    targets: readonly MoveTarget[];
    onpick: (parentId: string) => void;
    oncancel: () => void;
  }

  let { node, targets, onpick, oncancel }: Props = $props();
</script>

<!-- Keyboard parity for drag & drop (docs/06 §3.3): every move reachable
     without a mouse. -->
<div class="move-to" role="dialog" aria-label={t('edit.moveTo')}>
  <p>{t('edit.moveToBody', { title: node.title })}</p>
  <ul>
    {#each targets as target (target.id)}
      <li><button onclick={() => onpick(target.id)}>{target.label}</button></li>
    {/each}
    {#if targets.length === 0}
      <li class="muted">{t('edit.noMoveTargets')}</li>
    {/if}
  </ul>
  <Button onclick={oncancel}>{t('common.cancel')}</Button>
</div>

<style>
  /* Copied verbatim from EditTab — this is a move, not a redesign. */
  .move-to {
    position: fixed;
    inset-block-end: var(--sp-4);
    inset-inline-end: var(--sp-4);
    width: min(360px, calc(100vw - var(--sp-6)));
    max-height: 60vh;
    overflow: auto;
    background: var(--bg);
    border: 1px solid var(--accent);
    border-radius: var(--radius);
    padding: var(--sp-3);
    box-shadow: 0 8px 32px rgb(0 0 0 / 0.25);
  }

  .move-to p {
    margin: 0 0 var(--sp-2);
    font-size: var(--fs-1);
    color: var(--fg-muted);
  }

  .move-to ul {
    list-style: none;
    margin: 0 0 var(--sp-3);
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .move-to button {
    font: inherit;
    width: 100%;
    text-align: left;
    background: none;
    border: none;
    border-radius: var(--radius-sm);
    color: var(--fg);
    cursor: pointer;
    padding: var(--sp-1) var(--sp-2);
  }

  .move-to button:hover {
    background: var(--bg-raised);
  }

  .muted {
    color: var(--fg-muted);
    font-size: var(--fs-1);
  }
</style>
