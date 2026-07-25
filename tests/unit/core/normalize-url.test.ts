import { describe, expect, it } from 'vitest';
import { normalizeUrl } from '@/lib/core/normalize-url';

describe('normalizeUrl', () => {
  it('lowercases scheme and host but not the path', () => {
    expect(normalizeUrl('HTTPS://Example.COM/Path')).toBe('https://example.com/Path');
  });

  it('strips default ports only', () => {
    expect(normalizeUrl('https://example.com:443/')).toBe('https://example.com');
    expect(normalizeUrl('http://example.com:80/')).toBe('http://example.com');
    // A non-default port is kept. The bare-origin rule still applies, so the
    // trailing slash is dropped here exactly as it is for the default-port case.
    expect(normalizeUrl('http://example.com:8080/')).toBe('http://example.com:8080');
    expect(normalizeUrl('http://example.com:8080/a')).toBe('http://example.com:8080/a');
  });

  it('treats a bare origin the same with or without a trailing slash', () => {
    expect(normalizeUrl('https://example.com')).toBe(normalizeUrl('https://example.com/'));
  });

  it('keeps query and fragment verbatim — they are meaningful', () => {
    expect(normalizeUrl('https://example.com/?q=1#frag')).toBe('https://example.com/?q=1#frag');
    expect(normalizeUrl('https://example.com/?b=2&a=1')).toBe('https://example.com/?b=2&a=1');
  });

  it('does NOT strip utm_, www. or unify http/https (docs/05 §2)', () => {
    expect(normalizeUrl('https://www.example.com/?utm_source=x')).not.toBe(
      normalizeUrl('https://example.com/'),
    );
    expect(normalizeUrl('http://example.com/a')).not.toBe(normalizeUrl('https://example.com/a'));
  });

  it('passes unparseable input through trimmed, so such links still match exactly', () => {
    expect(normalizeUrl('  javascript:alert(1)  ')).toBe('javascript:alert(1)');
    expect(normalizeUrl('not a url')).toBe('not a url');
    expect(normalizeUrl('javascript:alert(1)')).toBe(normalizeUrl(' javascript:alert(1) '));
  });

  it('never collapses two different URLs onto one key', () => {
    // A false-positive dedupe key is silent DATA LOSS: the second bookmark is
    // dropped on import. Userinfo is the case the bare-origin fast path missed.
    const distinct = [
      'https://alice@example.com/',
      'https://bob@example.com/',
      'https://alice:pw@example.com/',
      'https://example.com/',
      'https://example.com:8443/',
      'https://sub.example.com/',
    ];
    const keys = distinct.map(normalizeUrl);
    expect(new Set(keys).size).toBe(distinct.length);
  });

  it('is stable — normalizing twice changes nothing', () => {
    for (const raw of [
      'https://example.com',
      'https://example.com/a?b=1#c',
      'ftp://files.example.org:21/pub',
      'not a url',
    ]) {
      expect(normalizeUrl(normalizeUrl(raw))).toBe(normalizeUrl(raw));
    }
  });
});
