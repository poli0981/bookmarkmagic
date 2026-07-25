import type { BookmarkNode } from '@/lib/core/model';

/**
 * Test helpers for the round-trip suite (docs/11 §3).
 *
 * `project()` models each format's DOCUMENTED lossiness, so a round-trip can
 * assert equality without pretending CSV and HTML are lossless. If a
 * projection ever needs widening to make a test pass, that is a spec change —
 * fix docs/04 first, not this file.
 */
export type RoundTripFormat = 'bm-json' | 'netscape-html' | 'csv';

/** Deterministic PRNG — no Math.random, so failures reproduce from the seed. */
export function makeRng(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state >>>= 0;
    state ^= state >> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 0x1_0000_0000;
  };
}

/** Titles chosen to break naive serializers. Never empty — see project(). */
const NASTY_TITLES = [
  'plain',
  'with, comma',
  'with "quotes"',
  'with \n newline',
  'with \r carriage return',
  'crlf \r\n here',
  'with\ttab',
  'emoji 🌸 and 日本語',
  'RTL مرحبا',
  '</a> and <script>',
  'amp & lt < gt >',
  'slash / and back\\slash',
  'trailing space ',
  '[brackets](parens)',
];

const URLS = [
  'https://example.com/',
  'https://example.com/path?q=1&r=2#frag',
  'http://localhost:3000/x',
  'https://例え.jp/パス',
  'https://example.com/a(b)c',
  'https://example.com/space%20here',
  'ftp://files.example.org/pub',
];

export interface GenerateOptions {
  maxDepth?: number;
  maxChildren?: number;
}

/** Build a random but reproducible tree. Bookmarks always have a non-empty title. */
export function generateTree(rng: () => number, options: GenerateOptions = {}): BookmarkNode[] {
  const maxDepth = options.maxDepth ?? 4;
  const maxChildren = options.maxChildren ?? 4;

  const pick = <T>(items: readonly T[]): T => items[Math.floor(rng() * items.length)] as T;

  const build = (depth: number): BookmarkNode[] => {
    const count = Math.floor(rng() * (maxChildren + 1));
    const nodes: BookmarkNode[] = [];
    for (let i = 0; i < count; i++) {
      const isFolder = depth < maxDepth && rng() < 0.4;
      const title = `${pick(NASTY_TITLES)} ${i}`;
      if (isFolder) {
        nodes.push({
          title,
          ...(rng() < 0.6 && { addDate: 1_600_000_000 + Math.floor(rng() * 1e7) }),
          ...(rng() < 0.4 && { lastModified: 1_700_000_000 + Math.floor(rng() * 1e7) }),
          ...(depth === 1 && rng() < 0.2 && { toolbar: true }),
          children: build(depth + 1),
        });
      } else {
        nodes.push({
          title,
          url: pick(URLS),
          ...(rng() < 0.7 && { addDate: 1_600_000_000 + Math.floor(rng() * 1e7) }),
          ...(rng() < 0.3 && { lastModified: 1_700_000_000 + Math.floor(rng() * 1e7) }),
        });
      }
    }
    return nodes;
  };

  return build(1);
}

/** True when a subtree contains no bookmark at any depth — CSV cannot represent it. */
function hasNoBookmarks(node: BookmarkNode): boolean {
  if (node.url !== undefined) return false;
  return (node.children ?? []).every(hasNoBookmarks);
}

function projectNode(node: BookmarkNode, format: RoundTripFormat): BookmarkNode | null {
  const isFolder = node.url === undefined;

  if (format === 'bm-json') return node; // lossless

  if (format === 'netscape-html') {
    // LAST_MODIFIED is emitted on <H3> only, never on <A> — matching Chrome.
    if (isFolder) {
      return { ...node, children: projectList(node.children ?? [], format) };
    }
    const { lastModified: _dropped, ...rest } = node;
    return rest;
  }

  // csv: drop empty folders, toolbar everywhere, all folder metadata, and
  // lastModified on bookmarks. Survivors: folder path, title, url, addDate.
  if (isFolder) {
    if (hasNoBookmarks(node)) return null;
    return { title: node.title, children: projectList(node.children ?? [], format) };
  }
  return {
    title: node.title,
    url: node.url as string,
    ...(node.addDate !== undefined && { addDate: node.addDate }),
  };
}

function projectList(nodes: readonly BookmarkNode[], format: RoundTripFormat): BookmarkNode[] {
  const out: BookmarkNode[] = [];
  for (const node of nodes) {
    const projected = projectNode(node, format);
    if (projected !== null) out.push(projected);
  }
  return out;
}

/** Apply a format's documented losses to a tree, yielding the expected parse output. */
export function project(roots: readonly BookmarkNode[], format: RoundTripFormat): BookmarkNode[] {
  return projectList(roots, format);
}
