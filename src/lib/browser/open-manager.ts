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
 * Focus an existing Manager tab or open a new one at `route`.
 *
 * Note the asymmetry: a NEW tab lands on the requested route, but an existing
 * tab is only focused — its hash is left alone rather than forced, so an
 * in-progress import is never navigated away from (docs/03 §5).
 */
export async function openManager(route: ManagerRoute = '#import'): Promise<void> {
  const managerUrl = browser.runtime.getURL(MANAGER_PAGE);
  const existing = await findManagerContext(managerUrl);

  if (existing?.tabId !== undefined) {
    await browser.tabs.update(existing.tabId, { active: true });
    if (existing.windowId !== undefined) {
      await browser.windows.update(existing.windowId, { focused: true });
    }
    return;
  }

  await browser.tabs.create({ url: `${managerUrl}${route}` });
}

async function findManagerContext(managerUrl: string): Promise<ManagerContext | undefined> {
  // getContexts is Chrome 116+; our floor is 120. Guard anyway so a future
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
