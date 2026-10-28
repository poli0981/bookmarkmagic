import { expect } from 'vitest';
import { BmParseError, type BmParseErrorCode } from '@/lib/core/model';

/**
 * Assert that `run` throws a `BmParseError` with exactly this code.
 *
 * Replaces the try/catch/`(err as BmParseError)` blocks the suites used to
 * repeat — and makes checking the CODE the default, which a bare
 * `toThrow(BmParseError)` silently skipped (docs/11 §3).
 */
export function expectBmError(run: () => unknown, code: BmParseErrorCode): BmParseError {
  let caught: unknown;
  try {
    run();
  } catch (err) {
    caught = err;
  }
  expect(caught, `expected a BmParseError ${code}`).toBeInstanceOf(BmParseError);
  // SAFETY: the assertion above has just established the type.
  const error = caught as BmParseError;
  expect(error.code).toBe(code);
  return error;
}
