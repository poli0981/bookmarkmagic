# CLAUDE.md — Build Instructions (BookmarkMagic)

You are building a Chrome MV3 extension: offline bookmark import/export/edit.
This file is the entry point; the `docs/` suite is the specification.
**When code and docs disagree, docs win — or stop and ask.**

## Doc index (read 00–02 fully before writing any code)

| Doc | Contents |
|---|---|
| docs/00_PROJECT_OVERVIEW.md | Vision, scope, non-goals, naming ⚠, manual action items |
| docs/01_TECH_STACK.md | Pinned versions, rejected deps, npm scripts |
| docs/02_ARCHITECTURE.md | Layout, layer rules, data model, routing, error strategy |
| docs/03_DATA_FLOW.md | Import/export/edit pipelines, state machine |
| docs/04_FILE_FORMATS.md | Netscape HTML / BM JSON / CSV / Markdown specs |
| docs/05_ALGORITHMS.md | Parser walk, normalize, dedupe, diff, write queue |
| docs/06_UI.md | Tokens, layouts per tab, component inventory, a11y |
| docs/07_I18N.md | chrome.i18n vs runtime store split, EN/VI/JA rules |
| docs/08_MV3_COMPLIANCE.md | Manifest, permissions (bookmarks+storage ONLY), CWS rules |
| docs/09_SECURITY_PRIVACY.md | Threat model T1–T8, secure-coding bans |
| docs/10_CODING_STANDARDS.md | Size limits, tsconfig, biome.json, knip.json, conventions |
| docs/11_TESTING.md | Coverage gates, fixtures, suites, manual QA |
| docs/12_CI_CD.md | Ops-repo caller stubs, release automation |
| docs/13_RELEASE_PUBLISHING.md | Store runbook + listing copy |
| docs/14_LEGAL_GATE.md | Gate spec + legal file drafts |
| docs/15_ROADMAP.md | Version plan, never-list, decision log |

## Hard rules (violations = stop and ask)

1. Permissions are exactly `["bookmarks", "storage"]`.
2. Zero runtime dependencies. New dep ⇒ ask first (docs/01 §4).
3. No `fetch`/network calls, no `eval`, no `{@html}`, no `innerHTML` writes.
   The canonical gate is docs/08 §3, run as `npm run guard`.
4. `src/lib/core/` never imports browser APIs, Svelte, or `src/lib/browser`.
5. Files ≤300 lines (hard 500); functions ≤50 (hard 80).
6. Every string user-visible ⇒ i18n key in en+vi+ja (en is schema; vi/ja
   `satisfies Dict`, where `Dict = typeof dict` is exported from
   `locales/en.ts`). **Never `as const` on a locale file** — docs/07 §2.
7. TypeScript strict; no `any`; casts need `// SAFETY:` comments.
8. Conventional Commits; `npm run verify` green before every commit.

## Build phases (each ends with `npm run verify` green + a commit)

### Phase 0 — Scaffold
`npx wxt@latest init` (svelte template) → apply docs/01 versions & scripts
(incl. `postinstall: wxt prepare`), `srcDir: 'src'` per docs/02 §2, docs/10
configs (tsconfig/biome/knip/vitest), directory skeleton per docs/02,
tokens.css per docs/06 §1, manifest per docs/08 §1, empty locale dicts per
docs/07. Also land up front, because later phases link to them from the first
screens: `.nvmrc`, `.gitignore`, `.github/FUNDING.yml` (copy from
`switch-every-tab-hotkey`), `SECURITY.md`, the four `legal/` drafts from
docs/14 §3, `scripts/guard.mjs` (docs/08 §3) and `scripts/gen-icons.mjs`
(placeholder PNGs so the manifest loads).
**Exit:** `npm run dev` loads popup+manager; verify green.

### Phase 1 — Core library (pure TS + tests FIRST-CLASS)
Implement `src/lib/core/` per docs/04+05: model, limits, timestamps,
normalize-url, detect-format, parsers (netscape-html, bm-json, csv),
serializers (all four), dedupe, diff. Commit fixtures per docs/11 §2 and the
full unit suites incl. round-trip + randomized trees.
**Exit:** coverage ≥90% on core; all fixtures parse; round-trips pass.

### Phase 2 — Browser layer + Import tab
`src/lib/browser/` (bookmarks wrapper, write-queue + tests, storage,
download, open-manager), stores, hash routing, Manager shell + TabBar,
full #import flow per docs/03 §1 (DropZone → preview → options → backup →
progress → report) and popup buttons.
**Exit:** manual: import chrome fixture on fresh profile in all 3 modes;
cancel works; 10k file stays responsive.

### Phase 3 — Export + Edit tabs
#export per docs/03 §2 (FolderPickTree tri-state, format cards, download).
#edit per docs/03 §3 + docs/06 §3.3 (TreeView CRUD, DnD + Move-to parity,
search, duplicate panel, live event sync, ARIA tree keyboard nav).
**Exit:** QA checklist items for export/edit pass; exported HTML re-imports
losslessly.

### Phase 4 — i18n, theming, Settings, About, Legal Gate
Full dictionaries (en→vi→ja), language switcher, theme toggle+persistence,
#settings, #about (links, donate handles per docs/14 §5, "Third-party: None"),
LegalGate per docs/14 §2 — blocks #import/#export/#edit only.
**Exit:** language/theme QA items pass; gate blocks/persists correctly.

### Phase 5 — Hardening + release prep
Security pass against docs/09 T1–T8 (incl. injection fixtures manually),
performance budgets docs/11 §6, CI workflows per docs/12 §2 (explicit
`permissions:` blocks on every caller — and note the ops repo has **no**
`browser-extension-*` family), CHANGELOG, README (badges, screenshots ⚠,
install, privacy summary, donate), full manual QA (docs/11 §5), `wxt zip`
clean-install test.
**Exit:** ready for the docs/13 §1 runbook (human performs store submission).

## Working style

- Small commits per module; tests land with (or before) implementation.
- When a browser fixture contradicts the format spec: add the fixture, make
  the parser tolerant, note the quirk in code + docs/04 §1.2, then continue.
- Do not invent features not in docs; park ideas as `docs/15` roadmap PRs.
- Anything marked ⚠️ is human-only — surface it in your summary, don't fake it.
