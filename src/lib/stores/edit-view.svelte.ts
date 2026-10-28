/**
 * What the #edit tree shows — docs/03 §3, docs/06 §3.3.
 *
 * Purpose: the view half of the Edit tab's state — the tree as last read,
 *   which folders are open, the focus, the pending rename, the search. The
 *   commands that write to the browser live in `edit-session.svelte.ts`, which
 *   extends this class.
 * Guarantees: nothing here writes to the browser. `repairFocus` keeps the
 *   focus and the rename box on rows that are actually rendered: a focus on a
 *   row that is not on screen left `aria-activedescendant` dangling, and a
 *   rename pending on one left every tree key ignored (v1.1.0 review).
 */
import { searchTree } from '../core/search';
import { flattenTree } from '../edit/edit-node';
import { nearestShownAncestor, parentIndex } from '../edit/focus-repair';
import type { EditNode } from '../edit/patch-tree';
import {
  collapseSearchExpansion,
  forgetSearchExpansion,
  mergeSearchExpansion,
} from '../edit/search-expansion';
import { visibleRows } from '../edit/tree-keyboard';

const SEARCH_DEBOUNCE_MS = 150;

function without(set: ReadonlySet<string>, ids: readonly string[]): ReadonlySet<string> {
  if (!ids.some((id) => set.has(id))) return set;
  const next = new Set(set);
  for (const id of ids) next.delete(id);
  return next;
}

export class EditView {
  // `.raw`: every update replaces these immutably, and a deep proxy over a
  // 100k-node tree is pure cost.
  roots = $state.raw<EditNode[]>([]);
  expanded = $state.raw<ReadonlySet<string>>(new Set());
  /** Folders the search opened, closed again when it clears. */
  searchOpened = $state.raw<ReadonlySet<string>>(new Set());
  /** Folders the user closed during this search; forgotten when the text changes. */
  searchClosed = $state.raw<ReadonlySet<string>>(new Set());

  focusedId = $state<string | undefined>();
  renamingId = $state<string | undefined>();
  query = $state('');
  debounced = $state('');

  readonly search = $derived(searchTree(this.roots, this.debounced));
  readonly filtering = $derived(this.debounced.trim() !== '');
  readonly rows = $derived(
    visibleRows(this.roots, this.expanded, this.filtering ? this.search.visible : undefined),
  );
  /** Rebuilt when the tree changes, not on every key. */
  private readonly parents = $derived(parentIndex(this.roots));
  /** The index as it was while the focused row was last on screen: a deleted row is only in there. */
  private lastParents: ReadonlyMap<string, string | undefined> = new Map();
  private debounceTimer: ReturnType<typeof setTimeout> | undefined;

  setQuery = (value: string): void => {
    this.query = value;
    if (this.debounceTimer !== undefined) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.applyQuery(value), SEARCH_DEBOUNCE_MS);
  };

  clearSearch = (): void => {
    if (this.debounceTimer !== undefined) clearTimeout(this.debounceTimer);
    this.query = '';
    this.applyQuery('');
  };

  private applyQuery(value: string): void {
    if (value === this.debounced) return;
    this.debounced = value;
    this.searchClosed = new Set();
  }

  toggle = (id: string): void => {
    const next = new Set(this.expanded);
    const closing = next.has(id);
    if (closing) next.delete(id);
    else next.add(id);
    this.expanded = next;
    // Touching a folder makes it the user's: clearing the search keeps it.
    this.searchOpened = forgetSearchExpansion(this.searchOpened, id);
    if (!this.filtering) return;
    this.searchClosed = closing
      ? new Set([...this.searchClosed, id])
      : without(this.searchClosed, [id]);
  };

  expandAll = (): void => {
    this.expanded = new Set(
      flattenTree(this.roots)
        .filter((node) => node.url === undefined)
        .map((node) => node.id),
    );
    // Every folder is open by the user's own hand now.
    this.searchOpened = new Set();
    this.searchClosed = new Set();
  };

  collapseAll = (): void => {
    this.expanded = new Set();
    this.searchOpened = new Set();
    // As deliberate as collapsing each folder in turn.
    this.searchClosed = this.filtering ? new Set(this.search.expand) : new Set();
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
    const merged = mergeSearchExpansion(
      this.expanded,
      wanted,
      this.searchOpened,
      this.searchClosed,
    );
    if (merged.expanded === this.expanded) return;
    this.expanded = merged.expanded;
    this.searchOpened = merged.opened;
  };

  /**
   * Open every folder above `id`, as the user's own: a search clearing later
   * does not close them again. What `newFolder` needs before the rename box of
   * a folder created under a collapsed or search-opened parent can mount.
   */
  reveal = (id: string): void => {
    const above: string[] = [];
    for (let up = this.parents.get(id); up !== undefined; up = this.parents.get(up)) {
      above.push(up);
    }
    this.expanded = new Set([...this.expanded, ...above]);
    this.searchOpened = without(this.searchOpened, above);
    this.searchClosed = without(this.searchClosed, above);
  };

  /**
   * Keep the focus and the rename box on rendered rows. Called from the
   * component's effect whenever the rows or the focus change: a focus that
   * left the screen moves to its nearest visible folder, and a rename whose
   * row is hidden is dropped.
   */
  repairFocus = (): void => {
    const id = this.focusedId;
    const renaming = this.renamingId;
    if (id === undefined && renaming === undefined) return;
    const shown = new Set(this.rows.map((row) => row.node.id));
    if (renaming !== undefined && !shown.has(renaming)) this.renamingId = undefined;
    if (id === undefined) return;
    if (shown.has(id)) {
      this.lastParents = this.parents;
      return;
    }
    const parents = this.parents.has(id) ? this.parents : this.lastParents;
    this.focusedId = nearestShownAncestor(id, parents, shown);
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

  dispose = (): void => {
    if (this.debounceTimer !== undefined) clearTimeout(this.debounceTimer);
  };
}
