import type { LiveNode } from '@/lib/browser/bookmarks';

/**
 * Hand-rolled `chrome.bookmarks` mock — docs/11 §4.
 *
 * WXT's fakeBrowser stubs `bookmarks.*` with "not implemented" throws, so this
 * is an in-memory tree with call recording and failure injection. It models the
 * behaviours the write queue depends on: create appends when no index is given,
 * and ids are handed out in creation order.
 */
export interface FakeBookmarksOptions {
  /** Throw on the Nth create (1-based), to test partial-failure reporting. */
  failOnCreate?: number;
  /** Throw on the Nth removeTree (1-based) — the Replace path's equivalent. */
  failOnRemoveTree?: number;
}

export class FakeBookmarks {
  readonly calls: string[] = [];
  private readonly nodes = new Map<string, LiveNode>();
  private nextId = 100;
  private createCount = 0;
  private removeCount = 0;
  // An explicit field, not a constructor parameter property: the latter emits
  // runtime code and is rejected by `erasableSyntaxOnly` (docs/10 §2).
  private readonly options: FakeBookmarksOptions;

  constructor(options: FakeBookmarksOptions = {}) {
    this.options = options;
    // The synthetic root and the three Chromium roots.
    this.nodes.set('0', { id: '0', title: '', children: [] });
    for (const [id, title] of [
      ['1', 'Bookmarks bar'],
      ['2', 'Other bookmarks'],
      ['3', 'Mobile bookmarks'],
    ] as const) {
      const node: LiveNode = { id, parentId: '0', title, children: [] };
      this.nodes.set(id, node);
      this.root.children?.push(node);
    }
  }

  private get root(): LiveNode {
    return this.nodes.get('0') as LiveNode;
  }

  /** Add a policy-managed root, which every write path must skip. */
  addManagedRoot(): LiveNode {
    const node: LiveNode = {
      id: 'managed',
      parentId: '0',
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

  private createSync(details: {
    parentId: string;
    title: string;
    url?: string;
    index?: number;
  }): LiveNode {
    const parent = this.nodes.get(details.parentId);
    if (parent === undefined) throw new Error(`no such parent: ${details.parentId}`);
    if (parent.unmodifiable !== undefined) throw new Error("Can't modify managed bookmarks");

    const node: LiveNode = {
      id: String(this.nextId++),
      parentId: details.parentId,
      title: details.title,
      ...(details.url !== undefined && { url: details.url }),
      ...(details.url === undefined && { children: [] }),
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

  getTree = async (): Promise<LiveNode[]> => {
    this.calls.push('getTree');
    return [structuredClone(this.root)];
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

  // --- assertions helpers ---------------------------------------------------

  /** Titles under a parent, in stored order. */
  childTitles(parentId: string): string[] {
    return (this.nodes.get(parentId)?.children ?? []).map((child) => child.title);
  }

  /** Total nodes created since construction (excludes the four roots). */
  get created(): number {
    return this.nodes.size - (this.root.children?.length ?? 0) - 1;
  }

  countCalls(prefix: string): number {
    return this.calls.filter((call) => call.startsWith(prefix)).length;
  }
}
