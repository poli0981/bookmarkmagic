/**
 * File output — docs/01 §3, docs/03 §1 step 6b, docs/03 §2.
 *
 * Purpose: get generated text onto the user's disk with no `downloads`
 *   permission.
 * Guarantees: two paths, deliberately different.
 *   - `triggerDownload` — anchor + Blob URL. Fire-and-forget: the browser
 *     gives NO success signal, so this is only for exports the user asked for.
 *   - `saveWithPicker` — `showSaveFilePicker`, which resolves only once bytes
 *     are written and throws `AbortError` on cancel. That definite signal is
 *     what the forced safety backup needs before anything is deleted.
 * Neither needs a manifest permission.
 */
import { BmBackupError } from './errors';

/** Characters that are illegal in a filename on Windows (T7 in docs/09 §2). */
export function sanitizeFilename(name: string): string {
  return name
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Anchor-download a string. Returns immediately; success is unobservable. */
export function triggerDownload(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = sanitizeFilename(filename);
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    // Revoke on the next task so the download has picked the blob up.
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 0);
  }
}

interface FileSystemWritable {
  write: (data: string) => Promise<void>;
  close: () => Promise<void>;
}
interface FileSystemHandle {
  createWritable: () => Promise<FileSystemWritable>;
}
type SaveFilePicker = (options: {
  suggestedName?: string;
  types?: { description: string; accept: Record<string, string[]> }[];
}) => Promise<FileSystemHandle>;

export function isPickerAvailable(): boolean {
  return typeof (globalThis as { showSaveFilePicker?: unknown }).showSaveFilePicker === 'function';
}

export type SaveTarget = FileSystemHandle;

/**
 * Ask the user where to save, returning a handle.
 *
 * Deliberately split from the write. `showSaveFilePicker` needs transient
 * activation, so it MUST run before anything is awaited in the click handler;
 * reading the bookmark tree first would burn the activation window on exactly
 * the largest profiles — the users with the most to lose.
 *
 * @throws {BmBackupError} `BACKUP_CANCELLED` when the dialog is dismissed.
 */
export async function openSaveTarget(filename: string, mimeType: string): Promise<SaveTarget> {
  const picker = (globalThis as { showSaveFilePicker?: SaveFilePicker }).showSaveFilePicker;
  if (picker === undefined) {
    throw new BmBackupError('BACKUP_WRITE_FAILED', 'showSaveFilePicker unavailable');
  }

  try {
    return await picker({
      suggestedName: sanitizeFilename(filename),
      types: [
        { description: 'Bookmark backup', accept: { [mimeType]: [`.${extensionOf(filename)}`] } },
      ],
    });
  } catch (cause) {
    if (cause instanceof Error && cause.name === 'AbortError') {
      throw new BmBackupError('BACKUP_CANCELLED', 'the save dialog was dismissed');
    }
    throw new BmBackupError(
      'BACKUP_WRITE_FAILED',
      cause instanceof Error ? cause.message : undefined,
    );
  }
}

/** Write to a handle. Resolving here PROVES the bytes reached disk. */
export async function writeToTarget(target: SaveTarget, content: string): Promise<void> {
  try {
    const writable = await target.createWritable();
    await writable.write(content);
    await writable.close();
  } catch (cause) {
    throw new BmBackupError(
      'BACKUP_WRITE_FAILED',
      cause instanceof Error ? cause.message : undefined,
    );
  }
}

function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot === -1 ? 'json' : filename.slice(dot + 1);
}

/** `bookmarks-<scope>-YYYYMMDD-HHmm.<ext>` / backup name — docs/04 §5. */
export function timestampSuffix(now: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
}
