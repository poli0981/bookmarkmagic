# 00 — Project Overview

> **Project:** BookmarkMagic
> **Type:** Chrome/Chromium MV3 browser extension (open source, Chrome Web Store)
> **Owner:** poli0981 (GitHub) / SkullMute
> **Repo:** `poli0981/bookmarkmagic` ✔
> **License:** GPL-3.0-or-later
> **Status:** **v1.0.0 is PUBLISHED on the Chrome Web Store and has real users.**
> Submitted 2026-07-26, approved and live by 2026-08-03 (⚠️ exact approval date
> to be recorded by the owner). Listing:
> <https://chromewebstore.google.com/detail/bookmarkmagic/eghnciphhegekmnofffpgbdfefckdhmg>.
> Signed tag `v1.0.0`, GitHub Release with a checksum-verified zip. Verified
> working on real Chrome and Brave.
>
> The project is now in **maintenance**, not construction: every change from
> here reaches installed users through a store review, so it needs a version
> bump, a CHANGELOG entry and an update submission (`13 §1b`). Sequencing lives
> in `/CLAUDE.md`; what is still open is in §10 below.
> **Doc suite version:** 1.5 (2026-08-03 — post-launch reconciliation)

---

## 1. Vision

A 100% offline bookmark toolbox: **import, export, and edit bookmarks and full
folder trees between different browsers** — without accounts, without cloud
sync, without vendor lock-in.

The user's data never leaves their device. The extension is the "USB stick"
for bookmarks: plug a file in, get a file out.

## 2. Problem statement

Moving bookmarks between browsers (Chrome ↔ Edge ↔ Brave ↔ Firefox ↔ Safari)
or between machines normally requires either:

- signing in to each vendor's sync service (privacy cost, account friction), or
- each browser's buried, inconsistent native import/export screens, with no
  preview, no merge control, no dedupe, and no editing.

## 3. Solution

One extension page with three capabilities:

| Capability | Summary |
|---|---|
| **Import** | Validate a bookmark file → preview the tree + stats → choose merge mode + dedupe → write into the browser with progress reporting. |
| **Export** | Pick scope (all / specific folders) → pick format → download a file compatible with every major browser. |
| **Edit**   | Full tree manager: search, rename, move (drag & drop), delete, create folders, find duplicates. |

## 4. Product principles

1. **Offline-first, always.** No network requests at runtime. No analytics. No
   telemetry. This is a hard rule, not a default.
2. **Minimal permissions.** `bookmarks` + `storage` only. No host permissions,
   no content scripts, no `tabs`.
3. **Zero runtime dependencies.** Parsing/serializing uses platform APIs
   (`DOMParser`, `Blob`, `URL`). Dev-time dependencies only.
4. **Never destroy data silently.** Destructive operations (Replace) force an
   automatic safety backup first. Default import mode is non-destructive
   ("into a new folder").
5. **Reviewable code.** Open source, minified-only builds (no obfuscation —
   prohibited by CWS anyway), small files, tested core.

## 5. Target users

- People migrating browsers or machines.
- Privacy-conscious users who refuse vendor sync accounts.
- Power users maintaining large curated bookmark trees (1k–50k items).
- The SkullMute community (bilingual EN/VI audience; JP as third locale).

## 6. Scope — v1.0

- Import: Netscape HTML, BM JSON, CSV.
- Export: Netscape HTML, BM JSON, CSV, Markdown (export-only).
- Merge modes: **New folder (default)** / Merge / Replace all (with forced backup).
- Optional dedupe on import (by normalized URL).
- Tree editor: expand/collapse, search, rename, move, delete, new folder,
  drag & drop, duplicate finder.
- i18n: EN (default), VI, JA. Dark/light theme.
- First-run Legal Gate (EULA, GPL-3.0, Disclaimer, Privacy Policy → GitHub links).
- About tab: version, GitHub repo, third-party list ("None"), donate links.

## 7. Non-goals (v1.0)

- ❌ Cloud sync, accounts, or any server component.
- ❌ Favicon migration (Chrome's `bookmarks` API cannot write favicons;
  `ICON` attributes are tolerated on parse and dropped — documented limitation).
- ❌ Dead-link checking (requires host permissions — deferred, see Roadmap).
- ❌ Firefox/Safari *store* releases (WXT keeps the door open; see Roadmap).
- ❌ Editing browser-native root folders themselves (Bookmarks Bar / Other
  Bookmarks cannot be deleted/renamed — enforced by API anyway).

## 8. Success criteria

- ✔ Chrome Web Store approval on first or second review pass — **approved**
  between 2026-07-26 and 2026-08-03, with no rejection recorded (⚠️ owner: note
  which pass, since it is the only evidence that the `08 §5` privacy answers and
  permission justifications landed correctly, and the baseline against which a
  future *update* rejection would be judged).
- Round-trip fidelity **at the file level**: `parse(serialize(tree))` reproduces
  the tree, per-format and minus each format's documented losses — verified by
  the automated suite (`11 §3`). Note what the platform does *not* allow:
  `chrome.bookmarks.create()` takes no `dateAdded`, so bookmarks written into
  the browser are stamped with the import time. Titles, URLs and structure
  survive a browser import; original dates do not (`05 §6`).
- 10,000-bookmark import completes with responsive UI and live progress.
- Lighthouse-style sanity: manager page interactive < 1s on mid-range hardware.

## 9. Naming — resolved ✔ (2026-07-03)

Final name: **BookmarkMagic** — one word, PascalCase, consistent with the
portfolio (CommandForge, AutoClickForge, IconForge, JSONPrism). The earlier
working title "Bookmark Sync Magic" was dropped because "Sync" implied cloud
syncing — the one thing this product deliberately does not do.

Derived identifiers (canonical across docs and code):

| Context | Value |
|---|---|
| Manifest / store / UI name | `BookmarkMagic` (identical in EN/VI/JA) |
| Repo slug | `poli0981/bookmarkmagic` ✔ |
| Own JSON schema | "BM JSON v1", `"format": "bookmarkmagic"` |
| Code prefix | `Bm*` (`BmParseError`, `BmAborted`) |
| Safety-backup filename | `bookmarkmagic-backup-YYYYMMDD-HHmm.json` |
| Chrome Web Store item id | `eghnciphhegekmnofffpgbdfefckdhmg` (also the value `CHROME_EXTENSION_ID` needs — `12 §3`) |
| Store listing URL | `https://chromewebstore.google.com/detail/bookmarkmagic/eghnciphhegekmnofffpgbdfefckdhmg` |

## 10. Manual action items (human-only) ⚠️

1. ✔ Name decided: **BookmarkMagic**. ✔ Repo slug confirmed —
   `github.com/poli0981/bookmarkmagic`.
2. ✔ Repo created, `LICENSE` committed. Variant resolved: **GPL-3.0-or-later**,
   matching `poli0981/switch-every-tab-hotkey`.
3. ✔ Icon set (16/32/48/128 px) — the owner adopted the `scripts/gen-icons.mjs`
   output as final on 2026-07-26, so the generator is the source of truth rather
   than a placeholder. Regenerate with `npm run icons` after any change.
   ⚠️ **Store assets are unreconciled.** The listing is live, so whatever
   `13 §2` requires was supplied — but nothing in the repo records what, or
   where the originals live. `capture/` holds five README screenshots at
   2512×1440 / 2560×1440, which are *not* the five 1280×800 store screenshots
   `13 §2` specifies, and there is no 440×280 promo tile of any size. Owner:
   either record where the submitted assets live, or correct `13 §2`.
4. ✔ Donate URLs resolved from `.github/FUNDING.yml` (`14 §5`).
   ✔ Contact email filled in and confirmed live: `contact@poli0981.dev`
   (`legal/PRIVACY.md`), alongside the GitHub Issues link.
5. ✔ Chrome Web Store: developer account paid, item created, submitted
   2026-07-26 and **approved — the listing is public and has users**. Listing
   copy and the Privacy tab answers came from `13 §3` and `08 §5`. The store URL
   landed in the README on 2026-07-27 (`ea246aa`) and the item id is now in the
   §9 identifiers table. **Still open:** the asset reconciliation in item 3, and
   `store/listing.{en,vi,ja}.md` — `13 §4` promises the listing copy is
   version-controlled in-repo, and it is not.
6. Repo secrets + settings per `12 §5`. ✔ CodeQL "Default setup" is already
   disabled (the advanced workflow uploads SARIF cleanly). **Still open:**
   - `DISCORD_CI_WEBHOOK` is **not** optional in practice. `notify-ci-failure.yml`
     calls a reusable that declares it `required: true`, so with the secret
     unset that workflow fails on *every* CI completion — success or failure.
     Either set it or accept the caller-side tolerance in `12 §2.4`.
   - `DISCORD_RELEASES_WEBHOOK` / `DISCORD_REPO_WEBHOOK` genuinely are optional;
     the announce job is `continue-on-error` since `5f4c6e7`.
   - The four `CHROME_*` secrets are now a **concrete v1.1 prerequisite**, not a
     maybe: `15` lists automated CWS publishing as the first v1.1 item. One of
     the four is already known — `CHROME_EXTENSION_ID` is the item id in §9. The
     other three come from `npx wxt submit init` (`12 §3`). Note there is no
     dry-run: the first time that step executes it makes a real submission.
7. **Untested:** `npm run dev:firefox` against the `overrides` block in
   `09 §3.1`. Four of those overrides sit under `web-ext-run` and no gate
   exercises that script. Firefox is a v1.0 non-goal (§7), so this blocks
   nothing — but do not assume it works.
8. **Unmeasured:** the 2 s parse budget on a real browser (`11 §6`). The
   recorded 2869 ms is a jsdom figure and settles nothing. `scripts/gen-fixture.mjs`
   now produces the file needed to measure it.

### Post-launch (added 2026-08-03)

9. **JA native review pass.** `src/lib/i18n/locales/ja.ts` carries the repo's
   only `TODO` — "owner reviews VI; JA is best-effort until a native pass". It
   was acceptable pre-launch; it is now shipping to users. `15 §v1.0.x` tracks
   it, and the `translation` issue form is the intake for it.
10. **The published build has never been installed from the store and smoke
    tested.** `13 §1` step 8 became due at approval and no result is recorded.
    It is the only check that the artifact users actually receive matches what
    was tested. Now folded into `11 §5` as a standing pre/post-submission item.

## 11. Reading order

For humans: this file → `15_ROADMAP.md` → the rest as needed.
For Claude Code: **start at `/CLAUDE.md`** (build phases + doc index).
