/**
 * The #edit tab's single-item commands — docs/03 §3, docs/06 §3.3.
 *
 * Purpose: load the tree, and rename, delete, create and move one node at a
 *   time. Extends the view state in `edit-view.svelte.ts`; the bulk commands
 *   (keep-first, sort) extend this in `edit-session.svelte.ts`.
 * Guarantees: the browser is the only source of truth. Edits are applied
 *   optimistically and confirmed by the live events; any failure re-reads the
 *   tree instead of restoring a snapshot, which would resurrect rows an
 *   earlier step of a bulk command legitimately deleted. While a bulk command
 *   runs (`busy`), every write here is refused, not just greyed out.
 */
import {
  create,
  getChildren,
  getRootChildren,
  type LiveNode,
  move,
  remove,
  removeTree,
  update,
} from '../browser/bookmarks';
import { type DescribedError, describeError } from '../browser/describe-error';
import { isEditable as canEdit, resolveNewFolderParent, toEditNode } from '../edit/edit-node';
import { applyEvents, type LiveEvent } from '../edit/live-sync';
import { canMoveInto, type DropPlan, type DropZone, planDrop } from '../edit/move-target';
import {
  changeNode,
  type EditNode,
  findNode,
  insertNode,
  moveNode,
  removeNode,
} from '../edit/patch-tree';
import { EditView } from './edit-view.svelte';

/** The slice of `browser/bookmarks.ts` the tab writes through — injectable for tests. */
export interface EditApi {
  getRootChildren: () => Promise<LiveNode[]>;
  getChildren: (id: string) => Promise<LiveNode[]>;
  create: (details: { parentId: string; title: string }) => Promise<LiveNode>;
  update: (id: string, changes: { title?: string }) => Promise<void>;
  move: (id: string, destination: { parentId?: string; index?: number }) => Promise<void>;
  remove: (id: string) => Promise<void>;
  removeTree: (id: string) => Promise<void>;
}

/** How far a bulk command got before the browser refused. */
export interface BulkProgress {
  done: number;
  total: number;
  kind: 'delete' | 'sort';
}

/** A failed command, shown above the tree rather than replacing it. */
export type ActionError = DescribedError & { partial?: BulkProgress };

/** Where a delete was asked for: the tree (Del, a row's button) or the duplicate panel. */
export type DeleteOrigin = 'tree' | 'panel';

const BROWSER_API: EditApi = {
  getRootChildren,
  getChildren,
  create,
  update,
  move,
  remove,
  removeTree,
};

export class EditCommands extends EditView {
  loading = $state(true);
  loadError = $state<DescribedError | undefined>();
  pendingDelete = $state<EditNode | undefined>();
  draggingId = $state<string | undefined>();
  movingNode = $state<EditNode | undefined>();
  actionError = $state<ActionError | undefined>();
  /** A bulk command is running; every other write waits for it. */
  busy = $state(false);
  /** Where the pending delete was asked for. */
  private deleteOrigin: DeleteOrigin = 'tree';

  protected readonly api: EditApi;
  protected readonly locale: () => string;

  constructor(api: EditApi = BROWSER_API, locale: () => string = () => 'en') {
    super();
    this.api = api;
    this.locale = locale;
  }

  /** Permanent roots and policy-managed nodes refuse every write — docs/02 §4. */
  isEditable = (node: EditNode): boolean => canEdit(this.roots, node);

  canDropInto = (id: string): boolean =>
    this.draggingId !== undefined && canMoveInto(this.roots, this.draggingId, id);

  /**
   * (Re-)read the tree. Keeps what the user had open and focused — a resync
   * after a failed edit used to collapse the whole tree and drop the focus. A
   * focus whose node is gone is moved by `repairFocus`, not dropped.
   */
  load = async (): Promise<void> => {
    try {
      const fresh = (await this.api.getRootChildren()).map(toEditNode);
      const firstLoad = this.roots.length === 0;
      this.roots = fresh;
      if (firstLoad) this.expanded = new Set(fresh.map((root) => root.id));
      this.loadError = undefined;
    } catch (err) {
      // Never `err.detail` alone: a raw English Chrome string as the whole
      // screen, in every language (docs/02 §7).
      this.loadError = describeError(err);
    } finally {
      this.loading = false;
    }
  };

  applyLiveEvents = (events: readonly LiveEvent[]): void => {
    this.roots = applyEvents(this.roots, events);
  };

  protected guard = async (run: () => Promise<void>): Promise<boolean> => {
    this.actionError = undefined;
    try {
      await run();
      return true;
    } catch (err) {
      this.actionError = describeError(err);
      await this.load();
      return false;
    }
  };

  /** F2 or the row button: open the rename box. */
  startRename = (node: EditNode): void => {
    if (!this.busy && this.isEditable(node)) this.renamingId = node.id;
  };

  /** The keyboard "Move to…" (menu key, Shift+F10) and the row button. */
  startMove = (node: EditNode): void => {
    if (!this.busy && this.isEditable(node)) this.movingNode = node;
  };

  /** Esc and blur both land here; only Enter and blur commit (uL1). */
  commitRename = async (id: string, raw: string): Promise<void> => {
    this.renamingId = undefined;
    const title = raw.trim();
    const node = findNode(this.roots, id);
    if (node === undefined || !this.isEditable(node)) return;
    if (title === '' || title === node.title) return;
    await this.guard(async () => {
      this.roots = changeNode(this.roots, id, { title });
      await this.api.update(id, { title });
    });
  };

  requestDelete = (node: EditNode, origin: DeleteOrigin): void => {
    if (this.busy || !this.isEditable(node)) return;
    this.pendingDelete = node;
    this.deleteOrigin = origin;
  };

  /**
   * Delete what `requestDelete` asked about. The tree's focus moves to the
   * next row only when the deleted row had it — a copy deleted from the
   * duplicate panel used to move the tree's selection (v1.1.0 review).
   *
   * @returns where the delete was asked for, once it went through, so the
   *   caller can put keyboard focus back there: the button that opened the
   *   dialog went with what it deleted, and focus fell to `<body>`.
   */
  confirmDelete = async (): Promise<DeleteOrigin | undefined> => {
    const node = this.pendingDelete;
    const origin = this.deleteOrigin;
    this.pendingDelete = undefined;
    if (node === undefined || this.busy || !this.isEditable(node)) return undefined;
    const hadFocus = node.id === this.focusedId;
    const next = hadFocus ? this.neighbourOf(node.id) : undefined;
    const ok = await this.guard(async () => {
      this.roots = removeNode(this.roots, node.id);
      if (node.url === undefined) await this.api.removeTree(node.id);
      else await this.api.remove(node.id);
    });
    if (ok && hadFocus) this.focusedId = next;
    return ok ? origin : undefined;
  };

  newFolder = async (title: string): Promise<void> => {
    if (this.busy) return;
    const parentId = resolveNewFolderParent(this.roots, findNode(this.roots, this.focusedId ?? ''));
    if (parentId === undefined) return;
    await this.guard(async () => {
      const created = toEditNode(await this.api.create({ parentId, title }));
      // In the tree now, not a frame later from the live event: the rename
      // box needs its row. Chrome fires `onCreated` BEFORE `create` resolves,
      // so the event may have won the race — inserting again put two rows
      // with one id in the keyed list.
      if (findNode(this.roots, created.id) === undefined) {
        this.roots = insertNode(this.roots, parentId, undefined, created);
      }
      // A search would hide it, and clearing that search closes the folders
      // it opened — so every folder above it is opened as the user's own.
      if (this.filtering) this.clearSearch();
      this.reveal(created.id);
      this.focusedId = created.id;
      this.renamingId = created.id;
    });
  };

  /** Shared by drag & drop and the keyboard "Move to…" dialog. */
  moveTo = async (id: string, plan: DropPlan): Promise<void> => {
    if (this.busy) return;
    const node = findNode(this.roots, id);
    if (node === undefined || !this.isEditable(node)) return;
    if (!canMoveInto(this.roots, id, plan.parentId)) return;
    const { parentId, position } = plan;
    await this.guard(async () => {
      this.roots = moveNode(this.roots, id, parentId, position?.local);
      await this.api.move(
        id,
        position === undefined ? { parentId } : { parentId, index: position.api },
      );
    });
  };

  /** A drag released on `targetId`; every illegal or no-op drop does nothing. */
  drop = async (targetId: string, zone: DropZone): Promise<void> => {
    const id = this.draggingId;
    this.draggingId = undefined;
    if (id === undefined) return;
    const plan = planDrop(this.roots, id, targetId, zone);
    if (plan !== undefined) await this.moveTo(id, plan);
  };
}
