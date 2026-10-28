/**
 * The #edit tab's state and commands — docs/03 §3, docs/06 §3.3.
 *
 * Purpose: everything EditTab used to hold in a 300-line script block, so the
 *   component is markup and every command is testable against the in-memory
 *   bookmarks fake without mounting anything.
 * Lifetime: one instance per EditTab mount. Nothing here needs to outlive the
 *   tab — the tree is re-read on entry anyway.
 * Guarantees: the browser is the only source of truth. Edits are applied
 *   optimistically and confirmed by the live events; any failure re-reads the
 *   tree instead of restoring a snapshot, which would resurrect rows an
 *   earlier step of a bulk command legitimately deleted.
 */
import {
  create,
  getRootChildren,
  type LiveNode,
  move,
  remove,
  removeTree,
  update,
} from '../browser/bookmarks';
import { type DescribedError, describeError } from '../browser/describe-error';
import { yieldToEventLoop } from '../browser/write-queue';
import { findDuplicateGroups } from '../core/dedupe';
import { searchTree } from '../core/search';
import { deleteEach } from '../edit/bulk-delete';
import {
  isEditable as canEdit,
  extraCopyIds,
  flattenTree,
  resolveNewFolderParent,
  toEditNode,
} from '../edit/edit-node';
import { applyEvents, type LiveEvent } from '../edit/live-sync';
import { canMoveInto, type DropPlan, type DropZone, planDrop } from '../edit/move-target';
import { changeNode, type EditNode, findNode, moveNode, removeNode } from '../edit/patch-tree';
import {
  collapseSearchExpansion,
  forgetSearchExpansion,
  mergeSearchExpansion,
} from '../edit/search-expansion';
import { planSort, type SortMove } from '../edit/sort';
import { visibleRows } from '../edit/tree-keyboard';

/** The slice of `browser/bookmarks.ts` the tab writes through — injectable for tests. */
export interface EditApi {
  getRootChildren: () => Promise<LiveNode[]>;
  create: (details: { parentId: string; title: string }) => Promise<LiveNode>;
  update: (id: string, changes: { title?: string }) => Promise<void>;
  move: (id: string, destination: { parentId?: string; index?: number }) => Promise<void>;
  remove: (id: string) => Promise<void>;
  removeTree: (id: string) => Promise<void>;
}

/** A failed command, shown above the tree rather than replacing it. */
export type ActionError = DescribedError & {
  /** For bulk commands: how far it got before the browser refused. */
  partial?: { done: number; total: number; kind: 'delete' | 'sort' };
};

export interface PendingSort {
  folder: EditNode;
  moves: SortMove[];
}

const BROWSER_API: EditApi = { getRootChildren, create, update, move, remove, removeTree };

const YIELD_EVERY = 25;

export class EditSession {
  // `.raw`: every update replaces these immutably, and a deep proxy over a
  // 100k-node tree is pure cost.
  roots = $state.raw<EditNode[]>([]);
  expanded = $state.raw<ReadonlySet<string>>(new Set());
  searchOpened = $state.raw<ReadonlySet<string>>(new Set());

  loading = $state(true);
  loadError = $state<DescribedError | undefined>();
  focusedId = $state<string | undefined>();
  renamingId = $state<string | undefined>();
  query = $state('');
  debounced = $state('');
  showDuplicates = $state(false);
  pendingDelete = $state<EditNode | undefined>();
  pendingKeepFirst = $state(false);
  pendingSort = $state<PendingSort | undefined>();
  draggingId = $state<string | undefined>();
  movingNode = $state<EditNode | undefined>();
  actionError = $state<ActionError | undefined>();
  /** A bulk command is running; the toolbar and row actions wait for it. */
  busy = $state(false);

  readonly search = $derived(searchTree(this.roots, this.debounced));
  readonly filtering = $derived(this.debounced.trim() !== '');
  readonly rows = $derived(
    visibleRows(this.roots, this.expanded, this.filtering ? this.search.visible : undefined),
  );

  /**
   * Scanned only while something shows it. 1.0.x rescanned the whole tree for
   * duplicates on every live event, panel open or not. Managed copies are
   * left out: the browser refuses to delete them, so offering it is a lie.
   */
  readonly duplicateGroups = $derived(
    this.showDuplicates || this.pendingKeepFirst
      ? findDuplicateGroups(
          flattenTree(this.roots).filter((node) => node.url !== undefined && this.isEditable(node)),
        )
      : [],
  );

  private readonly api: EditApi;
  private readonly locale: () => string;
  private debounceTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(api: EditApi = BROWSER_API, locale: () => string = () => 'en') {
    this.api = api;
    this.locale = locale;
  }

  /** Permanent roots and policy-managed nodes refuse every write — docs/02 §4. */
  isEditable = (node: EditNode): boolean => canEdit(this.roots, node);

  /** Any folder with two or more children that is not policy-managed, roots included. */
  canSort = (node: EditNode): boolean =>
    node.url === undefined && node.unmodifiable === undefined && (node.children?.length ?? 0) > 1;

  canDropInto = (id: string): boolean =>
    this.draggingId !== undefined && canMoveInto(this.roots, this.draggingId, id);

  /**
   * (Re-)read the tree. Keeps what the user had open and focused when the
   * nodes still exist — a resync after a failed edit used to collapse the
   * whole tree and drop the focus.
   */
  load = async (): Promise<void> => {
    try {
      const fresh = (await this.api.getRootChildren()).map(toEditNode);
      const firstLoad = this.roots.length === 0;
      this.roots = fresh;
      if (firstLoad) this.expanded = new Set(fresh.map((root) => root.id));
      if (this.focusedId !== undefined && findNode(fresh, this.focusedId) === undefined) {
        this.focusedId = undefined;
      }
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

  setQuery = (value: string): void => {
    this.query = value;
    if (this.debounceTimer !== undefined) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.debounced = value;
    }, 150);
  };

  toggle = (id: string): void => {
    const next = new Set(this.expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.expanded = next;
    // Touching a folder makes it the user's: clearing the search keeps it.
    this.searchOpened = forgetSearchExpansion(this.searchOpened, id);
  };

  expandAll = (): void => {
    this.expanded = new Set(
      flattenTree(this.roots)
        .filter((node) => node.url === undefined)
        .map((node) => node.id),
    );
  };

  collapseAll = (): void => {
    this.expanded = new Set();
    this.searchOpened = new Set();
  };

  /**
   * Merge search-opened folders INTO `expanded` (so the disclosure button and
   * ArrowLeft work on them), and close exactly those again when the search
   * clears. Called from the component's effect, which tracks the search only.
   */
  syncSearchExpansion = (wanted: ReadonlySet<string>, active: boolean): void => {
    if (!active) {
      if (this.searchOpened.size === 0) return;
      this.expanded = collapseSearchExpansion(this.expanded, this.searchOpened);
      this.searchOpened = new Set();
      return;
    }
    const merged = mergeSearchExpansion(this.expanded, wanted, this.searchOpened);
    if (merged.expanded === this.expanded) return;
    this.expanded = merged.expanded;
    this.searchOpened = merged.opened;
  };

  private guard = async (run: () => Promise<void>): Promise<boolean> => {
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

  confirmDelete = async (): Promise<string | undefined> => {
    const node = this.pendingDelete;
    this.pendingDelete = undefined;
    if (node === undefined || !this.isEditable(node)) return undefined;
    const next = this.neighbourOf(node.id);
    const ok = await this.guard(async () => {
      this.roots = removeNode(this.roots, node.id);
      if (node.url === undefined) await this.api.removeTree(node.id);
      else await this.api.remove(node.id);
    });
    if (ok) this.focusedId = next;
    return ok ? next : undefined;
  };

  /** The row focus should land on when `id` disappears: the next one, else the previous. */
  neighbourOf = (id: string): string | undefined => {
    const index = this.rows.findIndex((row) => row.node.id === id);
    if (index === -1) return undefined;
    // Skip the node's own descendants, which disappear with it.
    const depth = this.rows[index]?.depth ?? 0;
    const after = this.rows.slice(index + 1).find((row) => row.depth <= depth);
    return after?.node.id ?? this.rows[index - 1]?.node.id;
  };

  newFolder = async (title: string): Promise<void> => {
    const parentId = resolveNewFolderParent(this.roots, findNode(this.roots, this.focusedId ?? ''));
    if (parentId === undefined) return;
    await this.guard(async () => {
      const created = await this.api.create({ parentId, title });
      // The row must be visible before the rename input can mount: open the
      // parent, and leave a search that would hide the new folder (uM2).
      this.expanded = new Set([...this.expanded, parentId]);
      if (this.filtering) {
        this.query = '';
        this.debounced = '';
      }
      this.focusedId = created.id;
      this.renamingId = created.id;
    });
  };

  keepFirst = async (): Promise<void> => {
    this.pendingKeepFirst = false;
    // Snapshot first: duplicateGroups is derived from `roots`, which the loop rewrites.
    const doomed = extraCopyIds(this.duplicateGroups);
    this.actionError = undefined;
    this.busy = true;
    try {
      const outcome = await deleteEach(doomed, this.api.remove, (id) => {
        this.roots = removeNode(this.roots, id);
      });
      if (outcome.error === undefined) return;
      // The dialog promised an exact number; after a partial failure the
      // user must learn how many copies are left.
      this.actionError = {
        ...describeError(outcome.error),
        partial: { done: outcome.deleted, total: outcome.total, kind: 'delete' },
      };
      await this.load();
    } finally {
      this.busy = false;
    }
  };

  /** Shared by drag & drop and the keyboard "Move to…" dialog. */
  moveTo = async (id: string, plan: DropPlan): Promise<void> => {
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

  /** Plan first, so the confirmation can say exactly how many items move. */
  requestSort = (folder: EditNode): boolean => {
    if (!this.canSort(folder)) return false;
    const moves = planSort(folder.children ?? [], this.locale());
    if (moves.length === 0) return false;
    this.pendingSort = { folder, moves };
    return true;
  };

  /**
   * One awaited move per item, yielding now and then so the tab stays
   * responsive. Sorting is not undoable, so a refusal part-way says how far
   * it got; the folder is then re-read as it really is.
   */
  confirmSort = async (): Promise<void> => {
    const pending = this.pendingSort;
    this.pendingSort = undefined;
    if (pending === undefined) return;
    const { folder, moves } = pending;
    this.actionError = undefined;
    this.busy = true;
    let done = 0;
    try {
      for (const move of moves) {
        await this.api.move(move.id, { parentId: folder.id, index: move.index });
        this.roots = moveNode(this.roots, move.id, folder.id, move.index);
        done++;
        if (done % YIELD_EVERY === 0) await yieldToEventLoop();
      }
    } catch (err) {
      this.actionError = {
        ...describeError(err),
        partial: { done, total: moves.length, kind: 'sort' },
      };
      await this.load();
    } finally {
      this.busy = false;
    }
  };

  dispose = (): void => {
    if (this.debounceTimer !== undefined) clearTimeout(this.debounceTimer);
  };
}
