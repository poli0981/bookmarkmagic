# 14 — Legal Gate & Legal Files

## 1. Reality check

Chrome Web Store has **no pre-install acceptance mechanism** — nothing can be
shown "before installation". The portfolio-standard solution (CommandForge
pattern) is a **first-run gate**: the Manager blocks functional tabs until
the user accepts, once, with links to canonical documents on GitHub.

## 2. Gate behavior spec

- **Trigger:** Manager mount reads `chrome.storage.local` key
  `legal.acceptedVersion` (number). If `undefined` or `< LEGAL_VERSION`
  (constant in `src/lib/core/limits.ts`, starts at `1`) → render
  `<LegalGate>` overlay.
- **Blocks:** `#import`, `#export`, `#edit`. **`#settings` and `#about` stay
  reachable** — `#about` so users can read the linked documents before
  accepting, `#settings` so a VI/JA user can switch language and theme first
  (which is why `<LegalGate>` needs no language switcher of its own). Popup is
  never blocked (it only launches the Manager). Same list in `03 §4` and the
  `11 §5` QA checklist.
- **Content:** app icon + name · one-paragraph plain-language summary ·
  four link rows (EULA · License GPL-3.0 · Disclaimer · Privacy Policy — each
  opens the GitHub `legal/` file in a new tab) · localized note
  *"The legally binding documents are in English."* · checkbox
  `I have read and accept the terms above` · buttons `Accept & continue`
  (enabled by checkbox) / `Close tab`.
- **Accept:** write `{ legal: { acceptedVersion: LEGAL_VERSION, acceptedAt:
  ISO } }` → overlay unmounts. About tab displays the stored date/version.
- **Re-consent:** bump `LEGAL_VERSION` only for material changes to the
  documents; gate reappears with a "terms updated" banner.
- **Decline path:** no nagging — closing the tab is the decline. Nothing is
  written.

Storage keys are namespaced `legal.*` / `settings.*` (single
`chrome.storage.local` object, typed accessor in `browser/storage.ts`).

## 3. Repo `legal/` files (English canonical)

Linked from the gate, About tab, README, and the CWS privacy-policy URL.
Drafts below are ready to commit ⚠️ — fill placeholders, have a final human
read-through (docs are provided as-is, not legal advice).

Filenames follow the portfolio precedent: `legal/PRIVACY.md`,
`legal/DISCLAIMER.md`, `legal/EULA.md`, `legal/THIRD_PARTY_NOTICES.md` (the
notices file lives in `legal/`, not the repo root).

### 3.1 `legal/PRIVACY.md` (draft)

```markdown
# Privacy Policy — BookmarkMagic
Last updated: 2026-⚠️

BookmarkMagic ("the Extension") is designed to work entirely on your
device.

## What we collect
Nothing. The Extension has no servers, performs no network requests, and
contains no analytics, telemetry, or crash reporting.

## What the Extension accesses, and why
- Bookmarks (permission: "bookmarks"): read to display/export your bookmark
  tree; written when you import or edit. This data never leaves your device.
- Local settings (permission: "storage"): your language, theme, preferences,
  and the date you accepted these terms are stored locally via
  chrome.storage.local. They are not transmitted anywhere and are removed by
  Chrome when you uninstall the Extension.

## Files you import or export
Files are read and generated locally in your browser. They are never
uploaded. Exported files are saved through your browser's normal download
mechanism to a location you control.

## Third parties
No data is shared with anyone, because no data is collected.

## Changes
Material changes will be published here and re-acceptance will be requested
inside the Extension.

## Contact
⚠️ contact email / GitHub issues link
```

### 3.2 `legal/DISCLAIMER.md` (draft)


```markdown
# Disclaimer — BookmarkMagic

- Provided "AS IS", without warranty of any kind (see LICENSE §15–16).
- Bookmark operations modify your browser's bookmark data. The "Replace
  everything" mode DELETES all existing bookmarks after downloading an
  automatic safety backup. You are responsible for keeping backups of data
  you care about.
- Import files come from outside this Extension; verify you trust their
  source. Bookmarked URLs are stored as-is and are not vetted by the
  Extension.
- This project is not affiliated with or endorsed by Google, Chrome, or any
  browser vendor. Browser names are trademarks of their respective owners.
```

### 3.3 `legal/EULA.md` (draft)

```markdown
# End User License Agreement — BookmarkMagic

1. License. The software is free software licensed under the GNU General
   Public License v3.0 (see LICENSE). You may use, study, share, and modify
   it under those terms. This EULA adds no restrictions beyond the GPL; if
   anything here conflicts with the GPL, the GPL prevails.
2. No warranty; limitation of liability. As stated in GPL-3.0 §15 and §16,
   the software is provided without warranty, and authors are not liable for
   damages, including loss of bookmark data.
3. Acceptable use. You agree not to use the software to violate applicable
   law or third-party rights.
4. Your data. The software processes bookmark data locally on your device
   only (see PRIVACY.md).
5. Updates. Updates are delivered via the Chrome Web Store and may change
   functionality. Material legal changes trigger re-acceptance in-app.
```

### 3.4 `LICENSE`

Full GPL-3.0 text at **repo root** (already committed). Variant resolved:
**`GPL-3.0-or-later`**, matching `poli0981/switch-every-tab-hotkey`. Set the
same value in `package.json#license` (`01 §5`).

## 4. In-product legal surfacing map

| Surface | Shows |
|---|---|
| First-run gate | Summary + 4 links + accept |
| About tab | 4 links + accepted date/version + "Third-party dependencies: None" |
| Store listing | GitHub link; privacy-policy URL in Privacy tab |
| README | License badge, links to `legal/` |

## 5. Third-party & donations note

- v1 ships **zero runtime dependencies** → About states "None". If `fflate`
  lands in v1.1, About must render its name + MIT license text (add
  `THIRD_PARTY_NOTICES.md` generated at build time — keep the rule ready).
- Donate links live in About + README only — outbound links are fine on CWS;
  no payment functionality inside the extension. Handles are resolved (from the
  portfolio's `.github/FUNDING.yml`, which this repo copies verbatim):
  GitHub Sponsors `poli0981` · Ko-fi `skullmute` · Buy Me a Coffee `skullmute`
  · Patreon `skullmute` · `paypal.me/DungDang212`.
