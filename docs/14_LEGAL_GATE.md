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
Filenames follow the portfolio precedent: `legal/PRIVACY.md`,
`legal/DISCLAIMER.md`, `legal/EULA.md`, `legal/THIRD_PARTY_NOTICES.md` (the
notices file lives in `legal/`, not the repo root).

**The committed files are the canonical text — read them, not a copy here.**
This section used to embed drafts carrying `Last updated: 2026-⚠️` and
`⚠️ contact email` placeholders. Those were filled in Phase 0 and Phase 4, and
real users have now accepted the published wording in-product; a spec still
showing the unfilled draft was describing a document nobody has ever agreed to.

### 3.1 Changing a legal document after launch

The gate reappears for **every installed user** when `LEGAL_VERSION`
(`src/lib/core/limits.ts`) increases. That is the mechanism working correctly,
and it is also the most disruptive thing this project can do to its users
without shipping a bug. So the bump is a decision, never a side effect:

| Change | Bump? |
|---|---|
| A new obligation, permission, or data flow — anything a user could reasonably object to | **Yes.** Bump, and say so in the CHANGELOG, so the reappearing gate is explicable rather than alarming. |
| Wording that narrows or clarifies something already true | No. Record the reasoning in the `15` decision log so the judgement stays auditable. |
| Typos, formatting, dead links | No. |

Procedure for a bump: edit `legal/*.md` → bump `LEGAL_VERSION` → update the CWS
Privacy tab if the privacy text changed at all (`08 §5`, `09 §4`; a privacy-tab
change is a **minor**-version event per `12 §4`) → add a `15` decision-log row →
confirm with the `11 §5` upgrade item that the gate does reappear and that
settings and bookmarks survive it.

**Precedent (2026-08-03):** `legal/PRIVACY.md` gained an "If you contact us"
paragraph — do not send your real bookmarks file, sanitize it first, GitHub
attachments are public, emailed material is deleted once the issue is fixed.
Deliberately **not** a bump: it describes what happens to data a user chooses to
send us, which was never inside "what the Extension collects", and re-gating
every installed user over a clarification is the worse of the two outcomes.

### 3.2 `LICENSE`

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
