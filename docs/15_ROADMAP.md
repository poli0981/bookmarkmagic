# 15 — Roadmap

## v1.0 — MVP (store launch) — target: ~1–2 week build

Everything in `00_PROJECT_OVERVIEW.md §6`. Definition of done =
`CLAUDE.md` Phase 5 exit criteria + manual QA checklist green + store
approval.

Build-phase breakdown lives in `CLAUDE.md` (single source for sequencing).

### Build progress

| Phase | State | Notes |
|---|---|---|
| 0 — Scaffold | ✔ 2026-07-25 | WXT + Svelte 5 + TS 6, `srcDir: 'src'`, guard + icon scripts |
| 1 — Core library | ✔ 2026-07-25 | 3 parsers, 4 serializers, dedupe/diff/plan; 600 seeded round-trips |
| 2 — Browser layer + #import | ✔ 2026-07-25 | adapter, write queue, stores, full import flow incl. forced backup |
| 3 — #export + #edit | ✔ 2026-07-25 | tri-state picker, tree CRUD, search, duplicates, DnD + keyboard parity |
| 4 — i18n, theming, Settings, About, Legal Gate | next | dictionaries already exist in EN/VI/JA; the switcher UI does not |
| 5 — Hardening + release prep | pending | CI stubs per `12 §2`, CHANGELOG, README, full QA, `wxt zip` clean install |

**Verified on real browsers 2026-07-25:** Chrome and Brave, unpacked build.
Until that point every phase had been tested only against a hand-rolled
`chrome.bookmarks` mock, because WXT's `fakeBrowser` stubs that API with
"not implemented" throws (`11 §4`).

Each of phases 1–3 was adversarially reviewed after implementation and each
review found real defects (7, 13 and 14 respectively) — several in the paths
that delete bookmarks. Budget that review into the remaining phases; a green
test run has not once meant "done" on this project.

## v1.0.x — stabilization

- Parser-tolerance fixes from real user files (fixture + test per report).
- Translation polish (JA review pass).
- Listing copy tweaks from early reviews.

## v1.1 — quality of life

| Feature | Notes |
|---|---|
| Automated CWS publishing | Flip `CWS_AUTOPUBLISH=true`; `wxt submit` in release workflow (`12 §3`). |
| Import Chrome's internal `Bookmarks` JSON file | New parser (`roots.bookmark_bar/other/synced` shape); users often have this file from profile backups. |
| Import Firefox `.json` backup | GUID/typeCode schema → BookmarkNode mapping. |
| "Export all formats as .zip" | First runtime dep decision: `fflate` (gated, `01 §4`; About/THIRD_PARTY updates per `14 §5`). |
| Aggressive-dedupe toggle | Optional `www.`/`utm_*` stripping in normalize (off by default). |
| Sort folder A→Z action | In #edit context menu (bulk `move` with index). |

## v1.2 — resilience

- **Scheduled local snapshots**: periodic JSON backup. ⚠️ Requires `alarms`
  permission + a background service worker + `downloads` (or OPFS storage)
  → permission-story change ⇒ minor version, docs 08/09 update, privacy tab
  re-review. Decide deliberately; OPFS-based silent snapshots may avoid
  `downloads`.
- Import "undo" (session-scoped): remember created ids → one-click revert.
- Virtualized tree rendering if >100k real-world demand appears.

## v2.0 — reach (each item is a separate go/no-go)

| Candidate | Consideration |
|---|---|
| Firefox Add-ons (AMO) release | WXT multi-target already builds it (`wxt -b firefox`); needs AMO listing, `browser_specific_settings.gecko.id`, separate signing flow. |
| Edge Add-ons store | Same zip usually passes; Partner Center account needed. |
| Dead-link checker | Needs `host_permissions: <all_urls>` → destroys the minimal-permission story. If ever done: **separate companion extension**, not this one. |
| Duplicate auto-merge assistant | Merge metadata (keep oldest addDate) + folder-aware suggestions. |
| Bookmarklet/notes fields | Only if a lossless place exists in Chrome's model (likely not — avoid schema lies). |

## Explicit "never" list (re-affirm before any pivot)

- Cloud sync/accounts/server components — contradicts the product's reason to
  exist.
- Analytics/telemetry of any kind.
- Ads, sponsored bookmarks, affiliate link rewriting.
- Collecting or transmitting bookmark content.

## Decision log

| Date | Decision | Where |
|---|---|---|
| 2026-07-03 | Zero runtime deps; anchor-download over `downloads` permission | 01/02 |
| 2026-07-03 | New-folder as default import mode; forced backup on Replace | 03 |
| 2026-07-03 | Netscape HTML as primary interchange; own JSON schema v1 | 04 |
| 2026-07-03 | No background service worker in v1 | 02 |
| 2026-07-03 | English-canonical legal docs + first-run gate | 14 |
| 2026-07-03 | Final name: **BookmarkMagic** ("Sync" dropped as misleading) | 00 §9 |
| 2026-07-25 | **npm, not pnpm** — deliberate divergence from `switch-every-tab-hotkey`. Do not "fix" it | 01 §5 |
| 2026-07-25 | WXT `srcDir: 'src'` — `entrypoints/`+`public/` live under `src/`, `@` → `src/` | 02 §2 |
| 2026-07-25 | Hold TypeScript on 6.x although 7.0 is GA — svelte-check/Volar need the TS 6 programmatic API until 7.1 | 01 §2 |
| 2026-07-25 | `ImportPlan.segments[]` replaces a single `targetRootId` — merge/replace write to two roots | 02 §4 |
| 2026-07-25 | Legal Gate blocks import/export/edit only; settings+about stay reachable | 03 §4, 14 §2 |
| 2026-07-25 | Round-trip is a **file-level** guarantee, per-format projected; browser import cannot restore dates | 00 §8, 11 §3 |
| 2026-07-25 | CI: ops repo has no `browser-extension-*` family; callers use `reusable-chrome-extension.yml` + a local quality job, release is standalone | 12 §2 |
| 2026-07-25 | Replace deletes nothing until the backup is **proven** — picker `close()` resolving, or an explicit user attestation on the anchor fallback | 03 §1 6b |
| 2026-07-25 | Every `#edit` mutation resyncs from the browser on rejection; roots and `unmodifiable` nodes offer no destructive affordance at all | 03 §3 |
