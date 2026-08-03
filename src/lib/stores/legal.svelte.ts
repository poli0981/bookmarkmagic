/**
 * First-run legal acceptance — docs/14 §2.
 *
 * Purpose: decide whether the gate is required, and record acceptance.
 * Inputs: `chrome.storage.local` via `browser/storage.ts`.
 * Guarantees: never throws and never rejects — a storage failure fails CLOSED
 *   (gate shown), and `acceptLegal` returns an outcome instead of rejecting.
 *   Acceptance is only reflected in state AFTER the write resolves.
 */
import { type LegalAcceptance, readLegal, writeLegal } from '../browser/storage';
import { LEGAL_VERSION } from '../core/limits';
import type { Route } from './route.svelte';
import type { SaveOutcome } from './settings.svelte';

export type LegalStatus =
  | { kind: 'loading' }
  | { kind: 'accepted'; acceptance: LegalAcceptance }
  /**
   * `previous` carries the superseded record on the `updated` path. Without it
   * the About tab would tell a user who accepted v1 that they have never
   * accepted anything, the moment LEGAL_VERSION is bumped to 2.
   */
  | { kind: 'required'; reason: 'first-run' | 'updated'; previous?: LegalAcceptance };

/**
 * The three routes the gate blocks.
 *
 * Normative and stated identically in docs/03 §4, docs/14 §2 and the docs/15
 * decision log: `#settings` and `#about` stay reachable, `#about` so the linked
 * documents can be read before accepting and `#settings` so a VI/JA user can
 * switch language first — which is why the gate carries no switcher of its own.
 */
const GATED_ROUTES: readonly Route[] = Object.freeze(['import', 'export', 'edit']);
const UNGATED: readonly Route[] = Object.freeze([]);

let status = $state<LegalStatus>({ kind: 'loading' });

/**
 * Pure gate decision, so the rule is testable without touching storage.
 *
 * A stored version GREATER than the current one still counts as accepted: it
 * means the user ran a newer build, and re-gating them on a downgrade would be
 * noise, not consent.
 */
export function decideLegalStatus(
  acceptance: LegalAcceptance | null,
  currentVersion: number,
): LegalStatus {
  if (acceptance === null) return { kind: 'required', reason: 'first-run' };
  if (acceptance.acceptedVersion < currentVersion) {
    return { kind: 'required', reason: 'updated', previous: acceptance };
  }
  return { kind: 'accepted', acceptance };
}

export function getLegalStatus(): LegalStatus {
  return status;
}

export function isGateRequired(): boolean {
  return status.kind === 'required';
}

/**
 * The most recent acceptance on record, current or superseded.
 *
 * About renders this, so it must survive a `LEGAL_VERSION` bump — the user did
 * accept the older terms, and saying otherwise is simply false.
 */
export function getAcceptance(): LegalAcceptance | undefined {
  if (status.kind === 'accepted') return status.acceptance;
  if (status.kind === 'required') return status.previous;
  return undefined;
}

/** `[]` unless the gate is up. Never `undefined`, so the TabBar prop is simple. */
export function getBlockedRoutes(): readonly Route[] {
  return status.kind === 'required' ? GATED_ROUTES : UNGATED;
}

export function isGatedRoute(route: Route): boolean {
  return GATED_ROUTES.includes(route);
}

/**
 * Read the stored acceptance. Call once per page, before the first render.
 *
 * `readLegal` already swallows storage failures and returns null, so an
 * unreadable store lands on `required`. That is the correct direction: showing
 * the gate to someone who accepted is recoverable in one click; skipping it for
 * someone who has not is not recoverable at all.
 */
export async function loadLegal(): Promise<void> {
  status = decideLegalStatus(await readLegal(), LEGAL_VERSION);
}

/**
 * Adopt an acceptance recorded by another Manager tab — **one way only**.
 *
 * Accepting in one tab drops the gate in the other. The reverse is deliberately
 * unreachable: `App.svelte` renders the gate *in place of* the tab body, so an
 * externally-raised gate would unmount `ImportTab` mid-write and strand the
 * import it was driving — recreating, through a third door, exactly the
 * deadlock the routing guard and the store-held attestation resolver exist to
 * close. Clearing storage in another tab therefore does nothing here; a reload
 * is what re-evaluates the gate downward, and that is a fresh page with no
 * in-flight work to strand.
 *
 * @returns whether the gate was dropped.
 */
export function adoptExternalLegal(acceptance: LegalAcceptance | null): boolean {
  if (status.kind === 'accepted') return false;
  const next = decideLegalStatus(acceptance, LEGAL_VERSION);
  if (next.kind !== 'accepted') return false;
  status = next;
  return true;
}

/**
 * Record acceptance.
 *
 * The ordering is the whole point: write, await, and flip to `accepted` ONLY
 * once the write resolves. Dismissing optimistically would leave the user
 * accepted in the UI and unaccepted on disk, so the gate would silently
 * reappear on the next launch with no explanation.
 *
 * @param nowIso supplied by the caller so this module stays free of ambient
 *   time, matching the discipline `browser/storage.ts` set up.
 */
export async function acceptLegal(nowIso: string): Promise<SaveOutcome> {
  try {
    await writeLegal(LEGAL_VERSION, nowIso);
  } catch (err) {
    // Returned, not thrown: a rejection here would need a .catch() at every
    // call site, and one miss is an unhandled rejection with the gate stuck.
    return { ok: false, ...(err instanceof Error && { detail: err.message }) };
  }
  status = { kind: 'accepted', acceptance: { acceptedVersion: LEGAL_VERSION, acceptedAt: nowIso } };
  return { ok: true };
}
