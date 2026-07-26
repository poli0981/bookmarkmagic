/**
 * The import pipeline — docs/03 §1, steps 2 through 9.
 *
 * Purpose: one place that sequences validate → detect → parse → diff → plan →
 *   backup → clear → write, so the Svelte component stays presentational.
 * Guarantees: steps 1-7 touch nothing in the browser, and in Replace mode
 *   NOTHING is deleted until the safety backup is proven — either by the file
 *   picker resolving, or by the user explicitly confirming the fallback
 *   download (docs/03 §1 step 6b).
 */
import { getAppVersion } from '../browser/app-info';
import { clearRoots, getRootChildren, getRoots, toBookmarkNodes } from '../browser/bookmarks';
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
import { buildUrlIndex } from '../core/dedupe';
import { detectFormat } from '../core/detect-format';
import { diffAgainstBrowser, type NodeStatus } from '../core/diff';
import { MAX_FILE_BYTES } from '../core/limits';
import { BmParseError, type BookmarkNode, type ImportPlan, type ParseResult } from '../core/model';
import { parseBmJson } from '../core/parse/bm-json';
import { parseCsv } from '../core/parse/csv';
import { parseNetscapeHtml } from '../core/parse/netscape-html';
import { buildImportPlan } from '../core/plan';
import { serializeBmJson } from '../core/serialize/bm-json';

const PARSERS = {
  'netscape-html': parseNetscapeHtml,
  'bm-json': parseBmJson,
  csv: parseCsv,
} as const;

export interface PreparedImport {
  result: ParseResult;
  /** Bookmarks in the file whose URL already exists in the browser. */
  duplicates: number;
  /** Per-node badges for the preview tree. */
  status: WeakMap<BookmarkNode, NodeStatus>;
  /** Preview-time snapshot. Used for the diff and dedupe index ONLY. */
  browserIndex: Set<string>;
}

/**
 * Steps 2-5: validate, sniff, parse, and diff against the current tree.
 *
 * @throws {BmParseError} `FILE_TOO_LARGE`, plus anything the parsers raise.
 */
export async function prepareImport(file: File): Promise<PreparedImport> {
  if (file.size > MAX_FILE_BYTES) {
    throw new BmParseError(
      'FILE_TOO_LARGE',
      `${Math.round(file.size / 1024 / 1024)} MB exceeds the ${Math.round(MAX_FILE_BYTES / 1024 / 1024)} MB limit`,
    );
  }

  // Blob.text() is UTF-8 decode, which consumes a leading BOM for us.
  const text = await file.text();
  const format = detectFormat(text);
  const result = PARSERS[format](text);

  const browserIndex = buildUrlIndex(toBookmarkNodes(await getRootChildren()));
  const { existsCount, status } = diffAgainstBrowser(result.roots, browserIndex);

  return { result, duplicates: existsCount, status, browserIndex };
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

/**
 * Steps 6b-8: forced backup (Replace only), then the write.
 *
 * Ordering is load-bearing and is why this reads as it does:
 *  1. The picker is opened FIRST, before any `await`, so transient activation
 *     still holds. Only the handle is activation-gated; writing is not.
 *  2. The live tree is read ONCE. The backup is serialized from that exact
 *     read and `clearRoots` deletes those exact nodes, so the backup is
 *     provably a superset of what is removed. Serializing a preview-time
 *     snapshot instead would silently lose anything bookmarked in between.
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

  const roots = await getRoots();

  if (mode === 'replace') {
    const snapshot = toBookmarkNodes(roots.writable, { toolbarId: roots.toolbarId });
    await proveBackup(snapshot, now, backupFilename, pendingTarget, options.confirmUnprovenBackup);
    options.onClearing?.();
    if (signal.aborted) throw new BmAborted(0);
    await clearRoots(roots.writable, signal);
  }

  const plan = buildImportPlan({
    roots: prepared.result.roots,
    mode,
    dedupe,
    browserIndex: prepared.browserIndex,
    toolbarRootId: roots.toolbarId,
    otherRootId: roots.otherId,
    newFolderTitle,
  });

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
    content = serializeBmJson(snapshot, {
      version: getAppVersion(),
      exportedAt: now.toISOString(),
    });
  } catch (cause) {
    throw new BmBackupError(
      'BACKUP_SERIALIZE_FAILED',
      cause instanceof Error ? cause.message : undefined,
    );
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
