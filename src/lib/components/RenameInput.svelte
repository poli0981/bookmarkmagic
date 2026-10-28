<script lang="ts">
  /**
   * A tree row's inline rename box — docs/06 §3.3 (F2, New folder). Enter and
   * blur commit, Esc cancels (uL1); after Enter or Esc, focus goes back to the
   * tree rather than to `<body>`.
   */
  import type { EditNode } from '../edit/patch-tree';
  import { t } from '../i18n/index.svelte';
  import type { EditSession } from '../stores/edit-session.svelte';

  interface Props {
    node: EditNode;
    session: EditSession;
  }

  let { node, session }: Props = $props();

  /**
   * Focus and select the box as it mounts. Svelte's `autofocus` only acts when
   * nothing else has focus — never the case after F2 (the tree has it) or New
   * folder (the toolbar button has it) — so the box opened with the cursor
   * elsewhere and every tree key was swallowed (v1.1.0 review).
   */
  function focusOnMount(input: HTMLInputElement): void {
    input.focus();
    input.select();
  }

  function onKeydown(event: KeyboardEvent & { currentTarget: HTMLInputElement }): void {
    event.stopPropagation();
    const input = event.currentTarget;
    // Commit or cancel FIRST: either clears `renamingId`, so the blur that
    // moving focus causes does not commit a second time.
    if (event.key === 'Enter') void session.commitRename(node.id, input.value);
    else if (event.key === 'Escape') session.renamingId = undefined;
    else return;
    const tree = input.closest('[role="tree"]');
    if (tree instanceof HTMLElement) tree.focus();
  }
</script>

<input
  class="rename"
  value={node.title}
  aria-label={t('edit.rename')}
  {@attach focusOnMount}
  onkeydown={onKeydown}
  onblur={(event) => {
    // Esc already cancelled; a blur after it must not commit (uL1).
    if (session.renamingId === node.id) void session.commitRename(node.id, event.currentTarget.value);
  }}
/>

<style>
  .rename {
    font: inherit;
    flex: 1;
    min-width: 0;
    background: var(--bg);
    color: var(--fg);
    border: 1px solid var(--accent);
    border-radius: var(--radius-sm);
    padding: 1px var(--sp-2);
  }
</style>
