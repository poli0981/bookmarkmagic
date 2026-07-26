import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyToClipboard } from '@/lib/browser/clipboard';

/**
 * The docs/09 T8 surface. jsdom provides no `navigator.clipboard`, so every
 * case here installs one — which also exercises the "no clipboard at all" path
 * that a non-secure context would take.
 */

function stubClipboard(impl: ((text: string) => Promise<void>) | undefined): string[] {
  const written: string[] = [];
  if (impl === undefined) {
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      value: undefined,
      configurable: true,
    });
    return written;
  }
  Object.defineProperty(globalThis.navigator, 'clipboard', {
    value: {
      writeText: async (text: string) => {
        written.push(text);
        await impl(text);
      },
    },
    configurable: true,
  });
  return written;
}

afterEach(() => {
  Reflect.deleteProperty(globalThis.navigator, 'clipboard');
  vi.restoreAllMocks();
});

describe('copyToClipboard', () => {
  it('writes the text and reports success', async () => {
    const written = stubClipboard(async () => {});
    expect(await copyToClipboard('https://example.com/')).toBe(true);
    expect(written).toEqual(['https://example.com/']);
  });

  it('reports failure instead of throwing when the write rejects', async () => {
    // The real one this guards: Chrome rejects with NotAllowedError
    // ("Document is not focused") if the manager page lost focus between the
    // click and the promise. The user gets a toast, not an unhandled rejection.
    stubClipboard(async () => {
      throw new DOMException('Document is not focused', 'NotAllowedError');
    });
    await expect(copyToClipboard('https://example.com/')).resolves.toBe(false);
  });

  it('reports failure when there is no clipboard API at all', async () => {
    stubClipboard(undefined);
    await expect(copyToClipboard('https://example.com/')).resolves.toBe(false);
  });

  it('never reads the clipboard', async () => {
    // docs/09 T8 is explicit: write only. A readText call here would be a
    // privacy regression that no other test would notice.
    const readText = vi.fn();
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      value: { writeText: async () => {}, readText },
      configurable: true,
    });
    await copyToClipboard('https://example.com/');
    expect(readText).not.toHaveBeenCalled();
  });
});
