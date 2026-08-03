/**
 * Sequential tree writer — docs/05 §6.
 *
 * Purpose: create an `ImportPlan`'s nodes in order, with live progress and a
 *   working cancel button.
 * Inputs: a plan, an AbortSignal, a progress callback.
 * Guarantees: parents before children, siblings in order, one `done` counter
 *   across all segments, and an abort that stops before the next create.
 *
 * `chrome.bookmarks` has no bulk insert, so this is one awaited call per node.
 * Order is preserved by creating in order and letting Chrome append.
 */
import type { BookmarkNode, ImportPlan } from '../core/model';
import { create as createNode, type LiveNode } from './bookmarks';
import { BmAborted, BmPartialWrite } from './errors';

/** Emitted every PROGRESS_EVERY creates and once at the end. */
export interface WriteProgress {
  done: number;
  total: number;
  /** Folder path of the node just written, for the "Importing… <path>" line. */
  currentPath: string;
}

export interface WriteOptions {
  signal?: AbortSignal;
  onProgress?: (progress: WriteProgress) => void;
  /** Injectable for tests; defaults to the real adapter. */
  create?: (details: { parentId: string; title: string; url?: string }) => Promise<LiveNode>;
}

const PROGRESS_EVERY = 50;
const YIELD_EVERY = 200;

/**
 * Hand the event loop back so the tab stays responsive during a long import.
 *
 * The parentheses are load-bearing. Written as
 * `await scheduler.yield?.() ?? new Promise(...)` this parses as
 * `(await scheduler.yield?.()) ?? new Promise(...)`, which never yields: below
 * Chrome 129 it awaits `undefined` and discards an un-awaited Promise, and on
 * 129+ `yield()` resolves with `undefined` so it leaks a stray timer each call.
 */
export async function yieldToEventLoop(): Promise<void> {
  const scheduler = (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler;
  await (scheduler?.yield?.() ?? new Promise<void>((resolve) => setTimeout(resolve)));
}

export interface WriteResult {
  created: number;
}

/**
 * Write every segment of a plan.
 *
 * @throws {BmAborted} when the signal fires — carrying the exact number of
 *   nodes already created, so the report can tell the user what landed.
 * @throws {BmPartialWrite} when a create rejects, carrying the same count. A
 *   rejection half-way through leaves real bookmarks in the user's tree; a bare
 *   "the browser refused" gives them no way to know how many.
 */
export async function writeTree(
  plan: ImportPlan,
  options: WriteOptions = {},
): Promise<WriteResult> {
  const { signal, onProgress } = options;
  const create = options.create ?? createNode;
  const total = plan.stats.toCreate;

  // Declared out here on purpose: progress, abort and the final report are
  // whole-import scoped, not per segment.
  let done = 0;
  let sinceYield = 0;

  const report = (currentPath: string): void => {
    onProgress?.({ done, total, currentPath });
  };

  const dfs = async (
    nodes: readonly BookmarkNode[],
    parentId: string,
    trail: readonly string[],
  ): Promise<void> => {
    for (const node of nodes) {
      if (signal?.aborted === true) throw new BmAborted(done);

      let created: LiveNode;
      try {
        created = await create({
          parentId,
          title: node.title,
          ...(node.url !== undefined && { url: node.url }),
        });
      } catch (cause) {
        // Order matters. The abort check above throws from inside this same
        // loop, and wrapping it would relabel every user cancellation as a
        // failure — making `cancelled` unreachable and its copy dead.
        if (cause instanceof BmAborted) throw cause;
        throw new BmPartialWrite('writing', done, cause);
      }

      done++;
      sinceYield++;
      if (done % PROGRESS_EVERY === 0 || done === total) report(trail.join(' / '));
      if (sinceYield >= YIELD_EVERY) {
        sinceYield = 0;
        await yieldToEventLoop();
      }

      if (node.children !== undefined && node.children.length > 0) {
        await dfs(node.children, created.id, [...trail, node.title]);
      }
    }
  };

  for (const segment of plan.segments) {
    await dfs(segment.nodes, segment.rootId, []);
  }

  // Guarantee a final event even when the total was not a multiple of 50 and
  // the plan turned out empty.
  if (done !== total || total === 0) report('');
  return { created: done };
}
