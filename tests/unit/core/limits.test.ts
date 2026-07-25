import { describe, expect, it } from 'vitest';
import { LEGAL_VERSION, MAX_DEPTH, MAX_FILE_BYTES, MAX_NODES } from '@/lib/core/limits';

/**
 * These constants are public promises, not implementation details: docs/09 §2
 * T2 cites the exact caps to reviewers, and docs/14 §2 ties LEGAL_VERSION to
 * re-consent. Changing one without updating the docs should break the build.
 */
describe('limits', () => {
  it('caps files at the 25 MB documented in docs/09 T2', () => {
    expect(MAX_FILE_BYTES).toBe(25 * 1024 * 1024);
  });

  it('caps node count at the 100 000 documented in docs/09 T2', () => {
    expect(MAX_NODES).toBe(100_000);
  });

  it('caps nesting depth at the 200 documented in docs/09 T2', () => {
    expect(MAX_DEPTH).toBe(200);
  });

  it('starts LEGAL_VERSION at 1 (docs/14 §2)', () => {
    expect(LEGAL_VERSION).toBe(1);
  });
});
