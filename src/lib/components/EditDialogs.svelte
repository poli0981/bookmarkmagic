<script lang="ts">
  /**
   * The #edit tab's dialogs — docs/06 §3.3: "Move to…" and the three
   * confirmations (delete, keep the first of each, Sort A→Z). Markup only:
   * what each one asks comes from the session, and what happens after a
   * confirmation — the command, and where focus goes once it is done
   * (docs/06 §5) — is the tab's, passed in.
   */
  import { countDescendants, displayTitle } from '../edit/edit-node';
  import { moveTargets } from '../edit/move-target';
  import { t, tPlural } from '../i18n/index.svelte';
  import type { EditSession } from '../stores/edit-session.svelte';
  import ConfirmDialog from './ConfirmDialog.svelte';
  import MoveToDialog from './MoveToDialog.svelte';

  interface Props {
    session: EditSession;
    ondelete: () => void;
    onkeepFirst: () => void;
    onsort: () => void;
  }

  let { session, ondelete, onkeepFirst, onsort }: Props = $props();

  // Only while the dialog is open: it walks every folder in the tree.
  const targets = $derived(
    session.movingNode === undefined ? [] : moveTargets(session.roots, session.movingNode),
  );
  const descendantCount = $derived(countDescendants(session.pendingDelete));
  const pendingTitle = $derived(displayTitle(session.pendingDelete, t('edit.untitled')));
</script>

<MoveToDialog
  node={session.movingNode}
  {targets}
  onpick={(parentId) => {
    const id = session.movingNode?.id;
    session.movingNode = undefined;
    if (id !== undefined) void session.moveTo(id, { parentId });
  }}
  oncancel={() => (session.movingNode = undefined)}
/>

<ConfirmDialog
  open={session.pendingDelete !== undefined}
  danger
  title={t('edit.deleteTitle')}
  body={descendantCount > 0
    ? tPlural('edit.deleteFolderBody', descendantCount, { title: pendingTitle })
    : t('edit.deleteBody', { title: pendingTitle })}
  confirmLabel={t('edit.delete')}
  cancelLabel={t('common.cancel')}
  onconfirm={ondelete}
  oncancel={() => (session.pendingDelete = undefined)}
/>

<ConfirmDialog
  open={session.pendingKeepFirst}
  danger
  title={t('edit.keepFirstTitle')}
  body={tPlural(
    'edit.keepFirstBody',
    session.duplicateGroups.reduce((n, g) => n + g.nodes.length - 1, 0),
  )}
  confirmLabel={t('edit.delete')}
  cancelLabel={t('common.cancel')}
  onconfirm={onkeepFirst}
  oncancel={() => (session.pendingKeepFirst = false)}
/>

<ConfirmDialog
  open={session.pendingSort !== undefined}
  title={t('edit.sortTitle', { title: displayTitle(session.pendingSort?.folder, t('edit.untitled')) })}
  body={tPlural('edit.sortBody', session.pendingSort?.moves.length ?? 0)}
  confirmLabel={t('edit.sort')}
  cancelLabel={t('common.cancel')}
  onconfirm={onsort}
  oncancel={() => (session.pendingSort = undefined)}
/>
