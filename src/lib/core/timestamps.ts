/**
 * Epoch normalization — docs/05 §4.
 *
 * Purpose: turn the inconsistent epoch values found in bookmark files into
 *   integer SECONDS, or into "absent" when the value carries no information.
 * Inputs: a raw attribute value (string from an attribute, or a number).
 * Guarantees: never throws; returns `undefined` for anything it cannot trust.
 */

/**
 * Bucket boundaries. Each is exactly 1000x the previous, so they are
 * non-overlapping and describe the same instants in different units:
 * 1e11 s = 1e14 ms = 1e17 us = 5138-11-16.
 */
const MS_FLOOR = 1e11;
const US_FLOOR = 1e14;
const US_CEIL = 1e17;

export interface TimestampResult {
  /** Integer epoch seconds, or undefined when absent/unusable. */
  seconds: number | undefined;
  /**
   * True only when the value was present but unusable — the caller raises an
   * INVALID_DATE warning. A missing attribute, or an explicit 0, is silent.
   */
  invalid: boolean;
}

const ABSENT: TimestampResult = { seconds: undefined, invalid: false };
const INVALID: TimestampResult = { seconds: undefined, invalid: true };

/**
 * Normalize one epoch value to seconds.
 *
 * Two deliberate choices (docs/05 §4):
 * - The seconds floor is 1, not 1e8. Chrome's own importer accepts any
 *   0 < t < 2^32, so a higher floor would drop 1970-1973 dates that Chrome
 *   imports fine.
 * - `0` is silent, not a warning. Chrome writes ADD_DATE="0" for undated
 *   nodes, so warning on it would flood the warning list on normal exports.
 */
export function normalizeEpochSeconds(raw: string | number | null | undefined): TimestampResult {
  if (raw === null || raw === undefined) return ABSENT;
  if (typeof raw === 'string' && raw.trim() === '') return ABSENT;

  const value = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(value)) return INVALID;
  if (value === 0) return ABSENT;
  if (value < 0) return INVALID;

  if (value < MS_FLOOR) return { seconds: Math.round(value), invalid: false };
  if (value < US_FLOOR) return { seconds: Math.round(value / 1e3), invalid: false };
  if (value < US_CEIL) return { seconds: Math.round(value / 1e6), invalid: false };
  return INVALID;
}

/**
 * Milliseconds (what `chrome.bookmarks` returns) to our seconds. This is the
 * ADAPTER conversion and is deliberately separate from the magnitude detection
 * above, which is for FILE input only — docs/05 §4.
 */
export function millisToSeconds(millis: number | undefined): number | undefined {
  if (millis === undefined || !Number.isFinite(millis) || millis <= 0) return undefined;
  return Math.round(millis / 1e3);
}
