<script lang="ts">
  /**
   * A tree row's buttons — docs/06 §3.3. Mouse shortcuts, each with a keyboard
   * equivalent on the tree (docs/06 §5), so none of them is a tab stop. The
   * writing ones are disabled while a bulk command runs: a second sort started
   * from a row used to fail with two false messages and re-enable the toolbar
   * mid-sort (v1.1.0 review).
   *
   * A click hands focus back to the tree: Chrome focuses a `tabindex="-1"`
   * button when it is clicked, and the tree ignores keys aimed at a row's own
   * control, so the arrow keys went dead until the next click on a row. Each
   * button is 24 × 24 px — the 14 px glyph, 4 px of padding, a 1 px border.
   */
  import type { EditNode } from '../edit/patch-tree';
  import { t } from '../i18n/index.svelte';
  import type { EditSession } from '../stores/edit-session.svelte';
  import { focusOwningTree } from './focus-heading';
  import Icon from './icons/Icon.svelte';

  interface Props {
    node: EditNode;
    session: EditSession;
    editable: boolean;
    onopen: (node: EditNode) => void;
    oncopy: (node: EditNode) => void;
    onsort: (node: EditNode) => void;
  }

  let { node, session, editable, onopen, oncopy, onsort }: Props = $props();

  /**
   * A row button must not also focus or activate the row under it. Focus moves
   * to the tree BEFORE the action runs, so a dialog the action opens remembers
   * the tree — not this button — as where to return.
   */
  function act(run: () => void): (event: MouseEvent) => void {
    return (event) => {
      event.stopPropagation();
      focusOwningTree(event.currentTarget);
      run();
    };
  }
</script>

<span class="actions">
  {#if node.url !== undefined}
    <button tabindex="-1" title={t('edit.open')} aria-label={t('edit.open')} onclick={act(() => onopen(node))}>
      <Icon name="external" size={14} />
    </button>
    <button tabindex="-1" title={t('edit.copyUrl')} aria-label={t('edit.copyUrl')} onclick={act(() => oncopy(node))}>
      <Icon name="copy" size={14} />
    </button>
  {/if}
  {#if session.canSort(node)}
    <button tabindex="-1" disabled={session.busy} title={t('edit.sort')} aria-label={t('edit.sort')} onclick={act(() => onsort(node))}>
      <Icon name="sort" size={14} motion="bob" />
    </button>
  {/if}
  {#if editable}
    <button tabindex="-1" disabled={session.busy} title={t('edit.rename')} aria-label={t('edit.rename')} onclick={act(() => session.startRename(node))}>
      <Icon name="edit" size={14} />
    </button>
    <button tabindex="-1" disabled={session.busy} title={t('edit.moveTo')} aria-label={t('edit.moveTo')} onclick={act(() => session.startMove(node))}>
      <Icon name="move" size={14} motion="bob" />
    </button>
    <button tabindex="-1" disabled={session.busy} class="delete" title={t('edit.delete')} aria-label={t('edit.delete')} onclick={act(() => session.requestDelete(node, 'tree'))}>
      <Icon name="trash" size={14} motion="tilt" />
    </button>
  {/if}
</span>

<style>
  .actions {
    margin-left: auto;
    display: flex;
    flex: none;
    gap: 2px;
  }

  button {
    display: inline-flex;
    align-items: center;
    padding: 4px;
    background: none;
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    color: var(--fg-muted);
    cursor: pointer;
  }

  button:hover:not(:disabled) {
    color: var(--accent);
    border-color: var(--border);
    background: var(--bg);
  }

  .delete:hover:not(:disabled) {
    color: var(--danger);
  }

  button:disabled {
    cursor: not-allowed;
  }
</style>
