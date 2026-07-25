import { afterEach, describe, expect, it, vi } from 'vitest';
import { openSaveTarget, type SaveTarget } from '@/lib/browser/download';
import type { BookmarkNode } from '@/lib/core/model';
import { proveBackup } from '@/lib/import/run-import';

type PickerHost = { showSaveFilePicker?: unknown };

const TREE: BookmarkNode[] = [
  { title: 'Bar', toolbar: true, children: [{ title: 'a', url: 'https://a.example/' }] },
];

const NOW = new Date(2026, 6, 25, 14, 5);
const FILENAME = 'bookmarkmagic-backup-20260725-1405.json';

afterEach(() => {
  delete (globalThis as PickerHost).showSaveFilePicker;
  vi.restoreAllMocks();
});

/**
 * The forced backup gate — docs/03 §1 step 6b.
 *
 * Every test here exists so Replace can never delete bookmarks it did not
 * first prove were saved.
 */
describe('proveBackup — picker path', () => {
  it('writes the snapshot and resolves only once the handle is closed', async () => {
    const written: string[] = [];
    const close = vi.fn(async () => undefined);
    const target: SaveTarget = {
      createWritable: async () => ({
        write: async (data: string) => {
          written.push(data);
        },
        close,
      }),
    };

    await proveBackup(TREE, NOW, FILENAME, Promise.resolve(target), undefined);

    expect(close).toHaveBeenCalledOnce();
    expect(written[0]).toContain('"format": "bookmarkmagic"');
    expect(written[0]).toContain('https://a.example/');
    // The toolbar marker must survive, or restoring the backup empties the bar.
    expect(written[0]).toContain('"toolbar": true');
  });

  it('propagates a cancelled picker as BACKUP_CANCELLED and writes nothing', async () => {
    const abort = new Error('dismissed');
    abort.name = 'AbortError';
    (globalThis as PickerHost).showSaveFilePicker = vi.fn(async () => {
      throw abort;
    });
    const pending = openSaveTarget(FILENAME, 'application/json');

    await expect(proveBackup(TREE, NOW, FILENAME, pending, undefined)).rejects.toMatchObject({
      name: 'BmBackupError',
      code: 'BACKUP_CANCELLED',
    });
  });

  it('surfaces a failed write as BACKUP_WRITE_FAILED', async () => {
    const target: SaveTarget = {
      createWritable: async () => ({
        write: async () => {
          throw new Error('disk full');
        },
        close: async () => undefined,
      }),
    };

    await expect(
      proveBackup(TREE, NOW, FILENAME, Promise.resolve(target), undefined),
    ).rejects.toMatchObject({ code: 'BACKUP_WRITE_FAILED' });
  });
});

describe('proveBackup — anchor fallback', () => {
  const stubAnchor = (): ReturnType<typeof vi.spyOn> => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fake');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    return vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  };

  it('REJECTS when the user does not confirm — nothing may be deleted', async () => {
    // The anchor download reports nothing, so an unconfirmed fallback must be
    // treated as failure. Getting this wrong deletes every bookmark the user
    // owns with no backup on disk.
    const click = stubAnchor();
    await expect(
      proveBackup(TREE, NOW, FILENAME, undefined, async () => false),
    ).rejects.toMatchObject({ code: 'BACKUP_CANCELLED' });
    expect(click).toHaveBeenCalledOnce();
  });

  it('REJECTS when no confirmation callback is supplied at all', async () => {
    stubAnchor();
    await expect(proveBackup(TREE, NOW, FILENAME, undefined, undefined)).rejects.toMatchObject({
      code: 'BACKUP_CANCELLED',
    });
  });

  it('resolves once the user confirms they have the file', async () => {
    const click = stubAnchor();
    await expect(
      proveBackup(TREE, NOW, FILENAME, undefined, async () => true),
    ).resolves.toBeUndefined();
    expect(click).toHaveBeenCalledOnce();
  });

  it('asks for confirmation only AFTER the download was triggered', async () => {
    const order: string[] = [];
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fake');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {
      order.push('download');
    });

    await proveBackup(TREE, NOW, FILENAME, undefined, async () => {
      order.push('confirm');
      return true;
    });

    expect(order).toEqual(['download', 'confirm']);
  });
});
