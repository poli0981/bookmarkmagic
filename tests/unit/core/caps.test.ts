import { describe, expect, it } from 'vitest';
import { textCapsBreach, treeCapsBreach, utf8ByteLength } from '@/lib/core/caps';
import { MAX_DEPTH, MAX_FILE_BYTES, MAX_NODES } from '@/lib/core/limits';
import type { BookmarkNode } from '@/lib/core/model';

/** The re-import caps the Replace backup is held to — docs/03 §1 step 6b. */
describe('treeCapsBreach', () => {
  const flat = (n: number): BookmarkNode[] =>
    Array.from({ length: n }, (_, i) => ({ title: `${i}`, url: `https://e.example/${i}` }));

  const chain = (depth: number): BookmarkNode[] => {
    let node: BookmarkNode = { title: 'leaf', children: [] };
    for (let i = 1; i < depth; i++) node = { title: `d${i}`, children: [node] };
    return [node];
  };

  it('accepts a tree at exactly the limits', () => {
    expect(treeCapsBreach(flat(MAX_NODES))).toBeUndefined();
    expect(treeCapsBreach(chain(MAX_DEPTH))).toBeUndefined();
  });

  it('names the cap one past either limit', () => {
    expect(treeCapsBreach(flat(MAX_NODES + 1))).toContain(`${MAX_NODES + 1} items`);
    expect(treeCapsBreach(chain(MAX_DEPTH + 1))).toContain(`${MAX_DEPTH + 1} deep`);
  });
});

describe('utf8ByteLength', () => {
  it.each([
    'plain ascii',
    'é ü ñ',
    '日本語のタイトル',
    'emoji 🌸 and 👩‍💻',
    'lone \ud800 high and \udc00 low',
    '',
  ])('matches TextEncoder for %j', (text) => {
    expect(utf8ByteLength(text)).toBe(new TextEncoder().encode(text).length);
  });
});

describe('textCapsBreach', () => {
  it('counts bytes, not characters, against the file cap', () => {
    expect(textCapsBreach('a'.repeat(MAX_FILE_BYTES))).toBeUndefined();
    expect(textCapsBreach('a'.repeat(MAX_FILE_BYTES + 1))).toContain('bytes');
    // A third of the cap in characters, three bytes each: one more is over.
    const fits = Math.floor(MAX_FILE_BYTES / 3);
    expect(textCapsBreach('語'.repeat(fits))).toBeUndefined();
    expect(textCapsBreach('語'.repeat(fits + 1))).toContain('bytes');
  });
});
