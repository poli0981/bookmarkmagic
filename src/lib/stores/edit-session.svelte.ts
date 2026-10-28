/**
 * The #edit tab's state and commands — docs/03 §3, docs/06 §3.3.
 *
 * Purpose: the one object EditTab holds. Three layers, one file each:
 *   `edit-view` (what the tree shows), `edit-commands` (single-item writes),
 *   and this file — the duplicate finder and the two bulk commands, keep the
 *   first copy of each link and sort a folder A→Z.
 * Lifetime: one instance per EditTab mount. Nothing here needs to outlive the
 *   tab — the tree is re-read on entry anyway.
 * Guarantees: a bulk command runs under the cross-tab write lock and holds
 *   `busy` for exactly its duration; only the command that set it clears it,
 *   and a second one asked for meanwhile does nothing (v1.1.0 review).
 */
import { describeError } from '../browser/describe-error';
import { record } from '../browser/diagnostics';
import { withWriteLock } from '../browser/write-lock';
import { yieldToEventLoop } from '../browser/write-queue';
import { findDuplicateGroups } from '../core/dedupe';
import { deleteEach } from '../edit/bulk-delete';
import { extraCopyIds, flattenTree, toEditNode } from '../edit/edit-node';
import { type EditNode, moveNode, removeNode } from '../edit/patch-tree';
import { applySort, planSort, type SortMove } from '../edit/sort';
import { type BulkProgress, EditCommands } from './edit-commands.svelte';

export interface PendingSort {
  folder: EditNode;
  moves: SortMove[];
}

type BulkFailure = BulkProgress & { error: unknown };

export class EditSession extends EditCommands {
  showDuplicates = $state(false);
  pendingKeepFirst = $state(false);
  pendingSort = $state<PendingSort | undefined>();

  /**
   * Scanned only while something shows it. 1.0.x rescanned the whole tree for
   * duplicates on every live event, panel open or not. Managed copies are
   * left out: the browser refuses to delete them, so offering it is a lie.
   */
  readonly duplicateGroups = $derived(
    this.showDuplicates || this.pendingKeepFirst
      ? findDuplicateGroups(
          // One entry per id: should the view ever hold a node twice, it must
          // never be offered as a duplicate of itself.
          [...new Map(flattenTree(this.roots).map((node) => [node.id, node])).values()].filter(
            (node) => node.url !== undefined && this.isEditable(node),
          ),
        )
      : [],
  );

  /** Any folder with two or more children that is not policy-managed, roots included. */
  canSort = (node: EditNode): boolean =>
    node.url === undefined && node.unmodifiable === undefined && (node.children?.length ?? 0) > 1;

  keepFirst = async (): Promise<void> => {
    this.pendingKeepFirst = false;
    if (this.busy) return;
    // Snapshot first: duplicateGroups is derived from `roots`, which the loop rewrites.
    const doomed = extraCopyIds(this.duplicateGroups);
    await this.bulk(async () => {
      record({ kind: 'edit', action: 'keep-first', count: doomed.length });
      const outcome = await deleteEach(doomed, this.api.remove, (id) => {
        this.roots = removeNode(this.roots, id);
      });
      return outcome.error === undefined
        ? undefined
        : { error: outcome.error, done: outcome.deleted, total: outcome.total, kind: 'delete' };
    });
  };

  /** Plan first, so the confirmation can say exactly how many items move. */
  requestSort = (folder: EditNode): boolean => {
    if (this.busy || !this.canSort(folder)) return false;
    const moves = planSort(folder.children ?? [], this.locale());
    if (moves.length === 0) return false;
    this.pendingSort = { folder, moves };
    return true;
  };

  confirmSort = async (): Promise<void> => {
    const pending = this.pendingSort;
    this.pendingSort = undefined;
    if (pending === undefined || this.busy) return;
    const { folder } = pending;
    await this.bulk(async () => {
      // Re-planned from the folder as it is NOW: the confirmation can stay
      // open while items move in or out, and the stale plan pulled an item
      // moved elsewhere back into this folder.
      const moves = planSort(
        (await this.api.getChildren(folder.id)).map(toEditNode),
        this.locale(),
      );
      record({ kind: 'edit', action: 'sort', count: moves.length });
      const outcome = await applySort(
        moves,
        (step) => this.api.move(step.id, { parentId: folder.id, index: step.index }),
        (step) => {
          this.roots = moveNode(this.roots, step.id, folder.id, step.index);
        },
        yieldToEventLoop,
      );
      return outcome.error === undefined
        ? undefined
        : { error: outcome.error, done: outcome.done, total: outcome.total, kind: 'sort' };
    });
  };

  /**
   * Run a bulk command under the cross-tab write lock. Neither can be undone,
   * so a refusal part-way says how far it got, and the tree is re-read as it
   * really is.
   */
  private bulk = async (run: () => Promise<BulkFailure | undefined>): Promise<void> => {
    this.actionError = undefined;
    this.busy = true;
    try {
      const failure = await withWriteLock(run);
      if (failure === undefined) return;
      const { error, ...partial } = failure;
      this.actionError = { ...describeError(error), partial };
      await this.load();
    } catch (err) {
      // Refused before anything changed: another tab holds the lock, or the
      // re-plan could not read the folder. There is no "x of y" to report.
      this.actionError = describeError(err);
    } finally {
      this.busy = false;
    }
  };
}
