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

/**
 * Refuses to leave while work would be orphaned. Injected rather than imported,
 * so this module keeps knowing nothing about the import session.
 */
export interface RoutingOptions {
  /** True while leaving the current route would strand in-flight work. */
  isBlocked?: () => boolean;
  /** Called when a navigation was refused, so the UI can explain itself. */
  onBlocked?: () => void;
}

let blocked: (() => boolean) | undefined;

/**
 * Navigate, unless a write is in flight.
 *
 * @returns whether the navigation actually happened. Callers that ignore this
 *   turn a refusal into a button that appears to do nothing.
 */
export function navigate(route: Route): boolean {
  if (route !== current && blocked?.() === true) return false;
  current = route;
  if (globalThis.location !== undefined) globalThis.location.hash = `#${route}`;
  return true;
}

/**
 * Sync from the URL and follow it. Returns a cleanup function.
 *
 * The `hashchange` listener is also the thing that made Back dangerous. Every
 * `navigate()` writes a history entry, so during an import the user could press
 * Back, unmount `ImportTab`, and strand the write it was driving — the same
 * dead end Phase 4 closed for the footer and the tab bar, reachable through a
 * door nobody had guarded.
 */
export function startRouting(options: RoutingOptions = {}): () => void {
  current = parse(globalThis.location?.hash ?? '');
  blocked = options.isBlocked;

  const onHashChange = (): void => {
    const next = parse(globalThis.location.hash);
    // Terminates the restore below: putting the hash back fires this handler a
    // second time, and that time the parsed route already equals `current`.
    if (next === current) return;
    if (options.isBlocked?.() === true) {
      globalThis.location.hash = `#${current}`;
      options.onBlocked?.();
      return;
    }
    current = next;
  };

  globalThis.addEventListener('hashchange', onHashChange);
  return () => {
    globalThis.removeEventListener('hashchange', onHashChange);
    blocked = undefined;
  };
}
