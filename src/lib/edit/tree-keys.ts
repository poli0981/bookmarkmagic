/**
 * What a keydown on the #edit tree does — docs/06 §5.
 *
 * Purpose: the tree's keyboard contract applied to the session. Arrows, Home,
 *   End and type-ahead move the focus; → and ← open and close; Enter opens;
 *   F2, Delete and the menu key (or Shift+F10) rename, delete and "Move to…";
 *   Ctrl/⌘+C copies the link. Kept out of EditTab so the component stays
 *   wiring (docs/10 §1); the key → action mapping itself is `tree-keyboard`.
 * Guarantees: does nothing while a rename box is open or for keys aimed at a
 *   row's own control, and the session refuses writes while a bulk command
 *   runs.
 */
import type { EditSession } from '../stores/edit-session.svelte';
import { type EditNode, findNode } from './patch-tree';
import { resolveKey } from './tree-keyboard';

export interface TreeKeyEffects {
  open: (node: EditNode) => void;
  copy: (node: EditNode) => void;
  /** The focus moved: bring its row into view. */
  scroll: () => void;
}

export function onTreeKey(
  event: KeyboardEvent,
  session: EditSession,
  effects: TreeKeyEffects,
): void {
  if (session.renamingId !== undefined) return;
  // Keys aimed at a row's own control (or the rename input) belong to it.
  if (event.target !== event.currentTarget) return;
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c') {
    const focused = findNode(session.roots, session.focusedId ?? '');
    if (focused === undefined) return;
    event.preventDefault();
    effects.copy(focused);
    return;
  }
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  const key = event.shiftKey && event.key === 'F10' ? 'ContextMenu' : event.key;

  const action = resolveKey(key, session.focusedId, session.rows);
  if (action.kind === 'none') return;
  event.preventDefault();
  const node = 'id' in action ? findNode(session.roots, action.id) : undefined;

  switch (action.kind) {
    case 'focus':
      session.focusedId = action.id;
      effects.scroll();
      break;
    case 'expand':
    case 'collapse':
      session.toggle(action.id);
      break;
    case 'rename':
      if (node !== undefined) session.startRename(node);
      break;
    case 'delete':
      if (node !== undefined) session.requestDelete(node, true);
      break;
    case 'move':
      if (node !== undefined) session.startMove(node);
      break;
    case 'activate':
      if (node?.url !== undefined) effects.open(node);
      else if (node !== undefined) session.toggle(node.id);
      break;
  }
}
