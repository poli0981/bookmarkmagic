import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import { LEGAL_VERSION } from '@/lib/core/limits';
import {
  acceptLegal,
  adoptExternalLegal,
  decideLegalStatus,
  getAcceptance,
  getBlockedRoutes,
  getLegalStatus,
  isGatedRoute,
  isGateRequired,
  loadLegal,
} from '@/lib/stores/legal.svelte';

const ACCEPTED_AT = '2026-07-25T10:00:00.000Z';

beforeEach(() => {
  fakeBrowser.reset();
  // reset() clears data but leaves spies, so a rejecting storage.local.set
  // would otherwise leak into every later test in this file.
  vi.restoreAllMocks();
});

describe('decideLegalStatus', () => {
  it('gates a fresh profile as first-run', () => {
    expect(decideLegalStatus(null, 1)).toEqual({ kind: 'required', reason: 'first-run' });
  });

  it('gates an older acceptance as an update, KEEPING the superseded record', () => {
    // Without `previous`, the About tab tells a user who accepted v1 that they
    // have never accepted anything the moment LEGAL_VERSION becomes 2.
    const previous = { acceptedVersion: 0, acceptedAt: ACCEPTED_AT };
    expect(decideLegalStatus(previous, 1)).toEqual({
      kind: 'required',
      reason: 'updated',
      previous,
    });
  });

  it('accepts a matching version', () => {
    const acceptance = { acceptedVersion: 1, acceptedAt: ACCEPTED_AT };
    expect(decideLegalStatus(acceptance, 1)).toEqual({ kind: 'accepted', acceptance });
  });

  it('accepts a version NEWER than the current one', () => {
    // The user ran a newer build. Re-gating them on a downgrade would be noise,
    // not consent.
    const acceptance = { acceptedVersion: 2, acceptedAt: ACCEPTED_AT };
    expect(decideLegalStatus(acceptance, 1)).toEqual({ kind: 'accepted', acceptance });
  });
});

describe('blocked routes', () => {
  it('names exactly the three routes docs/14 §2 blocks', async () => {
    await loadLegal();
    expect(isGateRequired()).toBe(true);
    expect([...getBlockedRoutes()]).toEqual(['import', 'export', 'edit']);
  });

  it('leaves #settings and #about reachable', () => {
    // Normative in docs/03 §4, docs/14 §2 and the docs/15 decision log:
    // #about so the documents can be read first, #settings so a VI/JA user can
    // switch language -- which is why the gate has no switcher of its own.
    expect(isGatedRoute('settings')).toBe(false);
    expect(isGatedRoute('about')).toBe(false);
    expect(isGatedRoute('import')).toBe(true);
  });

  it('blocks nothing once accepted', async () => {
    await fakeBrowser.storage.local.set({
      legal: { acceptedVersion: LEGAL_VERSION, acceptedAt: ACCEPTED_AT },
    });
    await loadLegal();
    expect(isGateRequired()).toBe(false);
    expect([...getBlockedRoutes()]).toEqual([]);
  });
});

describe('loadLegal', () => {
  it('fails closed on a malformed record', async () => {
    await fakeBrowser.storage.local.set({ legal: { acceptedVersion: 'yes' } });
    await loadLegal();
    expect(isGateRequired()).toBe(true);
  });

  it('fails closed, without throwing, when the read rejects', async () => {
    vi.spyOn(fakeBrowser.storage.local, 'get').mockRejectedValue(new Error('storage disabled'));
    await expect(loadLegal()).resolves.toBeUndefined();
    expect(getLegalStatus()).toEqual({ kind: 'required', reason: 'first-run' });
  });

  it('still reports the superseded acceptance after a version bump', async () => {
    await fakeBrowser.storage.local.set({
      legal: { acceptedVersion: LEGAL_VERSION - 1, acceptedAt: ACCEPTED_AT },
    });
    await loadLegal();
    expect(isGateRequired()).toBe(true);
    expect(getAcceptance()).toEqual({
      acceptedVersion: LEGAL_VERSION - 1,
      acceptedAt: ACCEPTED_AT,
    });
  });

  it('reports no acceptance at all on a fresh profile', async () => {
    await loadLegal();
    expect(getAcceptance()).toBeUndefined();
  });

  it('exposes the stored acceptance for the About tab', async () => {
    await fakeBrowser.storage.local.set({
      legal: { acceptedVersion: LEGAL_VERSION, acceptedAt: ACCEPTED_AT },
    });
    await loadLegal();
    expect(getAcceptance()).toEqual({ acceptedVersion: LEGAL_VERSION, acceptedAt: ACCEPTED_AT });
  });
});

describe('acceptLegal', () => {
  it('persists the version and timestamp, then unlocks', async () => {
    await loadLegal();
    expect(await acceptLegal(ACCEPTED_AT)).toEqual({ ok: true });

    const stored = await fakeBrowser.storage.local.get('legal');
    expect(stored.legal).toEqual({ acceptedVersion: LEGAL_VERSION, acceptedAt: ACCEPTED_AT });
    expect(isGateRequired()).toBe(false);
  });

  it('KEEPS THE GATE UP when the write rejects, and writes nothing', async () => {
    // The flagship test of this phase. The recurring defect shape in this
    // project is: dismiss optimistically, await a chrome.* call that can
    // reject, never handle it. Here that would leave the user accepted in the
    // UI and unaccepted on disk, with the gate silently back next launch.
    await loadLegal();
    vi.spyOn(fakeBrowser.storage.local, 'set').mockRejectedValue(
      new Error('QUOTA_BYTES quota exceeded'),
    );

    const outcome = await acceptLegal(ACCEPTED_AT);
    expect(outcome.ok).toBe(false);
    expect(outcome.detail).toContain('QUOTA_BYTES');
    expect(isGateRequired()).toBe(true);
    expect(getAcceptance()).toBeUndefined();

    const stored = await fakeBrowser.storage.local.get('legal');
    expect(stored.legal).toBeUndefined();
  });

  it('never rejects, so no call site can leak an unhandled rejection', async () => {
    vi.spyOn(fakeBrowser.storage.local, 'set').mockRejectedValue(new Error('nope'));
    await expect(acceptLegal(ACCEPTED_AT)).resolves.toMatchObject({ ok: false });
  });

  it('writes nothing at all when the user declines', async () => {
    // docs/14 §2: "no nagging -- closing the tab is the decline. Nothing is
    // written." Closing is a component action; the contract is that merely
    // showing the gate never touches the legal key.
    await loadLegal();
    const all = await fakeBrowser.storage.local.get(null);
    expect(Object.keys(all)).not.toContain('legal');
  });
});

/**
 * Cross-tab adoption — docs/03 §4, docs/14 §2.
 *
 * Deliberately one-way. `App.svelte` renders the gate *in place of* the tab
 * body, so an externally-raised gate would unmount ImportTab mid-write and
 * strand the import it was driving — the same deadlock the routing guard and
 * the store-held attestation resolver exist to close, reached through a third
 * door. These tests exist so a future "simplification" that makes it
 * symmetrical fails loudly rather than shipping.
 */
describe('adoptExternalLegal', () => {
  it('drops the gate when another tab accepts', async () => {
    await loadLegal();
    expect(isGateRequired()).toBe(true);

    expect(adoptExternalLegal({ acceptedVersion: LEGAL_VERSION, acceptedAt: 'x' })).toBe(true);
    expect(isGateRequired()).toBe(false);
  });

  it('does NOT re-gate when another tab clears the acceptance', async () => {
    await fakeBrowser.storage.local.set({
      legal: { acceptedVersion: LEGAL_VERSION, acceptedAt: 'x' },
    });
    await loadLegal();
    expect(isGateRequired()).toBe(false);

    expect(adoptExternalLegal(null)).toBe(false);
    expect(isGateRequired()).toBe(false);
  });

  it('does NOT re-gate on a superseded record either', async () => {
    await fakeBrowser.storage.local.set({
      legal: { acceptedVersion: LEGAL_VERSION, acceptedAt: 'x' },
    });
    await loadLegal();

    expect(adoptExternalLegal({ acceptedVersion: LEGAL_VERSION - 1, acceptedAt: 'old' })).toBe(
      false,
    );
    expect(isGateRequired()).toBe(false);
  });

  it('ignores a stale record while the gate is up, rather than accepting it', async () => {
    await loadLegal();
    expect(adoptExternalLegal({ acceptedVersion: LEGAL_VERSION - 1, acceptedAt: 'old' })).toBe(
      false,
    );
    expect(isGateRequired()).toBe(true);
  });
});
