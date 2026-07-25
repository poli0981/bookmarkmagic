/**
 * Hash routing — docs/02 §5. Zero dependencies.
 *
 * The `hashchange` listener is what makes right-click → Options work when a
 * Manager tab is already open: Chrome's singleton-tab matching normalizes the
 * fragment away and merely activates the tab, so nothing navigates and only
 * this listener can switch the view.
 */
const ROUTES = ['import', 'export', 'edit', 'settings', 'about'] as const;
export type Route = (typeof ROUTES)[number];

const DEFAULT_ROUTE: Route = 'import';

function parse(hash: string): Route {
  const name = hash.replace(/^#/, '');
  return (ROUTES as readonly string[]).includes(name) ? (name as Route) : DEFAULT_ROUTE;
}

let current = $state<Route>(DEFAULT_ROUTE);

export function getRoute(): Route {
  return current;
}

export function navigate(route: Route): void {
  current = route;
  if (globalThis.location !== undefined) globalThis.location.hash = `#${route}`;
}

/** Sync from the URL and follow it. Returns a cleanup function. */
export function startRouting(): () => void {
  current = parse(globalThis.location?.hash ?? '');
  const onHashChange = (): void => {
    current = parse(globalThis.location.hash);
  };
  globalThis.addEventListener('hashchange', onHashChange);
  return () => {
    globalThis.removeEventListener('hashchange', onHashChange);
  };
}
