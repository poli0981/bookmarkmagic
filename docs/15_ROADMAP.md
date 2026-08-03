# 15 — Roadmap

## v1.0 — MVP (store launch) — ✔ SHIPPED

Everything in `00_PROJECT_OVERVIEW.md §6`. Definition of done was
`CLAUDE.md` Phase 5 exit criteria + manual QA checklist green + store
approval — **all three met; published by 2026-08-03.** This section is now a
record rather than a plan.

Build-phase breakdown lives in `CLAUDE.md` (single source for sequencing).

### Build progress

| Phase | State | Notes |
|---|---|---|
| 0 — Scaffold | ✔ 2026-07-25 | WXT + Svelte 5 + TS 6, `srcDir: 'src'`, guard + icon scripts |
| 1 — Core library | ✔ 2026-07-25 | 3 parsers, 4 serializers, dedupe/diff/plan; 600 seeded round-trips |
| 2 — Browser layer + #import | ✔ 2026-07-25 | adapter, write queue, stores, full import flow incl. forced backup |
| 3 — #export + #edit | ✔ 2026-07-25 | tri-state picker, tree CRUD, search, duplicates, DnD + keyboard parity |
| 4 — i18n, theming, Settings, About, Legal Gate | ✔ 2026-07-26 | switcher + theme controls, six-row `#settings`, `#about`, first-run gate; Intl retrofit; store-backed Toast |
| 5 — Hardening + release prep | ✔ 2026-07-26 | contrast tokens + a test that enforces them, `EditTab` split under the hard limit, CHANGELOG + README, four CI callers, T1–T8 pass, clean-room `wxt zip` |
| **v1.0.0 released** | ✔ 2026-07-26 | signed tag, GitHub Release with a `sha256sum -c`-verified zip, submitted to the Chrome Web Store |
| **v1.0.0 published** | ✔ by 2026-08-03 | approved by CWS review with no rejection recorded; listing public, item id `eghnciphhegekmnofffpgbdfefckdhmg`, **real users installed** |
| 6 — Post-launch stabilization | ✔ 2026-08-03 | doc reconciliation, user-intake machinery, the defects below, dependency bumps → v1.0.1 |
| **v1.0.1 released** | ✔ 2026-08-03 | signed tag on `4654086`, GitHub Release with a `sha256sum -c`-verified zip; shipped manifest `1.0.1`, permissions unchanged. `announce` skipped (no `DISCORD_ANNOUNCE`), store publish skipped (no `CWS_AUTOPUBLISH`) |
| **v1.0.1 submitted** | ✔ 2026-08-03 | uploaded to the CWS dashboard by hand (`13 §1b` step 6). ⚠️ **In review — not yet approved.** Add a "published" row only when the listing actually shows 1.0.1, and then run `13 §1b` step 10 |

**Verified on real browsers 2026-07-25:** Chrome and Brave, unpacked build.
Until that point every phase had been tested only against a hand-rolled
`chrome.bookmarks` mock, because WXT's `fakeBrowser` stubs that API with
"not implemented" throws (`11 §4`).

**Phase 4 verified on a real browser 2026-07-26**, after the review fixes
landed. Covered: the Legal Gate (appears once, blocks the three routes, leaves
`#settings`/`#about` reachable pre-accept, re-renders in the language chosen
before accepting, and persists across a restart); EN→VI→JA live switching with
localized numbers and dates, and the header and `#settings` controls staying in
agreement; theme system/light/dark; settings surviving an immediate tab close —
the path the `$state`-proxy `DataCloneError` would have broken; and the Phase
2–3 import/export/edit flows still working after Phase 4 touched their tabs and
the settings store.

Every phase was adversarially reviewed after implementation and **every review
found real defects** — 7, 13 and 14 in phases 1–3, 19-of-33-filed in phase 4,
8-of-20 in phase 5 — several in the paths that delete bookmarks. Budget that
review into any future work; a green test run has not once meant "done" on this
project.

Phase 5's own lesson is worth keeping: its three worst findings were defects in
work added **earlier in the same branch** — a release workflow that would have
failed on the first tag, a contrast test blind to its own bypass (`opacity` on
text, which a token-level check cannot see), and a README claiming a test
asserted the *built* manifest when it only read the config source. Review new
work as hard as old work.

And three defects reached `main` that no automated gate could ever have caught,
all found by a human looking at the running extension or at a real CI run: the
footer's missing space, a moon glyph that renders as a capital "C", and a
reusable-workflow permission grant that produced a `startup_failure` with no
jobs and no log.

Phase 4's own review filed 33 findings across six lenses; 19 survived
adversarial verification. The most serious was a first-run dead-end: the gate
rendered only on the three routes it blocked, and those three tabs were the
only in-app navigation to them — so a user who reached `#settings` (via the
popup's new gear, which opens a fresh tab with no history) could never get
back to the accept UI.

Phase 4 also found three latent defects in code that 338 green tests had
already signed off, all unreachable until Phase 4 gave them a caller:
`writeSettings` handed a `$state` proxy to `chrome.storage.local.set` (would
throw `DataCloneError` in a real browser — `fakeBrowser` stores the reference
without cloning, so the suite could not see it); `updateSettings` replaced the
settings object rather than mutating it, which would strand any component that
captured it; and footer navigation during `attesting` stranded the import's
attestation resolver, deadlocking it until reload.

## v1.0.x — stabilization (**the live workstream since 2026-08-03**)

This was speculative when written. It is now the actual next work, because real
users and a public listing exist.

### Intake — how a report becomes a fix

There is exactly one path, and every step has an owner in the repo:

1. A user files `.github/ISSUE_TEMPLATE/parser_report.yml`, which **requires** a
   sanitized sample (`scripts/sanitize-bookmarks.mjs`) and an explicit consent
   checkbox that the sample may be committed as a GPL-3.0 test fixture.
2. The sample lands in `tests/fixtures/`. Note `.gitattributes` sets
   `tests/fixtures/** -text`, so EOL normalization cannot destroy the CRLF/BOM
   bytes the bug may depend on.
3. A regression test lands in `tests/unit/core/fixtures.test.ts` — the only
   fixture-driven suite — **in the same PR** as the parser fix (`11 §2`).
4. The quirk is noted in the parser source and in `04 §1.2` (`CLAUDE.md`
   working style makes this mandatory, not optional).
5. `11 §2`'s inventory and `CHANGELOG.md [Unreleased]` are updated.

Translation fixes use `.github/ISSUE_TEMPLATE/translation.yml` and follow
`07 §4`; the JA native review pass (`ja.ts`'s `TODO(review-ja)`) is the
outstanding one, and it is user-facing now.

### Release trigger

Cut a patch when **any** of these is true, rather than on a schedule:

- a parser-tolerance fix exists (a user is currently unable to import a file);
- a data-integrity or dead-end defect is fixed;
- a batch of translation fixes has accumulated;
- a dependency fix is needed for a real advisory.

Listing copy tweaks alone do **not** need a patch — the store listing is edited
independently of the package (`13 §5`), though the copy should still go through
`store/listing.{en,vi,ja}.md` first so it is reviewable.

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
| 2026-07-26 | Legal Gate renders **inside the content region**, not as a viewport overlay — `06 §3`'s "full overlay" reconciled in favour of `14 §2`'s reachable `#settings`/`#about` | 06 §3 |
| 2026-07-26 | Settings state mutates **in place**; every storage write passes a plain snapshot (a `$state` proxy is not structured-cloneable, so the old code would have thrown `DataCloneError` in a real browser) | 03 §4 |
| 2026-07-26 | `updateSettings` / `acceptLegal` return non-rejecting outcomes; UI feedback follows the write, never precedes it | 03 §4 |
| 2026-07-26 | Toast queue + timers live in a store, so they survive the route chain unmounting | 06 §4 |
| 2026-07-26 | Static outbound links use `<a target="_blank" rel="noopener noreferrer">`; imported bookmark URLs keep `tabs.create` (`09` T3 unchanged). Two mechanisms for two trust classes — do not harmonize | 09 T3 |
| 2026-07-26 | `#settings` has **six** rows: `markdownStyle` was persisted but only editable as a transient `#export` control | 06 §3.4 |
| 2026-07-26 | `locale: 'auto'` is a first-class fourth option in the switcher — it is the default, so it must be selectable | 06 §3.4 |
| 2026-07-26 | Language labels are endonyms, duplicated identically across the three dicts (the `common.appName` precedent) | 07 §4 |
| 2026-07-26 | Theme control is a three-way segmented control in both header and `#settings`, not a cycling `◐` | 06 §3 |
| 2026-07-26 | Version comes from the manifest at runtime; three hardcoded `0.1.0` literals removed (footer, `run-export`, `run-import`) | 06 §3.5 |
| 2026-07-26 | ~~About's "Changelog" points at GitHub Releases until `CHANGELOG.md` exists in Phase 5~~ — **resolved in Phase 5**: `links.ts` targets `CHANGELOG.md` and `tests/unit/links.test.ts` asserts both the URL shape and that the file exists | 06 §3.5 |
| 2026-07-26 | The gate's acceptance checkbox deliberately resets if the user navigates away and back — an un-submitted legal affirmation is not worth persisting | 14 §2 |
| 2026-07-26 | Both entrypoints await settings (Manager also legal) **before** `mount()`, trading a blank frame for no locale/theme/gate flicker | 02 §2 |
| 2026-07-26 | ~~**Known limitation:** two open Manager tabs do not sync settings or acceptance to each other; last write wins. No `storage.onChanged` listener in v1~~ — **superseded 2026-08-03**, see the Phase 6 rows below | 03 §4 |
| 2026-07-26 | Transitive dev-dep CVEs fixed with a `package.json` `overrides` block rather than by waiting on parents — every parent pinned a vulnerable range, which is why Dependabot's own PRs all failed | 09 §3.1 |
| 2026-07-26 | The release announcement is `continue-on-error`. A missing Discord webhook made the real v1.0.0 run red on a release whose zip and checksums had published correctly; a red run on a good release trains you to ignore the colour | 12 §2.3 |
| 2026-07-26 | Gate-blocked tabs stay **clickable**; what blocks a route is the gate replacing the tab body, not an inert button. Disabling them removed the only in-app path back to the accept UI | 06 §3 |
| 2026-07-26 | Failure UI shows the localized sentence and puts the raw browser error in a separate detail block — `detail ?? t(key)` made every translation dead code | 02 §7 |
| 2026-07-26 | `--accent-fg` is redefined in the dark blocks alongside `--accent`; white on the lightened violet measured 3.67:1 | 06 §5 |
| 2026-07-26 | Plural keys implemented per `07 §5` (`selectPluralForm` + `tPlural`); `import.warnings.title` and all seven `warnings.*` codes converted | 07 §5 |
| 2026-07-26 | The import session stores an i18n **key**, not a resolved string — `t()` is only reactive where it is called, so a stored sentence never follows a language switch | 03 §5 |
| 2026-08-03 | **Every destructive step reports what already landed.** `writeTree` and `clearRoots` wrap their failing `chrome.*` call in `BmPartialWrite{phase, done}`, matching the contract `BmAborted` already had. A failure that says only "the browser refused" tells a user whose tree was half-replaced nothing they can act on | 02 §7, 03 §1 |
| 2026-08-03 | **`BmAborted` is re-thrown before the partial-write wrap.** Wrapping it would relabel every user cancellation as a failure and make `import.cancelledSummary` dead code — the same defect class as `detail ?? t(key)` | 03 §1 |
| 2026-08-03 | **The import report states that imported bookmarks carry today's date.** `05 §6` and `00 §8` both required this and no string ever said it. Shown in the `parsed` state too — telling someone before they commit beats telling them after | 03 §1, 05 §6 |
| 2026-08-03 | **Routing is guarded while a write or attestation is in flight**, via an injected predicate rather than a store import, so `route` stays uncoupled. Browser Back during `attesting` previously deadlocked the Manager permanently: the same hole Phase 4 closed for the footer and TabBar, left open on `hashchange` | 02 §5 |
| 2026-08-03 | **The attestation resolver lives in the import store, not in `ImportTab`.** A component-local resolver dies with the component; a remounted tab then renders inert buttons. A stale or reset resolver settles **`false`** — an unanswered backup attestation must never read as consent | 03 §1 6b |
| 2026-08-03 | **Two Manager tabs now converge.** Settings adopt external changes under two rules: ignore anything arriving while this context has an unflushed write (last-write-wins, as before), else adopt only when a field actually differs. Field equality makes self-echo suppression fall out for free — no snapshot to go stale | 03 §4 |
| 2026-08-03 | **Legal acceptance is adopted in one direction only — toward accepted.** The gate replaces the tab body, so an externally-raised gate would unmount `ImportTab` mid-write and recreate the attestation deadlock through a third door. One-way makes that unreachable by construction | 03 §4, 14 §2 |
| 2026-08-03 | **One `ErrorCallout` owns the localized-sentence-plus-detail-block contract.** Three sites still rendered a raw English Chrome string as the whole message after `LegalGate` had already been fixed for exactly that | 02 §7 |
| 2026-08-03 | **`NO_WRITABLE_ROOTS` is its own error, not `BROWSER`.** A profile with no writable root is an absence, not a refusal; reporting "the browser refused" sends the user looking for the wrong thing | 02 §7 |
| 2026-08-03 | **Search-driven expansion is undone when the search clears**, tracked separately from folders the user opened by hand. Merging into `expanded` was deliberate (a render-time union broke the disclosure button) — the missing half was the un-merge | 03 §3, 06 §3.3 |
| 2026-08-03 | **The "if you contact us" paragraph in `legal/PRIVACY.md` is a clarification, not a material change** — it describes what happens to data a user chooses to send, which was never inside "what the extension collects". `LEGAL_VERSION` deliberately **not** bumped: re-showing the gate to every installed user over a patch is a worse outcome than the ambiguity it fixes | 14 §2, 14 §3 |
| 2026-08-03 | **A WXT bump is accepted only after diffing the BUILT manifest**, not on a green test run. `tests/unit/manifest.test.ts` reads `wxt.config.ts`, which a WXT upgrade cannot change, so it stays green no matter what WXT emits. 0.21.3 was verified byte-identical in manifest, file inventory and bundle size; it did break `wxt/testing` into two subpaths and retype `tabs.create` as `void`, both dev-only. `check-manifest.mjs` now asserts the exact top-level key set so the next one is caught by CI rather than by hand | 01 §2, 12 §2.3 |
| 2026-08-03 | **jsdom 30 accepted after running `dom-environment.test.ts` first.** The canary exists because the Netscape walk depends on parse5's implied-end-tag behaviour; the rule is that a failing canary pins the dependency, never loosens the test. The 2 869 ms figure in `11 §6` is a jsdom **29** number and a major bump adds a column rather than overwriting it | 01 §2, 11 §6 |
| 2026-08-03 | **`continue-on-error` is invalid on a job that calls a reusable workflow** — GitHub rejects the file with "Property continue-on-error is not allowed", and a rejected file is a `startup_failure` with zero jobs and no log, not a failed job. `release.yml`'s announce job had carried it since `5f4c6e7`; that commit landed *after* the `v1.0.0` tag and no tag was pushed since, so **the first v1.0.1 tag would have been its first execution**. Both notification jobs are now gated with `if:` on a repo variable — allowed there, unlike a secret — defaulting to skipped | 12 §2.3, 12 §2.4 |
| 2026-08-03 | **A notification must never change the colour of the thing it reports on.** `notify-ci-failure.yml` had been failing on *every* CI completion, success included, because the reusable declares a secret that does not exist and GitHub validates that before the reusable's own success filter runs. Same lesson as `5f4c6e7`, learned twice | 12 §2.4 |
| 2026-08-03 | **No support email on any in-product surface.** About links to the store listing, the repo, issues and the changelog. Publishing an address inside the extension invites unsanitized bookmark files by mail, which is the exact receipt-of-personal-data problem the privacy clause exists to bound. The address stays in `SECURITY.md`, `CONTRIBUTING.md` and the privacy policy | 06 §3.5, 09 §6 |
