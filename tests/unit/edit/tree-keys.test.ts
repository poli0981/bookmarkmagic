import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import type { EditNode } from '@/lib/edit/patch-tree';
import { onTreeKey } from '@/lib/edit/tree-keys';
import { EditSession } from '@/lib/stores/edit-session.svelte';
import { FakeBookmarks } from '../../helpers/fake-bookmarks';

/**
 * The #edit tree's keyboard contract applied to a real session — docs/06 §5.
 * Keys are dispatched on an element whose listener is the handler, exactly as
 * TreeList wires it, so the target/currentTarget rule is exercised too.
 */
let fake: FakeBookmarks;
let session: EditSession;
let tree: HTMLUListElement;
let effects: { open: Mock<(id: string) => void>; copy: Mock<(id: string) => void> };
let ids: { dev: string; gh: string; docs: string };

beforeEach(async () => {
  fake = new FakeBookmarks();
  ids = {
    docs: fake.seed('1', { title: 'Docs', url: 'https://docs.example/' }),
    dev: fake.seed('1', { title: 'Dev' }),
    gh: '',
  };
  ids.gh = fake.seed(ids.dev, { title: 'GitHub', url: 'https://github.com/' });
  session = new EditSession(
    {
      getRootChildren: async () => (await fake.getTree())[0]?.children ?? [],
      getChildren: async (id: string) => fake.children(id),
      create: fake.create,
      update: fake.update,
      move: fake.move,
      remove: fake.remove,
      removeTree: fake.removeTree,
    },
    () => 'en',
  );
  await session.load();
  effects = { open: vi.fn<(id: string) => void>(), copy: vi.fn<(id: string) => void>() };
  tree = document.createElement('ul');
  tree.addEventListener('keydown', (event) =>
    onTreeKey(event, session, {
      open: (node: EditNode) => effects.open(node.id),
      copy: (node: EditNode) => effects.copy(node.id),
    }),
  );
});

function press(key: string, init: KeyboardEventInit = {}, target: Element = tree): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
}

describe('onTreeKey', () => {
  it('moves the focus and claims the key', () => {
    session.focusedId = '1';
    const event = press('ArrowDown');
    expect(session.focusedId).toBe(ids.docs);
    expect(event.defaultPrevented).toBe(true);
  });

  it('opens and closes folders, and opens bookmarks', () => {
    session.focusedId = ids.dev;
    press('ArrowRight');
    expect(session.expanded.has(ids.dev)).toBe(true);
    press('Enter');
    expect(session.expanded.has(ids.dev)).toBe(false);
    session.focusedId = ids.docs;
    press('Enter');
    expect(effects.open).toHaveBeenCalledWith(ids.docs);
  });

  it('starts a rename, a delete from the tree, and "Move to…" — by menu key or Shift+F10', () => {
    session.focusedId = ids.docs;
    press('F2');
    expect(session.renamingId).toBe(ids.docs);
    session.renamingId = undefined;
    press('Delete');
    expect(session.pendingDelete?.id).toBe(ids.docs);
    session.pendingDelete = undefined;
    press('ContextMenu');
    expect(session.movingNode?.id).toBe(ids.docs);
    session.movingNode = undefined;
    press('F10', { shiftKey: true });
    // toMatchObject, not `?.id`: TS keeps the `undefined` narrowing across the call.
    expect(session.movingNode).toMatchObject({ id: ids.docs });
  });

  it('copies the focused bookmark with Ctrl or ⌘ + C, whatever the case', () => {
    session.focusedId = ids.docs;
    press('c', { ctrlKey: true });
    press('C', { metaKey: true });
    expect(effects.copy).toHaveBeenCalledTimes(2);
  });

  it('leaves alone: keys while renaming, keys aimed at a row control, other modifiers', () => {
    session.focusedId = ids.docs;
    session.renamingId = ids.docs;
    expect(press('ArrowDown').defaultPrevented).toBe(false);
    session.renamingId = undefined;
    const button = tree.appendChild(document.createElement('button'));
    expect(press('ArrowDown', {}, button).defaultPrevented).toBe(false);
    expect(press('ArrowDown', { altKey: true }).defaultPrevented).toBe(false);
    expect(session.focusedId).toBe(ids.docs);
  });

  it('starts no write while a bulk command runs', () => {
    session.focusedId = ids.docs;
    session.busy = true;
    press('F2');
    press('Delete');
    press('ContextMenu');
    expect(session.renamingId).toBeUndefined();
    expect(session.pendingDelete).toBeUndefined();
    expect(session.movingNode).toBeUndefined();
  });
});
