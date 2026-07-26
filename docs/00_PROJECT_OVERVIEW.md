# 00 — Project Overview

> **Project:** BookmarkMagic
> **Type:** Chrome/Chromium MV3 browser extension (open source, Chrome Web Store)
> **Owner:** poli0981 (GitHub) / SkullMute
> **Repo:** `poli0981/bookmarkmagic` ✔
> **License:** GPL-3.0-or-later
> **Status:** **v1.0.0 released and submitted to the Chrome Web Store**
> (2026-07-26) — all six build phases complete, awaiting store review. Signed
> tag `v1.0.0`, GitHub Release with a checksum-verified zip. Verified working on
> real Chrome and Brave. Sequencing lives in `/CLAUDE.md`; what is still open is
> in §10 below.
> **Doc suite version:** 1.4 (2026-07-26 — v1.0.0 release)

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

- Chrome Web Store approval on first or second review pass.
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

## 10. Manual action items (human-only) ⚠️

1. ✔ Name decided: **BookmarkMagic**. ✔ Repo slug confirmed —
   `github.com/poli0981/bookmarkmagic`.
2. ✔ Repo created, `LICENSE` committed. Variant resolved: **GPL-3.0-or-later**,
   matching `poli0981/switch-every-tab-hotkey`.
3. ✔ Icon set (16/32/48/128 px) — the owner adopted the `scripts/gen-icons.mjs`
   output as final on 2026-07-26, so the generator is the source of truth rather
   than a placeholder. Regenerate with `npm run icons` after any change.
   **Still open:** CWS promo images, which the store listing needs but the
   extension does not.
4. ✔ Donate URLs resolved from `.github/FUNDING.yml` (`14 §5`).
   ✔ Contact email filled in and confirmed live: `contact@poli0981.dev`
   (`legal/PRIVACY.md`), alongside the GitHub Issues link.
5. Chrome Web Store: developer account paid ✔, item created and **submitted
   2026-07-26 — in review**. Listing copy and the Privacy tab answers come from
   `13 §3` and `08 §5`. **Still open:** the promo images, and the store URL for
   the README once the listing is public.
6. Repo secrets + settings per `12 §5`. ✔ CodeQL "Default setup" is already
   disabled (the advanced workflow uploads SARIF cleanly). **Still open, both
   optional:** the `DISCORD_*` webhooks — without them the announce job is
   skipped rather than fatal — and the four `CHROME_*` secrets, which are only
   needed if `CWS_AUTOPUBLISH` is ever set to `true` for v1.1+.
7. **Untested:** `npm run dev:firefox` against the `overrides` block in
   `09 §3.1`. Four of those overrides sit under `web-ext-run` and no gate
   exercises that script. Firefox is a v1.0 non-goal (§7), so this blocks
   nothing — but do not assume it works.
8. **Unmeasured:** the 2 s parse budget on a real browser (`11 §6`). The
   recorded 2869 ms is a jsdom figure and settles nothing.

## 11. Reading order

For humans: this file → `15_ROADMAP.md` → the rest as needed.
For Claude Code: **start at `/CLAUDE.md`** (build phases + doc index).
