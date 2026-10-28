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

  let seconds: number;
  if (value < MS_FLOOR) seconds = Math.round(value);
  else if (value < US_FLOOR) seconds = Math.round(value / 1e3);
  else if (value < US_CEIL) seconds = Math.round(value / 1e6);
  else return INVALID;
  // 0 < value < 0.5 rounds to 0, and 0 means "no date" everywhere in this
  // model — storing `addDate: 0` would contradict that.
  return seconds === 0 ? ABSENT : { seconds, invalid: false };
}

/** Seconds between the Windows epoch (1601-01-01) and the Unix epoch. */
const WINDOWS_TO_UNIX_SECONDS = 11_644_473_600;

/**
 * Chrome's profile `Bookmarks` file stores dates as DECIMAL STRINGS of
 * microseconds since 1601-01-01 UTC (`base::Time::ToDeltaSinceWindowsEpoch`),
 * e.g. "13344473600000000". Those exceed 2^53, so the value is cut by string —
 * dropping the last six digits truncates to whole seconds, exactly as Chrome's
 * own HTML writer does — before any arithmetic. "0" means unset.
 *
 * Fed to `normalizeEpochSeconds` instead, the value would land in the
 * microsecond bucket and come out near the year 2395.
 */
export function chromeTimeToSeconds(raw: unknown): TimestampResult {
  if (raw === undefined || raw === null || raw === '' || raw === '0' || raw === 0) return ABSENT;
  let secondsSince1601: number;
  if (typeof raw === 'string' && /^\d{1,19}$/.test(raw)) {
    secondsSince1601 = raw.length <= 6 ? 0 : Number(raw.slice(0, -6));
  } else if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
    // A hand-edited file may hold a bare number. Any post-1970 value is past
    // 2^53 and so already rounded by JSON.parse, but only by microseconds.
    secondsSince1601 = Math.floor(raw / 1e6);
  } else {
    return INVALID;
  }
  const seconds = secondsSince1601 - WINDOWS_TO_UNIX_SECONDS;
  if (seconds <= 0 || seconds >= MS_FLOOR) return INVALID;
  return { seconds, invalid: false };
}

/**
 * Firefox backups store PRTime: integer MICROseconds since the Unix epoch. The
 * unit is known, so this converts explicitly rather than guessing by magnitude
 * (which would read a 1971 date, about 3e13 µs, as milliseconds). Truncated,
 * matching Firefox's own HTML export.
 */
export function microsToSeconds(raw: unknown): TimestampResult {
  if (raw === undefined || raw === null || raw === 0) return ABSENT;
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0) return INVALID;
  const seconds = Math.floor(raw / 1e6);
  if (seconds === 0) return ABSENT;
  if (seconds >= MS_FLOOR) return INVALID;
  return { seconds, invalid: false };
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
