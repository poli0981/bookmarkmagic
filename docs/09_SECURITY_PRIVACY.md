# 09 — Security & Privacy

## 1. Privacy guarantees (product-level, non-negotiable)

1. **Zero data collection.** No analytics, no telemetry, no crash reporting,
   no update pings. There is no server.
2. **Zero network activity at runtime.** Enforced by the canonical grep gate
   defined in `08_MV3 §3` — that block is the single source of truth for the
   pattern; do not restate it here.
3. **Everything on-device.** Bookmarks are read/written via `chrome.bookmarks`
   locally; files are parsed in-page and downloaded via Blob URLs. `chrome.
   storage.local` holds only settings + legal flag (no `storage.sync` — even
   settings stay off the vendor cloud, consistent with the product promise).
4. Open source (GPL-3.0) — the privacy claims are verifiable.

## 2. Threat model

| # | Threat | Vector | Mitigation |
|---|---|---|---|
| T1 | **Malicious import file — markup injection** | Crafted `<script>`/`onerror` payloads in a .html bookmark file | `DOMParser('text/html')` produces an **inert** document (scripts never execute). We read `textContent`/`getAttribute` only. Rendering uses Svelte text interpolation — **`{@html}` is banned repo-wide**. |
| T2 | Malicious file — resource exhaustion (huge/deep/zip-bomb-style) | 500 MB file, 1M nodes, 10k-deep nesting | Pre-parse size cap 25 MB; node cap 100 000; depth cap 200 — typed errors, parse aborts early. Lazy tree rendering (§05 §9) bounds DOM size. |
| T3 | Dangerous URLs in imported bookmarks (`javascript:`, `data:`) | Clicking them in #edit | Never rendered as `<a href>`; "Open" uses `tabs.create`, which refuses `javascript:`. UI marks non-http(s)/ftp/file/about/chrome schemes with a ⚠ badge; they are display-only. Imported URLs are stored verbatim (user's data, not ours to censor) — the browser's own bookmark UI applies its own rules. |
| T4 | Data loss from destructive import | User picks "Replace all" casually | Non-skippable auto safety-backup (BM JSON download) *before* deletion; danger-styled confirm with exact counts; default mode is non-destructive new-folder. |
| T5 | Supply-chain compromise | Malicious transitive dep | **Zero runtime deps**; dev deps pinned via lockfile; Dependabot + `npm audit` in CI; Biome installed exact-pinned. See §5.1 for the `overrides` block. |
| T6 | Store-listing impersonation / trademark issues | — | Unique name + linked GitHub; report via CWS if cloned. |
| T7 | XSS via filenames/titles echoed into UI (result cards, toasts) | Weird characters in file name | Same as T1 — text interpolation only; filenames additionally sanitized for the *download* name (`[\\/:*?"<>|]` → `_`). |
| T8 | Clipboard abuse | "Copy URL" action | Uses `navigator.clipboard.writeText` on explicit user click only; never reads the clipboard. |

### Pass performed 2026-07-26 (Phase 5)

| # | Now enforced by |
|---|---|
| T1 | `tests/unit/core/fixtures.test.ts` parses `malformed/script-injection.html` and asserts the payloads survive as inert text. `DOMParser('text/html')` never executes scripts, and `{@html}` is barred by `npm run guard`. |
| T2 | `tests/unit/core/limits.test.ts` plus the caps in `core/limits.ts`. Measured: a 100k-node file parses without exhausting anything (`11 §6`). |
| T3 | `malformed/js-url.html` at parse level, `tests/unit/browser/open-url.test.ts` at the point of use — `javascript:`, `data:`, `file:`, `chrome:`, `vbscript:` and case-shouted variants are refused before `tabs.create` — and the ⚠ badge this row has always specified, which `isBlockedUrl` now drives in `TreeRow`. A refused open also raises a toast; it used to do nothing at all, which read as a broken button rather than a deliberate refusal. |
| T4 | `tests/unit/import/safety-backup.test.ts`. |
| T5 | `npm audit --omit=dev` reports **0** — every open Dependabot alert is `development` scope. |
| T6 | Human; nothing in code. |
| T7 | `sanitizeFilename` (`tests/unit/browser/download.test.ts`); everything else reaches the DOM through Svelte text interpolation. |
| T8 | `browser/clipboard.ts` — write-only, click-only, never reads. Implemented in Phase 5; it had been specified in `06 §3.3` and here since the start but never built. |

Three gaps this pass closed, all of which had gone unnoticed because nothing
mechanical was watching:

- **The permission list had no gate at all.** Two now exist, and both are
  needed. `tests/unit/manifest.test.ts` asserts `['bookmarks', 'storage']`
  against `wxt.config.ts` — what we *ask* for. `scripts/check-manifest.mjs`
  asserts the **built** artifact, which is not the same thing: a dev build of
  this identical config emits
  `"permissions": ["bookmarks","storage","tabs","scripting"]` and
  `"host_permissions": ["http://localhost/*"]`, because WXT injects them.
  Production is clean today, but that is WXT's behaviour, not our enforcement.
  Both were verified to fail — one by adding `'tabs'` to the config, the other
  by editing the built manifest.
- **"Copy URL" did not exist**, so T8 described the mitigation for a feature
  that was never shipped.
- **T3's ⚠ badge did not exist either.** The blocking half was real and tested;
  the "mark dangerous schemes in the UI" half was not, so a `javascript:`
  bookmark titled "Your bank" rendered exactly like a safe one and its Open
  button silently did nothing.

## 3. Secure coding rules (enforced)

- `{@html}` — **forbidden**. Enforced by the canonical grep gate (`08 §3`) and
  review. Biome has no rule for this: `noDangerouslySetInnerHtml` is a React
  rule and does not see Svelte templates.
- `innerHTML`, `outerHTML`, `insertAdjacentHTML` assignment — forbidden (same
  gate).
- All user/file-derived strings cross into the DOM only via Svelte text
  bindings or `textContent`.
- `URL` constructor for any URL handling; no string-splitting of URLs.
- No `Math.random` for anything security-relevant (ids use
  `crypto.randomUUID()` where local ids are needed).
- Typed wrappers only for `chrome.*` (single audited surface,
  `src/lib/browser/`).
- Error messages shown to users never include raw file content beyond a
  ≤120-char excerpt of the offending line (avoids log-injection weirdness in
  screenshots/issues).

### 3.1 The `package.json` `overrides` block

Six Dependabot alerts and six `npm audit` highs were all transitive **dev**
dependencies that their parents pinned to vulnerable ranges, so Dependabot's own
per-package PRs could not fix them — every one failed. `overrides` is the npm
mechanism for exactly this, and it takes `npm audit` to **0**.

| Override | Was | Reached through | Remove when |
|---|---|---|---|
| `shell-quote ^1.9.0` | 1.7.3 | `wxt > web-ext-run > fx-runner` | `web-ext-run` updates `fx-runner` |
| `adm-zip ^0.6.0` | 0.5.18 | `wxt > web-ext-run > firefox-profile` | `web-ext-run` updates `firefox-profile` |
| `tmp ^0.2.6` | 0.2.5 | `wxt > web-ext-run` | `web-ext-run` bumps `tmp` |
| `uuid ^11.1.1` | 8.3.2 | `wxt > web-ext-run > node-notifier` | `web-ext-run` updates `node-notifier` |
| `esbuild ^0.28.1` | 0.27.7 | `vite`, `wxt`, `unplugin` | vite/wxt allow 0.28.x |
| `brace-expansion ^5.0.8` | 1.1.16 | `web-ext-run > multimatch > minimatch` | `multimatch` unpins `minimatch` |

Four of the six exist only under **`web-ext-run`**, the Firefox dev runner
behind `npm run dev:firefox` — which `00 §7` lists as a v1.0 non-goal, and which
neither CI nor the Chrome build touches. ⚠️ **`npm run dev:firefox` is therefore
the one script these overrides could plausibly break**, and it is the one script
no gate exercises. Verify it by hand before relying on it.

Everything CI runs was re-verified after the overrides landed: lint, check,
knip, coverage, guard, build, `check:manifest` and `zip`, plus a clean-room
`npm ci`. Drop an override as soon as its parent ships the fix — a stale
override silently holds a package back.

## 4. Permissions posture

`bookmarks` + `storage`, nothing else (justifications in `08 §2`). Any PR
adding a permission must update docs 08/09/13 + the store Privacy tab, and is
a **minor-version** event at minimum.

## 5. Release integrity

- Builds are **content**-reproducible from a clean checkout: `npm ci && npm run
  zip`. Verified 2026-07-26 by building the same commit in a fresh clone and in
  the working tree — every entry in the two zips has an identical name and
  CRC32. The archives' SHA-256 hashes still differ, because `wxt zip` records
  file mtimes and nothing normalizes them (there is no `SOURCE_DATE_EPOCH`
  support). Do not claim byte-identical rebuilds.
- GitHub Releases attach the exact zip uploaded to CWS + `SHA256SUMS.txt`
  so users can verify store build ↔ source correspondence. That works on the
  released artifact itself, which is the same file in both places — it is not a
  claim that a third party can rebuild the same hash.
- Tags are signed (GPG) — consistent with the tracker-repo signing practice.

## 6. Vulnerability reporting

`SECURITY.md` in repo root (⚠️ create at scaffold): report privately via
GitHub Security Advisories; acknowledgment target 72h; fix-or-mitigate target
14 days for High/Critical. No bounty (hobby project) — credit given in
release notes.
