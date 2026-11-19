# 13 — Release & Store Publishing

Chrome Web Store developer account: registered & fee paid ✔. Since v1.3.0
there are two more stores — Firefox Add-ons (§8) and Microsoft Edge Add-ons
(§9) — and §1b is still the procedure for every release; §8 and §9 add what
is different there.

## 1. First-submission runbook (v1.0.0) — ✔ completed 2026-07-26

**Historical.** Kept because it is the record of how the listing was created and
what was answered where. For every release after v1.0.0 use §1b instead — the
steps below are all first-listing shaped ("New item", filling the listing and
privacy tabs, setting distribution) and none of them is what a second submission
does.

1. `npm run verify` + full manual QA pass (`11 §5`) on a fresh profile.
2. Tag `v1.0.0` → CI produces the zip artifact (or `npm run zip` locally from
   a clean `npm ci`).
3. Dashboard → New item → upload zip.
4. **Store listing tab** — paste content from §3 (EN), add VI/JA localized
   fields (§4). Upload assets (§2).
5. **Privacy tab** — answers exactly per `08_MV3_COMPLIANCE.md §5`
   (single purpose text, permission justifications, "no data collected"
   certifications, privacy-policy URL).
6. **Distribution** — Public, all regions.
7. Submit. Typical review: hours–days for a `bookmarks`+`storage`-only item.
   If rejected: read the exact policy citation, fix, respond via the
   dashboard — never argue past the cited policy.
8. After approval: verify listing links (GitHub, privacy) resolve; install
   from the store on a clean profile; tag the announcement (Discord servers,
   community channels — posted automatically by the `announce` job in
   `release.yml`, which calls the ops repo's `announce-release.yml`
   (script: `.github/scripts/discord_notify.py`), see `12 §2.3`).
   ⚠️ **Never recorded as performed.** The approval landed and no result was
   written down, so the one check that the *published* artifact matches what was
   tested has not demonstrably happened. It is now a standing item in `11 §5`
   rather than a one-off step here.

## 1b. Update-submission runbook (v1.0.1 and every release after)

This is the procedure for shipping to an **existing** listing. The listing,
privacy and distribution tabs are already filled; you are replacing the package.

1. `npm run verify:full` + the full manual QA pass (`11 §5`) on a fresh profile,
   **including the upgrade test over an existing profile** — that is the item
   that has no equivalent in a first submission and the one whose failure hits
   every installed user simultaneously.
2. Bump the version. Exactly **two** files change:
   - `package.json` `version` (semver per `12 §4`);
   - `CHANGELOG.md` — a new dated section **and** the link references at the
     bottom of the file (`[Unreleased]` must compare against the new tag, and a
     new `[X.Y.Z]` line must be added). Forgetting the link refs is the easy
     half to miss.

   A third when the interface changed, or a new check was run:
   - `ACCESSIBILITY.md` — its "Last reviewed" line (date and version) and its
     "What has been tested" table, once `11 §5`'s last item has been done.

   `wxt.config.ts` declares no `version` key — WXT derives it from
   `package.json` (`08 §5`). If it appears in your diff, something is wrong.
3. PR → CI green → merge to `main`. **The bump must be on `main` before the
   tag**: `release.yml` reads the built `manifest.json` at the tagged commit and
   fails the run when it does not equal the tag minus `v`.
4. ⚠️ Human: `git tag -s vX.Y.Z && git push origin vX.Y.Z`. Signed, per `09 §5`.
   `release.yml` re-runs every gate, builds, zips, verifies tag↔manifest, writes
   `SHA256SUMS.txt`, and creates the GitHub Release.
5. Download the **Release asset**, not the CI artifact — `SHA256SUMS.txt` covers
   the Release assets only (`12 §3`). Verify with `sha256sum -c --ignore-missing
   SHA256SUMS.txt` (since v1.3.0 it lists three files; `--ignore-missing` lets
   you check only the one you downloaded).
6. Dashboard → the existing item → **Package → Upload new package** → the zip.
   Do *not* create a new item.
7. Fill the "why this update" / what-changed note. Listing text and the privacy
   answers stay as they are unless something actually changed — and if the
   permission list or the data-handling answers did change, that is a
   minor-version event which requires re-certifying the Privacy tab first
   (`09 §4`, `08 §5`).
8. Consider a staged (percentage) rollout for anything touching the write paths.
   There is no undo once a version is live, only a higher version (§7).
9. Submit. Review for a `bookmarks`+`storage`-only item is typically hours–days.
10. After it goes live: confirm the dashboard shows the new version, then
    install/update on a clean profile and re-run the upgrade check from step 1
    against the *published* build. Record the result in `15`'s progress table.

Chrome auto-updates installed extensions once the new version passes review;
users do nothing and, notably, get no prompt. That is why the upgrade test
matters more than any other single check here.

## 1c. Which file goes where (since v1.3.0)

| Store | Upload | Notes |
|---|---|---|
| Chrome Web Store | `bookmarkmagic-X.Y.Z-chrome.zip` | §1b |
| Microsoft Edge Add-ons | the **same** `…-chrome.zip` | §9 |
| Firefox Add-ons | `bookmarkmagic-X.Y.Z-firefox.zip` **and** `…-sources.zip` | §8 |

A store that re-signs or repackages what it receives (all three do, in some
form) serves users a file whose hash is not the Release asset's. What
`SHA256SUMS.txt` vouches for is that the uploaded file is the Release asset
(`09 §5`).

## 2. Asset checklist ⚠️

### Store assets (submitted — source of truth is the CWS dashboard)

| Asset | Spec |
|---|---|
| Icon | 128×128 PNG (also 16/32/48 in-package). Flat glyph: bookmark + swap arrows, violet `#6d4aff` on transparent. Generated by `scripts/gen-icons.mjs`, which is the source of truth (`00 §10.3`). |
| Screenshots | 1280×800 PNG, real UI, EN locale. Since v1.1.0 generated, not hand-made: `npm run build && node scripts/screenshots.mjs --shoot` writes the store set — `#import`, `#edit`, `#export` — to `store/screenshots/`. |
| Small promo tile | 440×280 (required by the dashboard) |
| Marquee (optional) | 1400×560 — skipped |

**Screenshots come from the harness** (`scripts/screenshots.mjs`, `11 §5`). It
photographs the built extension over a fake `chrome` with neutral sample
bookmarks, so no real profile can appear in a store image, and one command
reproduces the set after any UI change (`08 §8`). Each route is captured as it
first renders — the import shot is the drop zone (no file is loaded), the edit
shot the tree with the duplicate panel closed. That is narrower than the five
subjects first planned (import preview + stats, Merge options + progress,
export format cards, edit tree + duplicate panel, dark overview); a preview, a
running import or an open panel still needs a hand-staged capture.

⚠️ Human, with the v1.1.0 submission: the redesign changed every surface, so
images of the 1.0 UI no longer show the product (`08 §6`). Upload the
regenerated set in the dashboard alongside the package (§1b step 6).

⚠️ **The submitted v1.0 assets are unreconciled.** The listing is live, so the
dashboard has whatever was actually uploaded — but the repo does not, and
nothing records where those originals live. The screenshots are now
reproducible; the 440×280 promo tile still is not — nothing generates it.
Owner: record where the submitted assets live, or correct this table to match
what the dashboard really required.

### README screenshots (not store assets — do not confuse them)

`capture/` holds the README set — `import`, `export`, `edit`, `settings`,
`about` (light, English, 1280×800) and `popup` (360×420) — regenerated for
1.1.0 by `node scripts/screenshots.mjs --shoot` from neutral sample data. The
1.0.0 shots (2512×1440, a real profile) are gone. `store/screenshots/` holds
the dark 1280×800 store candidates (`edit`, `export`, `import`); which of them
to upload, alongside or instead of what the listing has now, is the owner's
call (⚠️ `13 §1b`).

## 3. Store listing — EN (canonical)

**The listing copy lives in `store/listing.*.md`** — one file per locale
(`en`, `vi`, `ja`, `zh_CN`, `ro`, named by Chrome's locale code) — name, summary,
description, category and the privacy-policy URL, exactly as pasted into the
dashboard. This section used to carry a second copy of the English text, and
for v1.1.0 the two had already diverged (the store files gained the Chrome and
Firefox imports, Merge reuse, the Replace confirmation and Sort A→Z; the copy
here still described v1.0). A copy in two places is a copy that drifts.

When the description changes: edit every `store/listing.*.md` in the same
pull request as the feature, keep claims to what the CHANGELOG says shipped,
and paste them into the dashboard as part of `§1b`. The summary must stay ≤132
characters in every language.

## 4. Localized listing snippets

**VI summary:** `Nhập, xuất & chỉnh sửa bookmark giữa các trình duyệt — offline, không tài khoản, không cloud. Dữ liệu không rời khỏi máy bạn.`
**JA summary:** `ブラウザ間でブックマークをインポート・エクスポート・編集。オフライン、アカウント不要、クラウド不要。データは端末から出ません。`
**ZH-CN summary:** `在浏览器之间导入、导出和编辑书签——离线运行，无需账户，无需云端。您的数据绝不会离开您的设备。`
**RO summary:** `Import, export și editare de marcaje între browsere — offline, fără cont, fără cloud. Datele nu vă părăsesc dispozitivul.`
Full descriptions: translate `store/listing.en.md` keeping its structure. The
canonical copy lives in `store/listing.*.md` so listing text is
version-controlled and reviewable — a listing edit made straight into the
dashboard has no diff and no history.

**Adding a listing language** (v1.2.0 did two): in the dashboard, Store listing
→ the language selector → add the language, then paste name, summary and
description from its file. The "Languages" line in the public listing is not
typed by anyone — CWS derives it from the package's `_locales/`, so it changes
only when the new package is live. The `LANGUAGES` paragraph inside every
description *is* typed, so a new locale means re-pasting the description of
every existing language too.

⚠️ Those files were written from §3 **after** the listing went live, so they are
a reconstruction, not a transcript. Owner: diff them against what the dashboard
actually shows and correct the files, not the dashboard.

## 5. Update cadence & versioning

- Ship small: patch releases as fixes land; listing description only changes
  on minor+.
- Every store build corresponds to a signed git tag + GitHub Release with the
  identical zip + SHA256 (`09 §5`).
- **User side:** Chrome auto-updates extensions after a new version passes
  review — users never act. Mention notable changes in the "What's new"-style
  top section of the description when meaningful.
- **Dev side:** manual for v1.0.x → automated `wxt submit` from v1.1
  (`12 §3`), gated by `CWS_AUTOPUBLISH`.

## 6. Post-launch monitoring (no telemetry ⇒ these channels only)

- CWS dashboard: user counts, ratings, review replies (reply within a week;
  link issues to GitHub). A store review is not a bug report — if it describes a
  reproducible defect, open the GitHub issue yourself and reply with the link.
- GitHub issues — `.github/ISSUE_TEMPLATE/` routes them. `parser_report.yml`
  requires a sanitized sample (`scripts/sanitize-bookmarks.mjs`) plus explicit
  consent to commit it as a GPL-3.0 fixture, because that is what turns a report
  into a regression test (`11 §2`, `15 §v1.0.x`).
- Accessibility reports — their own form (`accessibility.yml`, label
  `accessibility`) and `accessibility@poli0981.dev` for people without a
  GitHub account. `ACCESSIBILITY.md` promises an acknowledgement within about
  a week and a patch for a blocking barrier (`15`, release trigger); a report
  that is not fixed at once goes into its Known limitations.
- Discord servers (`#support` in the OSS server) — pin an FAQ post.
  ⚠️ The invite URL is not recorded anywhere in the repo.
- Feature requests, in maintenance mode (`/MAINTENANCE.md`): `triage.yml`
  closes a request for something new and labels the two in-policy answers
  `needs-triage` (`12 §2.6`). Read every `needs-triage` issue and every closed
  one; one that fits goes into `15` by pull request and gets the `roadmap`
  label, which the automation leaves alone. Ideas live in Discussions › Ideas.

The three recurring questions are already answered in prose and make the FAQ
seed: favicons cannot be imported; imported bookmarks carry today's date (the
import report now says so itself); CSV is a flattened view. See §3's honesty
corner and README's "Honest limitations".

## 7. When something goes wrong after launch

None of this existed before v1.0.0 was live, and all of it is now reachable.

### An update is rejected

**The published version stays live.** An update rejection is not a takedown —
users keep running the previous version, so nothing is on fire and there is time
to read carefully.

1. Read the exact policy citation. Never argue past it (same rule as §1 step 7).
2. Fix, and bump the patch **again**. The store refuses a version string it has
   already seen, so a rejected 1.0.1 comes back as 1.0.2 — not as a re-upload.
3. Never delete or move the tag of a rejected version. It is a real, published
   GitHub Release and moving it invalidates its checksum. Leave it and move on.
   The one exception is a tag whose run failed **before** any Release existed —
   nothing was published, so fix the workflow on `main` and re-point the tag,
   as `v1.1.0` was (`15` decision log, 2026-10-29).
4. Note the rejection and its resolution in `15`'s decision log — it is the only
   memory the project has of what the reviewers actually object to.

### Rollback

There is no "revert to the previous version" in the Chrome Web Store. The only
rollback is **forward**: ship a higher version containing the revert. Plan
accordingly — a bad release cannot be recalled, only superseded, and the
superseding version has to pass review too.

### Takedown / unpublish / appeal

- **Unpublished** (by you or by Google): the listing disappears from search and
  no one can install it. **Existing users keep the version they have** and it
  keeps working; it simply stops receiving updates. GitHub Releases become the
  only distribution channel, and the README install section should say so.
- Appeal through the developer support form, citing the specific policy. Attach
  the permission justifications from `08 §5` — a `bookmarks`+`storage`-only,
  zero-network extension has an unusually short defence to make, and `09`'s
  threat model exists partly to make it.
- If a takedown is about data handling, `legal/PRIVACY.md` and the privacy-tab
  answers must agree with the code exactly. `npm run guard` and
  `npm run check:manifest` are the evidence that they do.

### A store job failed after the Release was published (since v1.3.0)

Re-run **only the failed job** from the run page. Every store refuses a
version number it has already accepted, so re-running the whole workflow would
turn the stores that succeeded red; and nothing before the store jobs needs
redoing — the Release and its checksums are already published. The usual
causes: an expired Edge API key (72 days, `12 §3`), a review hold, a token
revoked in a store dashboard.

### A tag was pushed and the release run failed

`release.yml` runs `gh release create` with no existence check, so a failure
*after* that step (realistically the CWS publish step, once `CWS_AUTOPUBLISH` is
on) leaves a published Release that a re-run cannot recreate.

- If the Release and its two assets published correctly, the failure is
  downstream — fix it and do the affected step by hand. Do **not** re-run the
  workflow.
- If the Release is broken or incomplete: `gh release delete vX.Y.Z`, then
  `git push --delete origin vX.Y.Z`, then re-tag. Only safe while nothing has
  consumed the assets.
- Never move a tag that has already been announced or submitted.

## 8. Firefox Add-ons (AMO) — runbook (since v1.3.0)

**First version — by hand, once** (the API and `publish-browser-extension`
can only add versions to an add-on that exists):

1. The `11 §5` pass on a **real Firefox** (140 or later): about:debugging →
   This Firefox → Load Temporary Add-on → `.output/firefox-mv3/manifest.json`
   (or the Release's `…-firefox.zip`). Its Firefox section covers the
   Bookmarks Menu, separators and Alt+↑/↓.
2. addons.mozilla.org/developers → **Submit a New Add-on** → *On this site*
   (listed) → upload `bookmarkmagic-X.Y.Z-firefox.zip` from the Release.
3. **Compatibility: Firefox only** — untick Firefox for Android (no
   `bookmarks` API there, `08 §9`).
4. **Source code: yes** → upload `bookmarkmagic-X.Y.Z-sources.zip` from the same
   Release. In *Notes to reviewer* paste the short version of `/BUILD.md`:
   Node.js 26 and npm 11 (the sources archive drops `.nvmrc`), `npm ci`,
   `npm run zip:firefox`, the package lands in `.output/`. Reviewers diff their
   build against the upload, file by file.
   Checked 2026-11-18: the sources archive, unpacked into an empty folder,
   `npm ci --ignore-scripts`, `wxt prepare`, `npm run build:firefox`, rebuilt
   every one of the package's 19 files byte for byte.
5. Listing: from `store/listing.<lang>.md`'s **AMO** block — name, summary
   (≤ 250 characters), description, category *Bookmarks*, licence *GNU General
   Public License v3.0* (the code is GPL-3.0-or-later), privacy policy
   `https://github.com/poli0981/bookmarkmagic/blob/main/legal/PRIVACY.md`,
   homepage the repository, support site the repository's issues. No support
   email (`09 §6`).
6. Submit, and record the review's outcome in `15`. The add-on's page is
   `https://addons.mozilla.org/firefox/addon/bookmarkmagic@poli0981.dev/`
   (AMO resolves the gecko id; the slug it picks works too).

**Later versions:** by hand, the same way (*Upload New Version*), or
automatically from `release.yml`'s `store-firefox` job once
`firefox-add-ons` has its secrets and `AMO_AUTOPUBLISH` is `true`
(`12 §3`) — the job uploads the package and the sources together.

**Rollback:** AMO can disable a version in the Developer Hub, which sends
users back to the previous approved one — a recall Chrome does not offer.
Still ship the fix forward.

## 9. Microsoft Edge Add-ons — runbook (since v1.3.0)

**First submission — by hand, once:**

1. A Partner Center developer account (no fee) — ⚠️ owner.
2. The `11 §5` pass on a real **Edge**, including a profile **signed in with
   sync on** — the case `08 §10` could not verify (`NO_WRITABLE_ROOTS` if
   Edge marks syncing roots).
3. Partner Center → Edge → **Create new extension** → upload the Release's
   `bookmarkmagic-X.Y.Z-chrome.zip` — the Chrome package, unchanged.
4. Listing from `store/listing.<lang>.md`'s **Microsoft Edge Add-ons**
   section: a complete description of its own, pasted whole, that names no
   browser but Edge (Edge's policy 1.1.2 — Partner Center warns on any other
   browser's name, `08 §10`); category *Productivity*; privacy answers as
   `08 §5`; privacy policy URL as above; screenshots from `store/screenshots/`.
5. Submit; record the outcome in `15`. Note the **Product ID** on the
   extension's overview page — `EDGE_PRODUCT_ID` — and the listing URL, which
   the About link and the README can then use (`06 §3.5`). The About link
   matches the **CRX ID** (the `runtime.id` an install reports), not the
   Product ID.
   Done for 1.3.0: submitted 2026-11-18, live 2026-11-19 — ids and listing
   in `00 §9`.

**Later versions:** by hand (*Update* → upload the new package), or from
`release.yml`'s `store-edge` job once `edge-add-ons` has its secrets and
`EDGE_AUTOPUBLISH` is `true`. The API key expires every **72 days**; put the
renewal in a calendar.
