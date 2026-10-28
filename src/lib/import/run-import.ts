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
  getRootChildren,
  getRoots,
  rootMarkersOf,
  toBookmarkNodes,
} from '../browser/bookmarks';
import {
  isPickerAvailable,
  openSaveTarget,
  type SaveTarget,
  timestampSuffix,
  triggerDownload,
  writeToTarget,
} from '../browser/download';
import { BmAborted, BmBackupError } from '../browser/errors';
import type { ImportMode } from '../browser/storage';
import { type WriteProgress, writeTree } from '../browser/write-queue';
import { textCapsBreach, treeCapsBreach } from '../core/caps';
import { buildUrlIndex } from '../core/dedupe';
import { diffAgainstBrowser, type NodeStatus } from '../core/diff';
import { MAX_FILE_BYTES } from '../core/limits';
import {
  BmParseError,
  type BookmarkNode,
  type FileFormat,
  type ImportPlan,
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

  const browserIndex = buildUrlIndex(await getRootChildren());
  const { existsCount, status } = diffAgainstBrowser(result.roots, browserIndex);

  return { format, result, duplicates: existsCount, status, browserIndex };
}

export interface RunImportOptions {
  prepared: PreparedImport;
  mode: ImportMode;
  dedupe: boolean;
  /** Localized wrapper title for new-folder mode. */
  newFolderTitle: string;
  /** Localized backup filename. */
  backupFilename?: string;
  now: Date;
  signal: AbortSignal;
  onProgress: (progress: WriteProgress) => void;
  /** Backup proven; deletion is about to start. */
  onClearing?: () => void;
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
  const { prepared, mode, dedupe, newFolderTitle, now, signal, onProgress } = options;

  // MUST be the first statement — see (1) above. Nothing is awaited before it.
  const backupFilename =
    options.backupFilename ?? `bookmarkmagic-backup-${timestampSuffix(now)}.json`;
  const pendingTarget: Promise<SaveTarget> | undefined =
    mode === 'replace' && isPickerAvailable()
      ? openSaveTarget(backupFilename, 'application/json')
      : undefined;
  // Marks the rejection handled. If reading or planning fails below, nothing
  // ever awaits the dialog, and a later Cancel would surface as an unhandled
  // rejection; `proveBackup` still receives it when it does await.
  pendingTarget?.catch(() => undefined);

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

  if (mode === 'replace') {
    const snapshot = toBookmarkNodes(roots.writable, rootMarkersOf(roots));
    await proveBackup(snapshot, now, backupFilename, pendingTarget, options.confirmUnprovenBackup);
    options.onClearing?.();
    if (signal.aborted) throw new BmAborted(0);
    await clearRoots(roots.writable, signal);
  }

  const { created } = await writeTree(plan, { signal, onProgress });
  return { plan, created };
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
): Promise<void> {
  let content: string;
  try {
    content = serializeBackup(snapshot, now);
  } catch (err) {
    // The dialog may still be open, and its eventual answer has nowhere to go.
    pendingTarget?.catch(() => undefined);
    throw err;
  }

  if (pendingTarget !== undefined) {
    // Resolving proves the bytes are on disk; rejection is already a
    // BmBackupError (cancelled or write failure).
    await writeToTarget(await pendingTarget, content);
    return;
  }

  // No picker: the anchor download reports nothing at all, so the ONLY thing
  // standing between the user and an unbacked-up deletion is this confirmation.
  triggerDownload(filename, content, 'application/json');
  const confirmed = (await confirmUnprovenBackup?.()) ?? false;
  if (!confirmed) {
    throw new BmBackupError('BACKUP_CANCELLED', 'the fallback backup was not confirmed');
  }
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
