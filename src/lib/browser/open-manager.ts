/**
 * Popup → Manager handoff — docs/02 §6.
 *
 * Purpose: focus an already-open Manager tab, or open one.
 * Guarantees: needs NO `tabs` permission. `getContexts`, `tabs.create`,
 *   `tabs.update` and `windows.update` are all permission-free; the invariant
 *   that keeps it that way is that we never read `Tab.url`/`pendingUrl`/
 *   `title`/`favIconUrl` and never call `tabs.query()` to find the tab
 *   (docs/08 §2).
 */
import { browser } from 'wxt/browser';

export type ManagerRoute = '#import' | '#export' | '#edit' | '#settings' | '#about';

const MANAGER_PAGE = '/manager.html';

interface ManagerContext {
  documentUrl?: string;
  tabId?: number;
  windowId?: number;
}

/**
 * The channel an open Manager listens on for "go to this route". Same-origin
 * and in-browser only: no permission, no network.
 */
export const MANAGER_CHANNEL = 'bookmarkmagic-manager';

interface NavigateMessage {
  kind: 'navigate';
  route: ManagerRoute;
  /** The Manager tab the popup is about to focus; every other one ignores it. */
  tabId?: number;
}

const ROUTES: ReadonlySet<string> = new Set(['#import', '#export', '#edit', '#settings', '#about']);

function isNavigateMessage(data: unknown): data is NavigateMessage {
  if (typeof data !== 'object' || data === null) return false;
  // SAFETY: a non-null object, and every field read is checked below.
  const { kind, route, tabId } = data as Record<string, unknown>;
  return (
    kind === 'navigate' &&
    typeof route === 'string' &&
    ROUTES.has(route) &&
    (tabId === undefined || typeof tabId === 'number')
  );
}

/**
 * In the Manager: act on the popup's "go to this route". A message addressed
 * to another Manager tab is ignored — with two open, the popup's choice used to
 * switch every one of them, not just the one it focused (v1.1.0 review).
 * `tabs.getCurrent` needs no permission and is not used for anything else.
 *
 * @returns the unsubscribe.
 */
export function onNavigateRequest(handle: (route: ManagerRoute) => void): () => void {
  const channel = new BroadcastChannel(MANAGER_CHANNEL);
  const own = browser.tabs
    .getCurrent()
    .then((tab) => tab?.id)
    .catch(() => undefined);
  channel.onmessage = (event: MessageEvent<unknown>) => {
    const data = event.data;
    if (!isNavigateMessage(data)) return;
    void own.then((tabId) => {
      // Unknown on either side → the 1.1.0-first-cut behaviour: everyone moves.
      if (data.tabId !== undefined && tabId !== undefined && data.tabId !== tabId) return;
      handle(data.route);
    });
  };
  return () => channel.close();
}

/**
 * Focus an existing Manager tab or open a new one at `route`.
 *
 * An existing tab is asked — not forced — to switch route over a
 * BroadcastChannel; it refuses while an import is writing (docs/03 §5). 1.0.x
 * only focused it, so the popup's "Export" landed wherever the tab had been.
 */
export async function openManager(route: ManagerRoute = '#import'): Promise<void> {
  const managerUrl = browser.runtime.getURL(MANAGER_PAGE);
  const existing = await findManagerContext(managerUrl);

  if (existing?.tabId !== undefined) {
    // Posted before focusing: the popup closes as soon as the tab takes focus.
    const channel = new BroadcastChannel(MANAGER_CHANNEL);
    channel.postMessage({
      kind: 'navigate',
      route,
      tabId: existing.tabId,
    } satisfies NavigateMessage);
    channel.close();
    await browser.tabs.update(existing.tabId, { active: true });
    if (existing.windowId !== undefined) {
      await browser.windows.update(existing.windowId, { focused: true });
    }
    return;
  }

  await browser.tabs.create({ url: `${managerUrl}${route}` });
}

async function findManagerContext(managerUrl: string): Promise<ManagerContext | undefined> {
  // getContexts is Chrome 116+; our floor is 136. Guard anyway so a future
  // Firefox target degrades to "always open a new tab" rather than throwing.
  const getContexts = (
    browser.runtime as {
      getContexts?: (filter: { contextTypes: string[] }) => Promise<ManagerContext[]>;
    }
  ).getContexts;
  if (typeof getContexts !== 'function') return undefined;

  try {
    const contexts = await getContexts({ contextTypes: ['TAB'] });
    return contexts.find((context) => context.documentUrl?.startsWith(managerUrl) === true);
  } catch {
    return undefined;
  }
}
