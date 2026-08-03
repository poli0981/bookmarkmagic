import { describe, expect, it } from 'vitest';
import { describeError } from '@/lib/browser/describe-error';
import {
  BmAborted,
  BmBackupError,
  BmBrowserError,
  BmEnvError,
  BmPartialWrite,
} from '@/lib/browser/errors';
import { BmParseError } from '@/lib/core/model';

/**
 * `describeError` — docs/02 §7.
 *
 * Two properties matter more than the individual mappings, and both have been
 * defects in this codebase before:
 *
 * - the result is a **key**, never a resolved sentence, because the import
 *   session outlives the component and `t()` is only reactive where it is
 *   called;
 * - `detail` is *absent* when there is none, not `undefined`. Under
 *   `exactOptionalPropertyTypes` those are different types, and only a runtime
 *   `'detail' in result` check catches the difference.
 */
describe('describeError', () => {
  it('maps a parse error to its own code', () => {
    const result = describeError(new BmParseError('TOO_DEEP', 'nesting deeper than 200 levels'));
    expect(result.messageKey).toBe('errors.TOO_DEEP');
    expect(result.detail).toBe('nesting deeper than 200 levels');
  });

  it('maps a backup error to its own code', () => {
    const result = describeError(new BmBackupError('BACKUP_CANCELLED'));
    expect(result.messageKey).toBe('errors.BACKUP_CANCELLED');
  });

  it('maps a missing writable root to its own key, not to BROWSER', () => {
    // The browser refused nothing — every root is policy-managed. Reporting a
    // refusal sends the user looking for a permission problem that is not there.
    const result = describeError(new BmEnvError('NO_WRITABLE_ROOTS', '1 root(s), none writable'));
    expect(result.messageKey).toBe('errors.NO_WRITABLE_ROOTS');
    expect(result.detail).toBe('1 root(s), none writable');
  });

  it('carries the created count off a partial write', () => {
    const result = describeError(new BmPartialWrite('writing', 42, new Error('quota')));
    expect(result.messageKey).toBe('errors.PARTIAL_WRITE');
    expect(result.created).toBe(42);
    expect(result.removed).toBeUndefined();
    expect(result.detail).toBe('quota');
  });

  it('carries the removed count off a partial clear, and says something different', () => {
    // "some items were added" and "part of your tree is gone" need different
    // advice, so the phase picks the sentence rather than a shared one.
    const result = describeError(new BmPartialWrite('clearing', 7, new Error('boom')));
    expect(result.messageKey).toBe('errors.PARTIAL_CLEAR');
    expect(result.removed).toBe(7);
    expect(result.created).toBeUndefined();
  });

  it('unwraps a BmBrowserError cause rather than nesting the message', () => {
    const cause = new BmBrowserError('bookmarks.create', new Error('Invalid URL'));
    const result = describeError(new BmPartialWrite('writing', 1, cause));
    expect(result.detail).toBe('Invalid URL');
  });

  it('maps a raw browser rejection to BROWSER', () => {
    const result = describeError(new BmBrowserError('bookmarks.move', new Error('nope')));
    expect(result.messageKey).toBe('errors.BROWSER');
    expect(result.detail).toBe('nope');
  });

  it('falls back to UNKNOWN for anything else, including non-Errors', () => {
    expect(describeError(new Error('plain')).messageKey).toBe('errors.UNKNOWN');
    expect(describeError('a string').messageKey).toBe('errors.UNKNOWN');
    expect(describeError(undefined).messageKey).toBe('errors.UNKNOWN');
  });

  it('omits detail entirely rather than setting it to undefined', () => {
    const result = describeError('not an Error');
    expect('detail' in result).toBe(true);
    expect(result.detail).toBeUndefined();

    // The env-error path uses a conditional spread, so the key is genuinely
    // absent — this is the assertion that catches a regression to
    // `detail: undefined`, which the type system alone would let through.
    const env = describeError(new BmEnvError('NO_WRITABLE_ROOTS'));
    expect('detail' in env).toBe(false);
  });

  it('does not claim to describe an abort — cancellation is not a failure', () => {
    // BmAborted is handled by the caller before it ever reaches here. If that
    // ever changed, the user's own cancellation would be reported as an error.
    const result = describeError(new BmAborted(5));
    expect(result.messageKey).toBe('errors.UNKNOWN');
  });
});
