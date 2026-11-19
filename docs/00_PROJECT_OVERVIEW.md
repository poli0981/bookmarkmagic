# 00 — Project Overview

> **Project:** BookmarkMagic
> **Type:** MV3 browser extension for Chromium browsers and, since v1.3.0,
> Firefox (open source; Chrome Web Store and, since 2026-11-19, Microsoft Edge
> Add-ons — Firefox Add-ons pending its first review)
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
> **v1.0.1 is PUBLISHED.** Tagged, released and submitted 2026-08-03; the
> listing was observed showing **version 1.0.1** (`Updated: August 3, 2026`,
> 5 users) on 2026-10-28. ⚠️ The exact approval date was never recorded — the
> owner can read it from the dashboard. Installed users are on 1.0.1.
>
> **v1.1.0 is PUBLISHED.** Tagged and released 2026-10-29 (signed tag on
> `9040f84`, checksum-verified zip); the listing showed version 1.1.0 on
> 2026-11-06. It raised the floor to Chrome 136 (`08 §7`); permissions are
> unchanged.
>
> **v1.2.0 is PUBLISHED.** Tagged and released 2026-11-06 (signed tag on
> `e2f36bc`); the listing was observed showing **version 1.2.0** (`Updated:
> November 7, 2026`, 5 languages) on 2026-11-10. It was the store's version
> until 1.3.0 replaced it on 2026-11-19.
>
> **v1.2.1 — accessibility — is RELEASED on GitHub, never on a store on its
> own.** Tagged and released 2026-11-10 (signed tag on `d61318a`,
> checksum-verified zip): an accessibility statement (`/ACCESSIBILITY.md`) and
> the fixes an audit found (`06 §5`). 1.3.0 carries all of it and went to the
> Chrome Web Store in its place (submitted 2026-11-18, live 2026-11-19).
>
> **v1.3.0 — Firefox and Edge — is RELEASED, and LIVE on the Chrome Web
> Store and Edge Add-ons.** Tagged and released 2026-11-18 (signed tag on
> `80c7190`, three checksum-verified packages): a Firefox package (desktop,
> 140 or later), and the Chrome package for Edge Add-ons as well, with 1.2.1
> inside. The owner submitted it to all three stores on 2026-11-18. **Edge
> Add-ons approved it on 2026-11-19** — the first Edge version, live in five
> languages (§9 has the listing). **The Chrome Web Store approved it the same
> day**: the listing shows version 1.3.0 (`Updated: November 19, 2026`, 4
> users), so installed Chrome users move from 1.2.0 to 1.3.0 by themselves.
> ⚠️ The first Firefox Add-ons version is still in review (§10 item 21).
>
> The project is now in **maintenance**, not construction: every change from
> here reaches installed users through a store review, so it needs a version
> bump, a CHANGELOG entry and an update submission (`13 §1b`). Sequencing lives
> in `/CLAUDE.md`; what is still open is in §10 below.
>
> **Since 2026-11-18 that is a written policy: maintenance mode**
> (`/MAINTENANCE.md`). Dependency and security updates, major platform
> upgrades, bug/UI/UX/accessibility/translation fixes, and features only when
> they are on `15`'s roadmap or genuinely needed; requests for anything else
> are closed by `triage.yml` (`12 §2.6`).
> **Doc suite version:** 1.13 (2026-11-18 — Firefox and Edge, v1.3.0)

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
| **Edit**   | Full tree manager: search, rename, move and reorder (drag & drop), sort A→Z, delete, create folders, find duplicates. |

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

**v1.1.0 adds** (the list above stays as v1.0 shipped it — `15` cites it as
v1.0's scope):

- Import: Chrome's profile `Bookmarks` file and Firefox JSON backups, both
  recognised by content, not extension (`04 §2a/§2b`). Backups restore into
  the right roots instead of nesting them (`03 §1`).
- Merge that merges: folders the user already has are reused level by level,
  and new items are appended to them (`03 §1`, `05 §5`).
- Replace asks first, with exact counts, and refuses a backup it could not
  read back (`09` T4); one writer across Manager tabs (`03 §5`).
- Tree editor: Sort A→Z per folder, drag to reorder (before / after / into),
  a real "Move to…" dialog, bounded rendering (`03 §3`, `05 §9–§11`).
- About: the third-party statement names the two MIT pieces the build compiles
  in instead of "None"; Copy diagnostics, a local log for bug reports
  (`09 §7`).
- A redesigned UI with a self-drawn icon set, all motion behind
  `prefers-reduced-motion` (`06`).

**v1.3.0 adds** two stores: **Firefox Add-ons** (its own package from the same
source — the Bookmarks Menu as a fourth root, separators shown and protected,
Firefox's own move-index rule, `02 §4`, `03`) and **Microsoft Edge Add-ons**
(the Chromium package, unchanged). Release automation for all three stores,
each off until its owner switches it on (`12 §3`).

**v1.2.0 adds** two UI languages, chosen from the CWS dashboard's install and
usage figures: **Simplified Chinese (`zh-CN`) and Romanian (`ro`)** — in the
app, in the manifest and in the store listing (`07`). Traditional Chinese is
not shipped; a Traditional Chinese browser on "Automatic" gets English.

## 7. Non-goals (v1.0)

- ❌ Cloud sync, accounts, or any server component.
- ❌ Favicon migration (Chrome's `bookmarks` API cannot write favicons;
  `ICON` attributes are tolerated on parse and dropped — documented limitation).
- ❌ Dead-link checking (requires host permissions — deferred, see Roadmap).
- ❌ Firefox/Safari *store* releases (WXT keeps the door open; see Roadmap).
  *Firefox and Edge became goals on 2026-11-18 (v1.3, `15`); Safari stays
  out.*
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
| Manifest / store / UI name | `BookmarkMagic` (identical in every locale) |
| Repo slug | `poli0981/bookmarkmagic` ✔ |
| Own JSON schema | "BM JSON v1", `"format": "bookmarkmagic"` |
| Code prefix | `Bm*` (`BmParseError`, `BmAborted`) |
| Safety-backup filename | `bookmarkmagic-backup-YYYYMMDD-HHmm.json` |
| Chrome Web Store item id | `eghnciphhegekmnofffpgbdfefckdhmg` (also the value `CHROME_EXTENSION_ID` needs — `12 §3`) |
| Store listing URL | `https://chromewebstore.google.com/detail/bookmarkmagic/eghnciphhegekmnofffpgbdfefckdhmg` |
| Edge Add-ons item id ("CRX ID") | `nchfchjnlihbifggooggpmmacighmdjg` — the `runtime.id` of an install from Edge Add-ons, mapped in `links.ts` (`06 §3.5`) |
| Edge Add-ons Product ID | `3bf2e086-99ee-4f8b-a8db-e13827f04ca1` (the value `EDGE_PRODUCT_ID` needs — `12 §3`) · Store ID `0RDCKC9LZ41P` |
| Edge Add-ons listing URL | `https://microsoftedge.microsoft.com/addons/detail/nchfchjnlihbifggooggpmmacighmdjg` (live 2026-11-19) |

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
   where the originals live. Since 1.1.0 the screenshot harness writes
   1280×800 candidates to `store/screenshots/` (`13 §2`); there is still no
   440×280 promo tile of any size. Owner: record where the submitted assets
   live, or correct `13 §2`.
4. ✔ Donate URLs resolved from `.github/FUNDING.yml` (`14 §5`).
   ✔ Contact addresses: since v1.1.0, one alias per purpose (`privacy@` in
   `legal/PRIVACY.md`, `security@`, `legal@`, `dmca@`, `copyright@`,
   `takedown@`, `code@` — README "Contact"); `contact@` is retired. ⚠️ Owner:
   if the CWS dashboard's developer contact still says `contact@`, change it
   to `privacy@` or `code@` there.
5. ✔ Chrome Web Store: developer account paid, item created, submitted
   2026-07-26 and **approved — the listing is public and has users**. Listing
   copy and the Privacy tab answers came from `13 §3` and `08 §5`. The store URL
   landed in the README on 2026-07-27 (`ea246aa`) and the item id is now in the
   §9 identifiers table. `store/listing.{en,vi,ja}.md` now hold the listing copy
   `13 §4` always asked for — ⚠️ reconstructed from `13 §3` *after* the listing
   went live, so diff them against the dashboard and correct the files.
   **Still open:** the asset reconciliation in item 3.
6. Repo secrets + settings per `12 §5`. ✔ CodeQL "Default setup" is already
   disabled (the advanced workflow uploads SARIF cleanly). **Still open:**
   - `DISCORD_CI_WEBHOOK` is **not** optional in practice. `notify-ci-failure.yml`
     calls a reusable that declares it `required: true`, so with the secret
     unset that workflow fails on *every* CI completion — success or failure.
     Either set it or accept the caller-side tolerance in `12 §2.4`.
   - `DISCORD_RELEASES_WEBHOOK` / `DISCORD_REPO_WEBHOOK` genuinely are optional;
     the announce job is skipped unless the repo variable `DISCORD_ANNOUNCE` is
     `true`. (It used to say `continue-on-error`, which GitHub **rejects** on a
     reusable-workflow caller — see `12 §2.3`.)
   - The four `CHROME_*` secrets are now a **concrete v1.1 prerequisite**, not a
     maybe: `15` lists automated CWS publishing as the first v1.1 item. One of
     the four is already known — `CHROME_EXTENSION_ID` is the item id in §9. The
     other three come from `npx wxt submit init` (`12 §3`). Note there is no
     dry-run: the first time that step executes it makes a real submission.
7. ~~**Untested:** `npm run dev:firefox`.~~ Since v1.3.0 the Firefox package is
   built and checked by CI and the release (`12 §2.1`, `12 §2.3`) and its logic
   is tested against a Firefox-shaped fake (`11 §4`). Still ⚠️: nothing has run
   it in a real Firefox until the owner's `11 §5` pass. Historical text: No gate exercises it (Firefox is a
   non-goal, §7). The `overrides` block that used to threaten it is gone
   (`09 §3.1`), but do not assume it works.
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
11. ✔ **v1.0.1 cleared review** — the listing showed 1.0.1 when checked on
    2026-10-28, and the "published" row is in `15`'s progress table. ⚠️ Still
    open: the exact approval date, and `13 §1b` step 10 against the published
    build (install on a clean profile, re-run the upgrade check) — no result is
    recorded for either.
12. ✔ **v1.1.0 cleared review** — the listing showed 1.1.0 ("Updated October
    29, 2026", 6 users, 3 languages) when checked on 2026-11-06. ⚠️ Still
    open, as for 1.0.1: `13 §1b` step 10 against the published build — no
    result is recorded. Also unverified outside the harness: the
    account-storage roots of a signed-in profile and the hidden empty Mobile
    root (`02 §4`), and the `MAX_WRITE_DEPTH` rationale against a real Chrome.

### v1.2.0 (added 2026-11-06)

13. ⚠️ **ZH-CN and RO native review passes.** Both locales ship best-effort
    (`07 §4`), written from Chrome's own terminology in each language but read
    by no native speaker. Each file's header carries `TODO(review-zh)` /
    `TODO(review-ro)`. The `translation` issue form lists both languages.
14. ✔ **v1.2.0 to the store** — live, observed 2026-11-10 (version 1.2.0,
    `Updated: November 7, 2026`, 5 listing languages). ⚠️ Still unrecorded, as
    for 1.0.1 and 1.1.0: `13 §1b` step 10, the clean-profile install of the
    published build and the upgrade re-check against it.

### v1.2.1 (added 2026-11-10)

15. ⚠️ **v1.2.1 to the store.** The GitHub Release exists and is verified
    (`15`'s progress table). The usual `11 §5` pass plus the **1.2.0 →
    1.2.1 upgrade over an existing profile**, then the Release zip uploaded in
    the dashboard. No listing change: a patch (`13 §5`).
16. ⚠️ **The accessibility checks no script can run** (`11 §5`): a Windows
    contrast theme over the tree, the tabs, the theme control and a running
    import; a screen-reader pass over Alt+↑/↓ (does the new position get
    spoken, once); 200 % zoom. The fixes were verified in a headless Chrome
    with `forced-colors` emulated, which is not the same as a real theme.
17. ⚠️ **Other screen readers.** `ACCESSIBILITY.md` says Narrator with Chrome
    on Windows 11 was tested and NVDA, JAWS, VoiceOver and ChromeVox were not.
    Any pass with one of those moves it from the second list to the first.
18. ⚠️ **Native review of the new strings** — the About link label and the
    spoken position — in JA, ZH-CN and RO, with the passes in items 9 and 13.

### v1.3.0 — maintenance mode, Firefox and Edge (added 2026-11-18)

19. ⚠️ **Pin the maintenance announcement** (Discussions #43) — the API cannot.
20. ✔ **v1.3.0 to the Chrome Web Store** instead of 1.2.1, which never went
    up — submitted 2026-11-18, **live 2026-11-19** (the listing shows version
    1.3.0). The CWS listing text may keep its Chrome wording; it is the
    Chrome store. ⚠️ Still open: the `11 §5` pass with the **1.2.0 → 1.3.0
    upgrade over an existing profile** has no recorded result — installed
    users are taking that upgrade now — and neither has `13 §1b` step 10, the
    published build on a clean profile.
21. ⚠️ **The first Firefox Add-ons version, by hand** (`13 §8`) — **submitted
    2026-11-18, in review**. The `11 §5` Firefox section on a real Firefox
    140+, then the Developer Hub upload of
    the Firefox package **and** the sources archive, desktop only, with
    `BUILD.md` in the notes to reviewers. AMO's upload validator report is the
    first outside check of the package.
22. ✔ **The first Edge Add-ons submission, by hand** (`13 §9`) — submitted
    2026-11-18, **approved and live 2026-11-19** (§9). Partner Center flagged
    the first description for naming another browser; the Edge copy now names
    none (PR #47, `08 §10`). ⚠️ Still open: the `11 §5` Edge items have no
    recorded result — above all a profile **signed in with sync on**
    (`08 §10`, unverified). An Edge user who meets `NO_WRITABLE_ROOTS` would be
    the first sign.
23. ⚠️ **Store automation, when wanted** (`12 §3`): the three environments,
    each with a required reviewer, deployments limited to `v*` tags, and its
    secrets (Chrome: API v2 service
    account; AMO: JWT pair; Edge: API key + Client ID, renewed every 72 days),
    then the `*_AUTOPUBLISH` variables.
    **State on 2026-11-19:** all three `*_AUTOPUBLISH` variables are `true`,
    so **a pushed `v*` tag is now a store submission**.
    - `chrome-web-store` and `edge-add-ons` exist, with their secrets and the
      `v*` tag rule, but ⚠️ with **no required reviewer**. A tag therefore
      uploads to both stores with no approval step.
    - ⚠️ `firefox-add-ons` does not exist and has no secrets. The next tag's
      `store-firefox` job would fail, and GitHub would create the environment
      with no rules. Until the JWT pair is in place, either create the
      environment with its secrets or set `AMO_AUTOPUBLISH` to `false`.
24. ⚠️ **After the listings go live**: their URLs for the README and the
    About link (`06 §3.5` — Edge's needs its listing id), and the AMO/Edge
    badges. **Edge ✔ 2026-11-19**: README install table and badge, and the
    About link's mapping (ships with the next release — CHANGELOG
    `[Unreleased]`). AMO still to come: its About link is already the gecko-id
    URL, so only the README row and a badge remain.
25. ⚠️ **Evidence for the Firefox fake** (`11 §4`): a sanitized `getTree()`
    dump from a real Firefox 140+ profile, committed as a fixture the fake is
    checked against; and a Firefox column in `11 §6`'s parse timing.
26. ⚠️ **Native review** of the strings 1.3.0 added or changed (`07`) in JA,
    ZH-CN and RO, and of the store-listing blocks for AMO and Edge.

## 11. Reading order

For humans: this file → `15_ROADMAP.md` → the rest as needed.
For Claude Code: **start at `/CLAUDE.md`** (build phases + doc index).
