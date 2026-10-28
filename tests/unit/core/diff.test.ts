import { describe, expect, it } from 'vitest';
import { buildUrlIndex } from '@/lib/core/dedupe';
import { diffAgainstBrowser } from '@/lib/core/diff';
import type { BookmarkNode } from '@/lib/core/model';

/** The preview badges — docs/05 §5. */
const BROWSER = buildUrlIndex([
  { title: 'Bar', children: [{ title: 'have', url: 'https://have.example/' }] },
]);

describe('diffAgainstBrowser', () => {
  const have: BookmarkNode = { title: 'mine', url: 'https://HAVE.example' };
  const fresh: BookmarkNode = { title: 'new', url: 'https://new.example/' };
  const again: BookmarkNode = { title: 'again', url: 'https://have.example/' };
  const folder: BookmarkNode = { title: 'F', children: [have, fresh] };
  const result = diffAgainstBrowser([folder, again], BROWSER);

  it('badges every bookmark, comparing normalized URLs, path-insensitively', () => {
    expect(result.status.get(have)).toBe('exists');
    expect(result.status.get(fresh)).toBe('new');
    expect(result.status.get(again)).toBe('exists');
  });

  it('counts per node, so a URL the file repeats counts each time', () => {
    expect(result).toMatchObject({ existsCount: 2, newCount: 1 });
  });

  it('never badges a folder', () => {
    expect(result.status.has(folder)).toBe(false);
  });
});
