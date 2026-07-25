import { describe, expect, it } from 'vitest';
import { sanitizeFilename, timestampSuffix } from '@/lib/browser/download';

describe('sanitizeFilename', () => {
  it('replaces the characters Windows forbids (docs/09 T7)', () => {
    expect(sanitizeFilename('a\\b/c:d*e?f"g<h>i|j')).toBe('a_b_c_d_e_f_g_h_i_j');
  });

  it('collapses whitespace and trims', () => {
    expect(sanitizeFilename('  my   bookmarks .html ')).toBe('my bookmarks .html');
  });

  it('leaves an ordinary filename alone', () => {
    expect(sanitizeFilename('bookmarks-all-20260725-1405.html')).toBe(
      'bookmarks-all-20260725-1405.html',
    );
  });
});

describe('timestampSuffix', () => {
  it('formats as YYYYMMDD-HHmm in local time (docs/04 §5)', () => {
    // Constructed with local-time parts, so this is timezone-independent.
    expect(timestampSuffix(new Date(2026, 6, 25, 14, 5))).toBe('20260725-1405');
  });

  it('zero-pads every component', () => {
    expect(timestampSuffix(new Date(2026, 0, 2, 3, 4))).toBe('20260102-0304');
  });
});
