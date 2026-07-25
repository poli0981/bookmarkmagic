# 13 — Release & Store Publishing

Developer account: registered & fee paid ✔.

## 1. First-submission runbook (v1.0.0)

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

## 2. Asset checklist ⚠️ (create before submission)

| Asset | Spec |
|---|---|
| Icon | 128×128 PNG (also 16/32/48 in-package). Flat glyph: bookmark + swap arrows, violet `#6d4aff` on transparent. |
| Screenshots ×5 | 1280×800 PNG, real UI, EN locale, light theme: 1) Import preview+stats 2) Merge options+progress 3) Export format cards 4) Edit tree + duplicate panel 5) Dark theme overview |
| Small promo tile | 440×280 (required) |
| Marquee (optional) | 1400×560 — skip for v1.0 |

## 3. Store listing — EN (canonical)

**Name:** `BookmarkMagic` ✔ (final — `00 §9`)

**Summary (≤132 chars):**
`Import, export & edit bookmarks between browsers — offline, no account, no cloud. Your data never leaves your device.`

**Description:**

```
Move your bookmarks between browsers the simple way: with a file. No account.
No cloud sync. 100% offline.

WHAT IT DOES
• Import bookmark files (HTML, JSON, CSV) with a full preview before anything
  is written — see counts, folders, and duplicates first.
• Choose how to import: into a new dated folder (safe default), merge into
  your existing folders, or replace everything (with an automatic safety
  backup downloaded first).
• Skip duplicates automatically.
• Export everything — or just the folders you pick — to HTML (works with
  Chrome, Edge, Brave, Firefox, Safari, Vivaldi, Opera), JSON, CSV, or
  Markdown.
• Edit your bookmark tree: search, rename, drag & drop, create folders,
  delete, and find duplicate links.

PRIVACY BY DESIGN
• Works entirely on your device. No servers, no analytics, no tracking.
• Only two permissions: "bookmarks" (the whole point) and "storage" (your
  settings). Nothing else.
• Free & open source (GPL-3.0) — read the code on GitHub.

LANGUAGES
English · Tiếng Việt · 日本語

LIMITATIONS (HONESTY CORNER)
• Favicons can't be imported — the extensions API for bookmarks has no
  favicon field.
• Imported bookmarks get today's date — Chrome doesn't let extensions set a
  bookmark's original creation date. Your exported files keep the real dates.
• CSV is a flattened view: empty folders and "which folder is the toolbar"
  aren't preserved. Use HTML or JSON for a faithful backup.

Source code, issue tracker & privacy policy:
https://github.com/poli0981/bookmarkmagic
```

**Category:** Productivity → Tools · **Language:** English + VI/JA localized.

## 4. Localized listing snippets

**VI summary:** `Nhập, xuất & chỉnh sửa bookmark giữa các trình duyệt — offline, không tài khoản, không cloud. Dữ liệu không rời khỏi máy bạn.`
**JA summary:** `ブラウザ間でブックマークをインポート・エクスポート・編集。オフライン、アカウント不要、クラウド不要。データは端末から出ません。`
(Full VI/JA descriptions: translate §3 keeping structure; store in
`store/listing.{vi,ja}.md` in-repo so listing text is version-controlled ⚠️.)

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
  link issues to GitHub).
- GitHub issues — templates route bug reports with sample files.
- Discord servers (`#support` in the OSS server) — pin an FAQ post.
- Review flow for feature requests: label → roadmap doc PR → milestone.
