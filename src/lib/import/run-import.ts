/**
 * The import pipeline — docs/03 §1, steps 2 through 9.
 *
 * Purpose: one place that sequences validate → sniff/parse → diff → plan →
 *   backup → clear → write, so the Svelte component stays presentational.
 * Guarantees: steps 1-7 touch nothing in the browser. The plan is built — and
 *   can fail — before the backup is taken, and in Replace mode NOTHING is
 *   deleted until that backup is proven: by the file picker resolving, or by
 *   the user explicitly confirming the fallback download (docs/03 §1 step 6b).
 *   A backup the import could not read back is refused before anything at all
 *   is written, downloaded or deleted.
 */
import { getGeneratorVersion } from '../browser/app-info';
import {
  type BookmarkRoots,
  clearRoots,
  getRoots,
  type LiveNode,
  rootMarkersOf,
  toBookmarkNodes,
} from '../browser/bookmarks';
import { record } from '../browser/diagnostics';
import {
  discardTarget,
  isPickerAvailable,
  openSaveTarget,
  type SaveTarget,
  backupFilename as suggestBackupName,
  triggerDownload,
  writeToTarget,
} from '../browser/download';
import { BmAborted, BmBackupError } from '../browser/errors';
import type { ImportMode } from '../browser/storage';
import { withWriteLock } from '../browser/write-lock';
import { type WriteProgress, writeTree } from '../browser/write-queue';
import { textCapsBreach, treeCapsBreach } from '../core/caps';
import { buildUrlIndex } from '../core/dedupe';
import { diffAgainstBrowser, type NodeStatus } from '../core/diff';
import { MAX_FILE_BYTES, MAX_WRITE_DEPTH } from '../core/limits';
import {
  BmParseError,
  type BookmarkNode,
  computeStats,
  type FileFormat,
  type ImportPlan,
  type MergeMode,
  type ParseResult,
} from '../core/model';
import type { RootTitles } from '../core/parse/shared';
import { parseBookmarkFile } from '../core/parse-file';
import { buildImportPlan, type PlanDestinations } from '../core/plan';
import { serializeBmJson } from '../core/serialize/bm-json';

export interface PreparedImport {
  /** What the file was read as — sniffed from the content (docs/04 intro). */
  format: FileFormat;
  result: ParseResult;
  /** Bookmarks in the file whose URL already exists in the browser. */
  duplicates: number;
  /** Per-node badges for the preview tree. */
  status: WeakMap<BookmarkNode, NodeStatus>;
  /** Preview-time snapshot, for the badges. The write dedupes against a fresh read. */
  browserIndex: Set<string>;
  /** The live roots at preview time — what the Start button's preview plan is built against. */
  destinations: PlanDestinations;
  /** Everything inside the writable roots: what Replace would delete (docs/09 T4). */
  current: { bookmarks: number; folders: number };
}

export interface PrepareOptions {
  /** Localized names for roots a file names only by key (Firefox) — docs/04 §2b. */
  rootTitles?: RootTitles;
}

/**
 * Steps 2-5: validate, sniff, parse, and diff against the current tree.
 *
 * @throws {BmParseError} `FILE_TOO_LARGE`, plus anything the parsers raise.
 */
export async function prepareImport(
  file: File,
  options: PrepareOptions = {},
): Promise<PreparedImport> {
  if (file.size > MAX_FILE_BYTES) {
    throw new BmParseError(
      'FILE_TOO_LARGE',
      `${Math.round(file.size / 1024 / 1024)} MB exceeds the ${Math.round(MAX_FILE_BYTES / 1024 / 1024)} MB limit`,
    );
  }

  // Blob.text() is UTF-8 decode, which consumes a leading BOM for us.
  const text = await file.text();
  const { format, result } = parseBookmarkFile(text, options);
  record({
    kind: 'import',
    phase: 'parsed',
    format,
    nodes: result.stats.bookmarks + result.stats.folders,
  });

  // One read: getRoots walks the whole tree, so the index and the counts come
  // from the same snapshot instead of a second getTree().
  const roots = await getRoots();
  const browserIndex = buildUrlIndex(roots.all);
  const { existsCount, status } = diffAgainstBrowser(result.roots, browserIndex);
  const inside = computeStats(roots.writable.flatMap((root) => root.children ?? []));

  return {
    format,
    result,
    duplicates: existsCount,
    status,
    browserIndex,
    destinations: destinationsOf(roots),
    current: { bookmarks: inside.bookmarks, folders: inside.folders },
  };
}

/**
 * The plan as it would be at Start, from the preview snapshot — for the counts
 * the Start button and the Replace confirmation promise. The write re-plans
 * against a fresh read, so this is a forecast, not the plan.
 */
export function previewPlan(
  prepared: PreparedImport,
  mode: MergeMode,
  dedupe: boolean,
): ImportPlan {
  return buildImportPlan({
    roots: prepared.result.roots,
    mode,
    dedupe,
    browserIndex: prepared.browserIndex,
    destinations: prepared.destinations,
    newFolderTitle: '',
  });
}

export interface RunImportOptions {
  prepared: PreparedImport;
  mode: ImportMode;
  dedupe: boolean;
  /** Localized wrapper title for new-folder mode. */
  newFolderTitle: string;
  /** Localized backup filename. */
  backupFilename?: string;
  /** Localized file-type label for the save dialog. */
  backupDescription?: string;
  now: Date;
  signal: AbortSignal;
  onProgress: (progress: WriteProgress) => void;
  /** Backup proven, under this name (the one the user picked); deletion is about to start. */
  onClearing?: (backupName: string) => void;
  /**
   * Called ONLY on the anchor-download fallback, which gives no success
   * signal. Must resolve true — after the user has actually checked their
   * downloads folder — or nothing is deleted (docs/03 §1 step 6b sub-step 3).
   */
  confirmUnprovenBackup?: () => Promise<boolean>;
}

export interface ImportOutcome {
  plan: ImportPlan;
  created: number;
}

function destinationsOf(roots: BookmarkRoots): PlanDestinations {
  return {
    toolbar: roots.toolbar,
    other: roots.other,
    ...(roots.mobile !== undefined && { mobile: roots.mobile }),
  };
}

/**
 * Steps 6b-8: plan, forced backup (Replace only), then the write.
 *
 * Ordering is load-bearing and is why this reads as it does:
 *  1. The picker is opened FIRST, before any `await`, so transient activation
 *     still holds. Only the handle is activation-gated; writing is not.
 *  2. The live tree is read ONCE. The plan, the backup and `clearRoots` all
 *     work from that exact read, so the backup is provably a superset of what
 *     is removed. Serializing a preview-time snapshot instead would silently
 *     lose anything bookmarked in between.
 *  3. The plan is built before the backup, so anything that can fail in
 *     planning fails while the tree is still whole (docs/03 §1 step 7).
 */
export async function runImport(options: RunImportOptions): Promise<ImportOutcome> {
  const { mode, now } = options;

  // MUST be the first statement — see (1) above. Nothing is awaited before it.
  const backupFilename = options.backupFilename ?? suggestBackupName(now);
  const pendingTarget: Promise<SaveTarget> | undefined =
    mode === 'replace' && isPickerAvailable()
      ? openSaveTarget(backupFilename, 'application/json', options.backupDescription ?? 'JSON')
      : undefined;
  // Marks the rejection handled. If reading or planning fails below, nothing
  // ever awaits the dialog, and a later Cancel would surface as an unhandled
  // rejection; `proveBackup` still receives it when it does await.
  pendingTarget?.catch(() => undefined);

  // One writer across all Manager tabs (docs/03 §5). Taken AFTER the picker:
  // waiting for it first would burn the click's transient activation.
  const backup: BackupState = { written: false };
  try {
    return await withWriteLock(() => writeAll(options, backupFilename, pendingTarget, backup));
  } catch (err) {
    // Stopped before the backup was written (the lock refused, the plan failed,
    // the caps refused): a file the user picked must not be left behind empty.
    if (!backup.written) discardTarget(pendingTarget);
    throw err;
  }
}

interface BackupState {
  /** True once a backup's bytes are on disk — the picked file is then real. */
  written: boolean;
}

/** How many times the backup is re-taken when the tree keeps changing under it. */
const BACKUP_ATTEMPTS = 3;

async function writeAll(
  options: RunImportOptions,
  backupFilename: string,
  pendingTarget: Promise<SaveTarget> | undefined,
  backup: BackupState,
): Promise<ImportOutcome> {
  const { prepared, mode, dedupe, newFolderTitle, signal, onProgress } = options;
  const roots = await getRoots();
  const plan = buildImportPlan({
    roots: prepared.result.roots,
    mode,
    dedupe,
    // Fresh, not the preview's: anything bookmarked since must not be added twice.
    browserIndex: dedupe && mode !== 'replace' ? buildUrlIndex(roots.all) : new Set(),
    destinations: destinationsOf(roots),
    newFolderTitle,
  });

  record({ kind: 'import', phase: `planned:${mode}`, nodes: plan.stats.toCreate });
  // Chrome stores its bookmarks as JSON it re-reads with a 200-level nesting
  // limit, two levels per folder: a deeper tree saves, then fails to load.
  if (plan.stats.writeDepth > MAX_WRITE_DEPTH) {
    throw new BmParseError(
      'TOO_DEEP',
      `the import would nest folders ${plan.stats.writeDepth} deep; Chrome stores at most ${MAX_WRITE_DEPTH}`,
    );
  }

  if (mode === 'replace') {
    const cleared = await backUpThenFreeze(options, backupFilename, pendingTarget, backup, roots);
    if (signal.aborted) throw new BmAborted(0);
    await clearRoots(cleared, signal);
    record({ kind: 'import', phase: 'cleared' });
  }

  const { created } = await writeTree(plan, { signal, onProgress });
  record({ kind: 'import', phase: 'written', nodes: created });
  return { plan, created };
}

/**
 * Take the backup, then make sure it still matches what is about to be
 * deleted — docs/03 §1 step 6b.
 *
 * The tree was read while the save dialog was open, and on the fallback path
 * while the user went to check their Downloads folder, for as long as that
 * took. Sync, another window or another tab could add a bookmark inside an
 * existing folder meanwhile, and the clear would delete it with no copy
 * anywhere. So the tree is read again AFTER the backup is on disk; if it
 * changed, the picker path writes the fresh snapshot to the same file (no new
 * click is needed) and checks again, and the fallback path stops.
 *
 * @returns the roots to clear, from the read the backup matched.
 * @throws {BmBackupError} `BACKUP_STALE` when the tree will not hold still.
 */
async function backUpThenFreeze(
  options: RunImportOptions,
  filename: string,
  pendingTarget: Promise<SaveTarget> | undefined,
  backup: BackupState,
  first: BookmarkRoots,
): Promise<LiveNode[]> {
  const snapshotOf = (roots: BookmarkRoots) =>
    toBookmarkNodes(roots.replaceable, rootMarkersOf(roots));
  let roots = first;
  let content = serializeBackup(snapshotOf(roots), options.now);
  const { savedAs, target } = await writeBackup(
    content,
    filename,
    pendingTarget,
    options.confirmUnprovenBackup,
  );
  backup.written = true;

  for (let attempt = 1; ; attempt++) {
    const fresh = await getRoots();
    const freshContent = serializeBackup(snapshotOf(fresh), options.now);
    if (freshContent === content) {
      roots = fresh;
      break;
    }
    if (target === undefined || attempt >= BACKUP_ATTEMPTS) {
      throw new BmBackupError(
        'BACKUP_STALE',
        'bookmarks changed while the backup was being saved; nothing was deleted',
      );
    }
    await writeToTarget(target, freshContent);
    content = freshContent;
  }

  record({ kind: 'import', phase: 'backup-proven' });
  options.onClearing?.(savedAs);
  return roots.replaceable;
}

/**
 * Serialize the snapshot and get it onto disk, or throw.
 *
 * @throws {BmBackupError} on serialize failure, cancellation, write failure,
 *   or an unconfirmed fallback download. The caller must not delete anything.
 */
export async function proveBackup(
  snapshot: readonly BookmarkNode[],
  now: Date,
  filename: string,
  pendingTarget: Promise<SaveTarget> | undefined,
  confirmUnprovenBackup: (() => Promise<boolean>) | undefined,
): Promise<string> {
  let content: string;
  try {
    content = serializeBackup(snapshot, now);
  } catch (err) {
    // The dialog may still be open, and its eventual answer has nowhere to go.
    pendingTarget?.catch(() => undefined);
    throw err;
  }
  return (await writeBackup(content, filename, pendingTarget, confirmUnprovenBackup)).savedAs;
}

/**
 * Put backup text on disk, provably — through the picked file, or the anchor
 * download plus the user's confirmation.
 *
 * @returns the name it was saved under, and the file handle when there is one
 *   (so a changed tree can be written to the same file again).
 */
async function writeBackup(
  content: string,
  filename: string,
  pendingTarget: Promise<SaveTarget> | undefined,
  confirmUnprovenBackup: (() => Promise<boolean>) | undefined,
): Promise<{ savedAs: string; target?: SaveTarget }> {
  if (pendingTarget !== undefined) {
    // Resolving proves the bytes are on disk; rejection is already a
    // BmBackupError (cancelled or write failure). The dialog lets the user
    // rename the file, so report the name it was actually saved under (uM21).
    const target = await pendingTarget;
    await writeToTarget(target, content);
    return { savedAs: target.name ?? filename, target };
  }

  // No picker: the anchor download reports nothing at all, so the ONLY thing
  // standing between the user and an unbacked-up deletion is this confirmation.
  triggerDownload(filename, content, 'application/json');
  const confirmed = (await confirmUnprovenBackup?.()) ?? false;
  if (!confirmed) {
    throw new BmBackupError('BACKUP_CANCELLED', 'the fallback backup was not confirmed');
  }
  return { savedAs: filename };
}

/**
 * The backup text, or a refusal — docs/03 §1 step 6b, docs/09 T2.
 *
 * Compact (no indentation): about half the size, and a backup only counts if
 * it stays under the cap the import enforces on the way back in. Both caps are
 * checked HERE, before any byte is written: in 1.0.x a large profile got a
 * backup the parser then refused, after the tree had already been deleted.
 *
 * @throws {BmBackupError} `BACKUP_EXCEEDS_LIMITS` or `BACKUP_SERIALIZE_FAILED`.
 */
function serializeBackup(snapshot: readonly BookmarkNode[], now: Date): string {
  const treeBreach = treeCapsBreach(snapshot);
  if (treeBreach !== undefined) throw new BmBackupError('BACKUP_EXCEEDS_LIMITS', treeBreach);

  let content: string;
  try {
    content = serializeBmJson(snapshot, {
      version: getGeneratorVersion(),
      exportedAt: now.toISOString(),
      indent: 0,
    });
  } catch (cause) {
    throw new BmBackupError(
      'BACKUP_SERIALIZE_FAILED',
      cause instanceof Error ? cause.message : undefined,
    );
  }

  const sizeBreach = textCapsBreach(content);
  if (sizeBreach !== undefined) throw new BmBackupError('BACKUP_EXCEEDS_LIMITS', sizeBreach);
  return content;
}
