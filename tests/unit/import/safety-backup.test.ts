import { afterEach, describe, expect, it, vi } from 'vitest';
import { openSaveTarget, type SaveTarget } from '@/lib/browser/download';
import { BmBackupError } from '@/lib/browser/errors';
import { MAX_DEPTH, MAX_NODES } from '@/lib/core/limits';
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

    const savedAs = await proveBackup(TREE, NOW, FILENAME, Promise.resolve(target), undefined);

    expect(close).toHaveBeenCalledOnce();
    // No name on the handle (an older picker): fall back to the suggested one.
    expect(savedAs).toBe(FILENAME);
    const doc = JSON.parse(written[0] ?? '');
    expect(doc.format).toBe('bookmarkmagic');
    // The toolbar marker must survive, or restoring the backup empties the bar.
    expect(doc.roots[0]).toMatchObject({
      toolbar: true,
      children: [{ url: 'https://a.example/' }],
    });
    // Compact: a backup only counts if it fits under the import's size cap.
    expect(written[0]?.trimEnd()).not.toContain('\n');
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
    // The anchor path cannot learn another name, so it reports the one it asked for.
    await expect(proveBackup(TREE, NOW, FILENAME, undefined, async () => true)).resolves.toBe(
      FILENAME,
    );
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

describe('proveBackup — refuses a backup the import could not read back', () => {
  // 1.0.x wrote these, then deleted the tree; the parser refuses them on restore.
  const bar = (children: BookmarkNode[]): BookmarkNode[] => [
    { title: 'Bar', toolbar: true, children },
  ];
  const chain = (depth: number): BookmarkNode => {
    let node: BookmarkNode = { title: 'leaf', children: [] };
    for (let i = 1; i < depth; i++) node = { title: `d${i}`, children: [node] };
    return node;
  };
  const CASES: [string, BookmarkNode[]][] = [
    [
      'more nodes than the import accepts',
      bar(
        Array.from({ length: MAX_NODES }, (_, i) => ({ title: `${i}`, url: 'https://e.example/' })),
      ),
    ],
    ['deeper than the import accepts', [chain(MAX_DEPTH + 1)]],
    [
      'larger than the import accepts',
      bar(
        Array.from({ length: 270 }, (_, i) => ({
          title: `${i}`,
          url: `https://e.example/${'a'.repeat(100_000)}`,
        })),
      ),
    ],
  ];

  it.each(CASES)('%s: nothing is written, downloaded or confirmed', async (_name, tree) => {
    const createWritable = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click');
    const confirm = vi.fn(async () => true);

    await expect(
      proveBackup(tree, NOW, FILENAME, Promise.resolve({ createWritable }), confirm),
    ).rejects.toMatchObject({ code: 'BACKUP_EXCEEDS_LIMITS' });
    await expect(proveBackup(tree, NOW, FILENAME, undefined, confirm)).rejects.toMatchObject({
      code: 'BACKUP_EXCEEDS_LIMITS',
    });

    expect(createWritable).not.toHaveBeenCalled();
    expect(click).not.toHaveBeenCalled();
    expect(confirm).not.toHaveBeenCalled();
  });

  it('settles the still-open picker quietly instead of leaving its rejection unhandled', async () => {
    const late = Promise.reject(new BmBackupError('BACKUP_CANCELLED'));
    await expect(
      proveBackup([chain(MAX_DEPTH + 1)], NOW, FILENAME, late, undefined),
    ).rejects.toMatchObject({ code: 'BACKUP_EXCEEDS_LIMITS' });
  });
});

describe('proveBackup — reports the name the user actually saved under (uM21)', () => {
  it('uses the file handle’s name when the user renamed it in the dialog', async () => {
    const target: SaveTarget = {
      name: 'my-renamed-backup.json',
      createWritable: async () => ({ write: async () => undefined, close: async () => undefined }),
    };
    await expect(
      proveBackup(TREE, NOW, FILENAME, Promise.resolve(target), undefined),
    ).resolves.toBe('my-renamed-backup.json');
  });
});
