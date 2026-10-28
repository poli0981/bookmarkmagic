import { afterEach, describe, expect, it } from 'vitest';
import { describeError } from '@/lib/browser/describe-error';
import {
  clearDiagnostics,
  errorName,
  installCrashHooks,
  record,
  snapshot,
} from '@/lib/browser/diagnostics';
import { BmParseError } from '@/lib/core/model';

const CONTEXT = { version: '1.1.0', locale: 'vi', theme: 'dark' };
const events = () => JSON.parse(snapshot(CONTEXT)).events as { t: number; event: unknown }[];

afterEach(() => {
  clearDiagnostics();
});

/** Local-only diagnostics — docs/09 §7. */
describe('diagnostics', () => {
  it('keeps the newest 200 events, oldest first, with page-relative times only', () => {
    for (let i = 0; i < 250; i++) record({ kind: 'edit', action: 'sort', count: i });
    const all = events();
    expect(all).toHaveLength(200);
    expect(all[0]?.event).toEqual({ kind: 'edit', action: 'sort', count: 50 });
    expect(all.every((entry) => typeof entry.t === 'number')).toBe(true);
  });

  it('puts the context first and nothing personal anywhere', () => {
    const report = JSON.parse(snapshot(CONTEXT));
    expect(report).toMatchObject({ app: 'BookmarkMagic', ...CONTEXT });
    expect(Object.keys(report)).toEqual([
      'app',
      'version',
      'locale',
      'theme',
      'chromeMajor',
      'events',
    ]);
  });

  it('logs every described failure by code — never by its detail text', () => {
    describeError(
      new BmParseError('INVALID_NODE', 'roots[0].title must be "https://secret.example/"'),
    );
    const text = snapshot(CONTEXT);
    expect(text).toContain('errors.INVALID_NODE');
    expect(text).not.toContain('secret.example');
  });

  it('records uncaught errors and rejections by name, without their messages', () => {
    const target = new EventTarget() as unknown as Window;
    const stop = installCrashHooks(target);
    target.dispatchEvent(
      Object.assign(new Event('error'), { error: new TypeError('reading https://x.example') }),
    );
    target.dispatchEvent(
      Object.assign(new Event('unhandledrejection'), { reason: new RangeError('y') }),
    );
    stop();
    target.dispatchEvent(Object.assign(new Event('error'), { error: new Error('after') }));
    expect(events().map((e) => e.event)).toEqual([
      { kind: 'crash', name: 'TypeError' },
      { kind: 'crash', name: 'RangeError' },
    ]);
    expect(snapshot(CONTEXT)).not.toContain('x.example');
  });

  it('names an error only from the allowlist (v1.1.0 review)', () => {
    const custom = new Error('m');
    custom.name = 'https://leak.example/Jane Doe';
    expect(errorName(custom)).toBe('other');
    expect(errorName(new TypeError('x'))).toBe('TypeError');
    expect(errorName(new BmParseError('INVALID_NODE'))).toBe('BmParseError');
    expect(errorName('a string')).toBe('string');
    expect(errorName(undefined)).toBe('undefined');
  });

  it('refuses free text at compile time — the allowlist is the type (v1.1.0 review)', () => {
    const title = 'Jane Doe — payroll';
    // @ts-expect-error a title is not an import phase
    record({ kind: 'import', phase: `parsed:${title}` });
    // @ts-expect-error nor a file format
    record({ kind: 'import', phase: 'parsed', format: title });
    // @ts-expect-error nor an error key
    record({ kind: 'failure', where: 'TypeError', code: 'https://leak.example/' });
    // @ts-expect-error nor an edit action
    record({ kind: 'edit', action: title });
    // @ts-expect-error nor an error name
    record({ kind: 'crash', name: title });
    expect(events()).toHaveLength(5);
  });
});
