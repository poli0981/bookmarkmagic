import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Popup → Manager route handoff — docs/02 §6. `wxt/browser` is mocked: only
 * `tabs.getCurrent` matters here, and the fake browser does not track tabs.
 */
let ownTabId: number | undefined = 7;

vi.mock('wxt/browser', () => ({
  browser: {
    tabs: { getCurrent: async () => (ownTabId === undefined ? undefined : { id: ownTabId }) },
  },
}));

const { MANAGER_CHANNEL, onNavigateRequest } = await import('@/lib/browser/open-manager');

let stop: (() => void) | undefined;
let sender: BroadcastChannel;

beforeEach(() => {
  ownTabId = 7;
  sender = new BroadcastChannel(MANAGER_CHANNEL);
});

afterEach(() => {
  stop?.();
  sender.close();
});

/** Post, then give the listener's promise chain a moment to settle. */
async function post(message: unknown): Promise<void> {
  sender.postMessage(message);
  await new Promise((resolve) => setTimeout(resolve, 20));
}

describe('onNavigateRequest', () => {
  it('follows a message addressed to this tab', async () => {
    const handle = vi.fn();
    stop = onNavigateRequest(handle);
    await post({ kind: 'navigate', route: '#export', tabId: 7 });
    expect(handle).toHaveBeenCalledWith('#export');
  });

  it('ignores a message for another Manager tab (v1.1.0 review)', async () => {
    const handle = vi.fn();
    stop = onNavigateRequest(handle);
    await post({ kind: 'navigate', route: '#export', tabId: 8 });
    expect(handle).not.toHaveBeenCalled();
  });

  it('follows an unaddressed message, and one received where the tab is unknown', async () => {
    const handle = vi.fn();
    stop = onNavigateRequest(handle);
    await post({ kind: 'navigate', route: '#edit' });
    expect(handle).toHaveBeenCalledWith('#edit');
    stop();
    ownTabId = undefined;
    const second = vi.fn();
    stop = onNavigateRequest(second);
    await post({ kind: 'navigate', route: '#about', tabId: 3 });
    expect(second).toHaveBeenCalledWith('#about');
  });

  it('drops anything that is not a well-formed navigate message', async () => {
    const handle = vi.fn();
    stop = onNavigateRequest(handle);
    for (const junk of [
      null,
      'navigate',
      { kind: 'navigate', route: '#evil' },
      { kind: 'navigate', route: 'import' },
      { kind: 'navigate', route: '#import', tabId: '7' },
      { kind: 'other', route: '#import' },
    ]) {
      await post(junk);
    }
    expect(handle).not.toHaveBeenCalled();
  });
});
