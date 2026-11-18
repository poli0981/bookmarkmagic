import { type LiveNode, type MoveDestination, moveIndexFor } from '@/lib/browser/live-tree';

/**
 * Hand-rolled `bookmarks` mock — docs/11 §4.
 *
 * WXT's fakeBrowser stubs `bookmarks.*` with "not implemented" throws, so this
 * is an in-memory tree with call recording and failure injection. It models the
 * behaviours the write queue depends on: create appends when no index is given,
 * and ids are handed out in creation order.
 *
 * Two flavours (since v1.3.0, docs/11 §4). `chromium` — the default — has the
 * synthetic root "0" and the roots "1"/"2"/"3" with `folderType`, hides an
 * empty Mobile root as desktop Chrome does, and counts a same-folder move's
 * index before the node's removal. `firefox` behaves as Firefox's source says
 * its API does (ext-bookmarks.js, Places' Bookmarks.sys.mjs): GUID roots in
 * the order Menu, Toolbar, Other, Mobile, all four always listed, no
 * `folderType`, a `type` on every node, separators as `{ type: 'separator',
 * url: 'data:' }`, a same-folder move's index read as the final position, and
 * addresses over 65 536 characters refused.
 */
export interface FakeBookmarksOptions {
  /** Throw on the Nth create (1-based), to test partial-failure reporting. */
  failOnCreate?: number;
  /** Throw on the Nth removeTree (1-based) — the Replace path's equivalent. */
  failOnRemoveTree?: number;
  flavour?: 'chromium' | 'firefox';
}

/** Firefox's permanent folders, in `getTree()` order. */
export const FIREFOX_ROOTS = {
  menu: 'menu________',
  toolbar: 'toolbar_____',
  other: 'unfiled_____',
  mobile: 'mobile______',
} as const;

const FIREFOX_MAX_URL = 65_536;

export class FakeBookmarks {
  readonly calls: string[] = [];
  readonly flavour: 'chromium' | 'firefox';
  private readonly nodes = new Map<string, LiveNode>();
  private readonly rootId: string;
  private nextId = 100;
  private createCount = 0;
  private removeCount = 0;
  // An explicit field, not a constructor parameter property: the latter emits
  // runtime code and is rejected by `erasableSyntaxOnly` (docs/10 §2).
  private readonly options: FakeBookmarksOptions;

  constructor(options: FakeBookmarksOptions = {}) {
    this.options = options;
    this.flavour = options.flavour ?? 'chromium';
    if (this.flavour === 'firefox') {
      this.rootId = 'root________';
      this.nodes.set(this.rootId, { id: this.rootId, title: '', type: 'folder', children: [] });
      for (const [id, title] of [
        [FIREFOX_ROOTS.menu, 'Bookmarks Menu'],
        [FIREFOX_ROOTS.toolbar, 'Bookmarks Toolbar'],
        [FIREFOX_ROOTS.other, 'Other Bookmarks'],
        [FIREFOX_ROOTS.mobile, 'Mobile Bookmarks'],
      ] as const) {
        const node: LiveNode = { id, parentId: this.rootId, title, type: 'folder', children: [] };
        this.nodes.set(id, node);
        this.root.children?.push(node);
      }
      return;
    }
    this.rootId = '0';
    // The synthetic root and the three Chromium roots.
    this.nodes.set('0', { id: '0', title: '', children: [] });
    for (const [id, title, folderType] of [
      ['1', 'Bookmarks bar', 'bookmarks-bar'],
      ['2', 'Other bookmarks', 'other'],
      ['3', 'Mobile bookmarks', 'mobile'],
    ] as const) {
      const node: LiveNode = { id, parentId: '0', title, folderType, children: [] };
      this.nodes.set(id, node);
      this.root.children?.push(node);
    }
  }

  private get root(): LiveNode {
    return this.nodes.get(this.rootId) as LiveNode;
  }

  /** Add a policy-managed root, which every write path must skip. */
  addManagedRoot(): LiveNode {
    const node: LiveNode = {
      id: 'managed',
      parentId: this.rootId,
      title: 'Managed bookmarks',
      unmodifiable: 'managed',
      children: [],
    };
    this.nodes.set(node.id, node);
    this.root.children?.push(node);
    return node;
  }

  /** Seed an existing node under a parent, returning its id. */
  seed(parentId: string, node: { title: string; url?: string }): string {
    const created = this.createSync({ parentId, ...node });
    return created.id;
  }

  /** Firefox only: a separator line under a parent, returning its id. */
  addSeparator(parentId: string, index?: number): string {
    if (this.flavour !== 'firefox') throw new Error('Chromium has no separators');
    const parent = this.nodes.get(parentId);
    if (parent?.children === undefined) throw new Error(`no such parent: ${parentId}`);
    const node: LiveNode = {
      id: String(this.nextId++),
      parentId,
      title: '',
      type: 'separator',
      url: 'data:',
    };
    this.nodes.set(node.id, node);
    if (index === undefined) parent.children.push(node);
    else parent.children.splice(index, 0, node);
    return node.id;
  }

  private createSync(details: {
    parentId: string;
    title: string;
    url?: string;
    index?: number;
  }): LiveNode {
    const parent = this.nodes.get(details.parentId);
    if (parent === undefined) throw new Error(`no such parent: ${details.parentId}`);
    if (parent.unmodifiable !== undefined) throw new Error("Can't modify managed bookmarks");
    // Chrome's own rules: an empty url makes a FOLDER, and anything its URL
    // parser refuses is rejected — mid-write, which is why readers skip them.
    const url = details.url === '' ? undefined : details.url;
    if (url !== undefined && !URL.canParse(url)) throw new Error('Invalid URL.');
    if (this.flavour === 'firefox' && url !== undefined && url.length > FIREFOX_MAX_URL) {
      throw new Error('URL too long.');
    }

    const node: LiveNode = {
      id: String(this.nextId++),
      parentId: details.parentId,
      title: details.title,
      ...(url !== undefined && { url }),
      ...(url === undefined && { children: [] }),
      ...(this.flavour === 'firefox' && { type: url === undefined ? 'folder' : 'bookmark' }),
    };
    this.nodes.set(node.id, node);

    const siblings = parent.children ?? [];
    // Omitting index appends — the behaviour the write queue relies on.
    if (details.index === undefined) siblings.push(node);
    else siblings.splice(details.index, 0, node);
    parent.children = siblings;
    return node;
  }

  // --- the API surface the adapter uses -------------------------------------

  /**
   * Like desktop Chrome, an EMPTY Mobile root is left out of the Chromium tree
   * (it still exists, accepts writes, and `get('3')` returns it). Firefox lists
   * all four of its roots, always.
   */
  getTree = async (): Promise<LiveNode[]> => {
    this.calls.push('getTree');
    const root = structuredClone(this.root);
    root.children = (root.children ?? []).filter(
      (node) => !(node.folderType === 'mobile' && (node.children ?? []).length === 0),
    );
    return [root];
  };

  get = async (id: string): Promise<LiveNode[]> => {
    this.calls.push(`get:${id}`);
    const node = this.nodes.get(id);
    if (node === undefined) throw new Error(`Can't find bookmark for id.`);
    const { children: _children, ...bare } = node;
    return [structuredClone(bare)];
  };

  create = async (details: {
    parentId: string;
    title: string;
    url?: string;
    index?: number;
  }): Promise<LiveNode> => {
    this.createCount++;
    this.calls.push(`create:${details.parentId}:${details.title}`);
    if (this.options.failOnCreate === this.createCount) {
      throw new Error(`injected failure on create #${this.createCount}`);
    }
    return this.createSync(details);
  };

  removeTree = async (id: string): Promise<void> => {
    this.removeCount++;
    this.calls.push(`removeTree:${id}`);
    if (this.options.failOnRemoveTree === this.removeCount) {
      throw new Error(`injected failure on removeTree #${this.removeCount}`);
    }
    const node = this.nodes.get(id);
    if (node === undefined) throw new Error(`no such node: ${id}`);
    if (node.unmodifiable !== undefined) throw new Error("Can't modify managed bookmarks");
    const parent = this.nodes.get(node.parentId ?? '');
    if (parent?.children !== undefined) {
      parent.children = parent.children.filter((child) => child.id !== id);
    }
    this.nodes.delete(id);
  };

  /**
   * `bookmarks.move` as the browser has it: resolves to the moved node, with
   * its new `index`. Chromium reads a same-parent index as counted BEFORE the
   * node was removed; Firefox reads it as the final position.
   */
  move = async (
    id: string,
    destination: { parentId?: string; index?: number },
  ): Promise<LiveNode> => {
    this.calls.push(`move:${id}:${destination.parentId ?? ''}:${destination.index ?? ''}`);
    const node = this.nodes.get(id);
    if (node === undefined) throw new Error(`no such node: ${id}`);
    if (node.unmodifiable !== undefined) throw new Error("Can't modify managed bookmarks");
    const from = this.nodes.get(node.parentId ?? '');
    const to = this.nodes.get(destination.parentId ?? node.parentId ?? '');
    if (from?.children === undefined || to === undefined) throw new Error('bad move');
    const oldIndex = from.children.indexOf(node);
    from.children.splice(oldIndex, 1);
    const siblings = to.children ?? [];
    let index = destination.index ?? siblings.length;
    if (this.flavour === 'chromium' && from === to && index > oldIndex) index--;
    const at = Math.min(index, siblings.length);
    siblings.splice(at, 0, node);
    to.children = siblings;
    node.parentId = to.id;
    const { children: _children, ...bare } = node;
    return structuredClone({ ...bare, index: at });
  };

  /**
   * The adapter's `move` (`browser/bookmarks.ts`) over this fake: sends the
   * index this flavour's rule expects and resolves to where the node landed —
   * what an `EditApi` built on the fake passes as its `move`.
   */
  moveTo = async (id: string, destination: MoveDestination): Promise<number | undefined> => {
    const { parentId, position } = destination;
    const moved = await this.move(id, {
      ...(parentId !== undefined && { parentId }),
      ...(position !== undefined && { index: moveIndexFor(position, this.flavour) }),
    });
    return moved.index;
  };

  update = async (id: string, changes: { title?: string; url?: string }): Promise<void> => {
    this.calls.push(`update:${id}`);
    const node = this.nodes.get(id);
    if (node === undefined) throw new Error(`no such node: ${id}`);
    if (changes.title !== undefined) node.title = changes.title;
    if (changes.url !== undefined) node.url = changes.url;
  };

  remove = async (id: string): Promise<void> => {
    const node = this.nodes.get(id);
    if (node?.children !== undefined && node.children.length > 0) {
      throw new Error("Can't remove non-empty folder (use recursive to force).");
    }
    await this.removeTree(id);
  };

  // --- assertions helpers ---------------------------------------------------

  /** The writable roots as a title/url outline, ids dropped — for whole-tree comparisons. */
  outline(): unknown[] {
    const shape = (node: LiveNode): unknown => {
      if (node.type === 'separator') return '---';
      return node.url === undefined ? { [node.title]: (node.children ?? []).map(shape) } : node.url;
    };
    return (this.root.children ?? []).map(shape);
  }

  /** A folder's live children, as `bookmarks.getChildren` returns them. */
  children(parentId: string): LiveNode[] {
    return structuredClone(this.nodes.get(parentId)?.children ?? []);
  }

  /** Titles under a parent, in stored order. */
  childTitles(parentId: string): string[] {
    return (this.nodes.get(parentId)?.children ?? []).map((child) => child.title);
  }

  /** Total nodes created since construction (excludes the roots). */
  get created(): number {
    return this.nodes.size - (this.root.children?.length ?? 0) - 1;
  }

  countCalls(prefix: string): number {
    return this.calls.filter((call) => call.startsWith(prefix)).length;
  }
}
