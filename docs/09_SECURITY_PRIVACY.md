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
| T5 | Supply-chain compromise | Malicious transitive dep | **Zero runtime deps**; dev deps pinned via lockfile; Dependabot + `npm audit` in CI; Biome installed exact-pinned. |
| T6 | Store-listing impersonation / trademark issues | — | Unique name + linked GitHub; report via CWS if cloned. |
| T7 | XSS via filenames/titles echoed into UI (result cards, toasts) | Weird characters in file name | Same as T1 — text interpolation only; filenames additionally sanitized for the *download* name (`[\\/:*?"<>|]` → `_`). |
| T8 | Clipboard abuse | "Copy URL" action | Uses `navigator.clipboard.writeText` on explicit user click only; never reads the clipboard. |

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

## 4. Permissions posture

`bookmarks` + `storage`, nothing else (justifications in `08 §2`). Any PR
adding a permission must update docs 08/09/13 + the store Privacy tab, and is
a **minor-version** event at minimum.

## 5. Release integrity

- Builds are reproducible from a clean checkout: `npm ci && npm run zip`.
- GitHub Releases attach the exact zip uploaded to CWS + `SHA256SUMS.txt`
  so users can verify store build ↔ source correspondence.
- Tags are signed (GPG) — consistent with the tracker-repo signing practice.

## 6. Vulnerability reporting

`SECURITY.md` in repo root (⚠️ create at scaffold): report privately via
GitHub Security Advisories; acknowledgment target 72h; fix-or-mitigate target
14 days for High/Critical. No bounty (hobby project) — credit given in
release notes.
