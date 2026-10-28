# 09 — Security & Privacy

## 1. Privacy guarantees (product-level, non-negotiable)

1. **Zero data collection.** No analytics, no telemetry, no crash reporting,
   no update pings. There is no server. The local diagnostics log (§7) is not
   an exception: it lives in the page's memory and leaves it only when the user
   copies it and pastes it somewhere themselves.
2. **Zero network activity at runtime.** Enforced in three layers, all in
   `08 §3`: the production CSP (`connect-src 'none'` — the browser itself
   refuses), `check:manifest`'s scan of the shipped bundle, and the source gate
   `scripts/guard.mjs`. Do not restate their rules here. Links the user
   chooses to open (About, the legal documents, "Open" on a bookmark) load in a
   browser tab; that is navigation the user asked for, not a request the
   extension makes.
3. **Everything on-device.** Bookmarks are read/written via `chrome.bookmarks`
   locally; files are parsed in-page and downloaded via Blob URLs. `chrome.
   storage.local` holds only settings + legal flag (no `storage.sync` — even
   settings stay off the vendor cloud, consistent with the product promise).
4. Open source (GPL-3.0) — the privacy claims are verifiable.

## 2. Threat model

| # | Threat | Vector | Mitigation |
|---|---|---|---|
| T1 | **Malicious import file — markup injection** | Crafted `<script>`/`onerror` payloads in a .html bookmark file | `DOMParser('text/html')` produces an **inert** document (scripts never execute). We read `textContent`/`getAttribute` only. Rendering uses Svelte text interpolation — **`{@html}` is banned repo-wide**. |
| T2 | Malicious file — resource exhaustion (huge/deep/zip-bomb-style) | 500 MB file, 1M nodes, 10k-deep nesting | Pre-parse size cap 25 MB; node cap 100 000 — for HTML counted on the raw text before `DOMParser` builds anything (since v1.1.0; before, 1.7 M entries were materialised first); depth cap 200 — typed errors, parse aborts early. Replace's safety backup is held to the same caps before a byte is written (`BACKUP_EXCEEDS_LIMITS`, `core/caps.ts`), so a profile too large to restore is never deleted on the strength of a backup the parser would refuse. Bounded rendering (`05 §9`) caps what mounts at once. |
| T3 | Dangerous URLs in imported bookmarks (`javascript:`, `data:`) | Clicking them in #edit | Never rendered as `<a href>`; "Open" passes only `http:`/`https:` to `tabs.create` (`browser/open-url.ts` — our allowlist, not the browser's refusal, is the control). UI marks every other scheme with a ⚠ badge; those are display-only. Imported URLs are stored verbatim (user's data, not ours to censor) — the browser's own bookmark UI applies its own rules. |
| T4 | Data loss from destructive import | User picks "Replace all" casually; two Manager tabs write at once | Non-skippable auto safety-backup (BM JSON download) *before* deletion, refused outright when the import could not read it back; danger-styled confirm with exact counts; default mode is non-destructive new-folder; one bookmark writer across tabs (`03 §5`). |
| T5 | Supply-chain compromise | Malicious transitive dep | **Zero runtime deps**; dev deps pinned via lockfile; Dependabot with a 7-day cooldown + `min-release-age=7`; `npm audit --omit=dev` in CI; Biome installed exact-pinned. See §3.1. |
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

### v1.1.0 — what changed against the model

- **T4's confirmation did not exist until v1.1.0.** The row has always promised
  a "danger-styled confirm with exact counts"; 1.0.x had only a danger-styled
  button. Replace now opens a `ConfirmDialog` — focus on Cancel — stating how
  many bookmarks and folders will be deleted (everything inside the writable
  roots, from the preview read) and how many will be written (a preview plan
  with the chosen mode and dedupe), `06 §3.1`. Checked by hand (`11 §5`); the
  counts come from tested pieces (`prepareImport`, `buildImportPlan`).
- **T2 met T4 in the backup.** A profile past the node, depth or size cap got a
  backup that the parser then refused — after the tree had been deleted. The
  backup is now compact BM JSON, checked against the import's own caps before
  anything is written, downloaded or deleted (`03 §1` step 6b;
  `safety-backup.test.ts`, `caps.test.ts`).
- **A second tab was an unmodelled writer.** Two Manager tabs replacing at once
  would each back up, then delete what the other was writing. The import, Sort
  A→Z and keep-first now hold a Web Lock, and a second writer is refused before
  it touches anything (`03 §5`, `write-lock.test.ts`).
- **Diagnostics are new data, kept local** — what may and may not be recorded
  is §7.

## 3. Secure coding rules (enforced)

- `{@html}` — **forbidden**. Enforced by the source gate (`scripts/guard.mjs`,
  `08 §3`) and review. Biome has no rule for this: `noDangerouslySetInnerHtml` is a React
  rule and does not see Svelte templates.
- `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `setHTMLUnsafe`,
  `createContextualFragment`, `srcdoc`, `document.write` — forbidden outright,
  reads included (same gate).
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

### 3.1 Dev-dependency advisories

**There is no `overrides` block any more** (removed 2026-10-28). The six pins
added on 2026-07-26 (`shell-quote`, `adm-zip`, `tmp`, `uuid`, `esbuild`,
`brace-expansion`) had all become dead: WXT 0.21 dropped `web-ext-run`, which
four of them sat under, and Vite 8 bundles with rolldown rather than esbuild.
None of the six packages was in the lockfile — and a stale override is worse
than none, because the day the package returns it silently pins it.

State after the v1.1.0 toolchain pass (Node 26, Vitest 5, Vite 8.3, WXT 0.21.4):

| Check | Result |
|---|---|
| `npm audit --omit=dev` | **0** — nothing third-party is a runtime dependency (CI runs this, `12 §2.1`) |
| `npm audit` (dev included) | 3 low, one root cause: **`deepmerge`** (GHSA-gcqx-w48m-w2h4, prototype poisoning in `mergeObject`), reached through `@sveltejs/vite-plugin-svelte`. **No fixed version exists.** It merges the build's own plugin options at dev/build time — never user data, never in the shipped extension — so it is accepted and recorded rather than overridden. Re-check when the plugin drops or bumps it. |

How new advisories are kept out:

- `.npmrc` sets `min-release-age=7`, and Dependabot's `cooldown` is 7 days:
  a release must have been public for a week before this repo installs it. The
  2025 npm compromises were caught and pulled within hours to days, so that
  window is the point (`01 §6`).
- `npm ci` installs exactly what the lockfile pins and is unaffected by the
  age rule — verified, not assumed.
- Dependabot *security* PRs bypass `cooldown`; one for a version younger than
  a week may fail to resolve until it ages. That is the intended trade-off.

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

`SECURITY.md` in the repo root is the policy in force. Summary:

- **Supported: the latest version published on the Chrome Web Store, only.** No
  back-porting — Chrome auto-updates every installed copy once a release passes
  review, so there is no population left behind to back-port for.
- Report privately via GitHub Security Advisories, or `security@poli0981.dev`
  for reporters without a GitHub account (`contact@` is retired since v1.1.0;
  each purpose has its own address). Never a public issue.
- Acknowledgement 72 h; fix **prepared** within 14 days for High/Critical. Time
  to *users* is that plus store review, which is outside our control — the
  policy says so rather than implying a delivery guarantee we cannot make.
- No bounty (hobby project); credit in the release notes.

**Sample files from reporters.** A bookmark file is a browsing history, so the
policy asks reporters to run `scripts/sanitize-bookmarks.mjs` first — it rewrites
every hostname, path, query value, title, note, keyword and tag while preserving
the structure, encoding, and timestamps a parser bug depends on, so the sanitized
file still reproduces. It reads Netscape HTML, BookmarkMagic JSON, Chrome's
profile `Bookmarks` file, Firefox `.json` backups and our CSV, and refuses
anything else. JSON is rewritten default-deny (every string value except a short
list of structural keys). Before writing, it checks its own output — no host but
its `*.example` aliases, and for HTML no text left that is not a placeholder —
and writes nothing if that check fails. Until 2026-10-28 it accepted any JSON
and rewrote only `url`/`title`, so Chrome's profile file (titles under `name`)
came out with every title intact. Anything received by email is kept only as long as needed to
reproduce and fix, then deleted; `legal/PRIVACY.md` states the same to users.
This is the receiving-side counterpart to §3's rule that error messages never
echo more than a 120-character excerpt of file content.

## 7. Local diagnostics — `browser/diagnostics.ts`

A bug report needs more than "it failed", and §1 rules out sending anything.
So since v1.1.0 each page keeps its last **200** events in a ring buffer in
module memory, and About → **Copy diagnostics** puts them on the clipboard as
JSON — on an explicit click, write-only, like Copy link (T8). The user decides
whether to paste it anywhere.

**Recorded:** import phases — `parsed` (with the detected format and node
count), `planned:<mode>`, `backup-proven`, `cleared`, `written`; every failure
the UI shows, by its i18n code and the error's class name, logged inside
`describeError` — the one place failures are described; bulk edits (`sort`,
`keep-first`) with their counts; storage read and decode failures, by a fixed
issue name; uncaught errors and unhandled rejections, by error **name**
(`installCrashHooks`, in the popup and the Manager).

**Never recorded:** titles, addresses, file names, folder paths; a failure's
`detail` text, which can quote a URL or a line of the file; error messages and
stacks; stored values; wall-clock time — entries carry milliseconds since the
page loaded.

- `DiagEvent` is a closed union with no field for a title, an address or a
  path — adding one is a type change under review, not a call site — and every
  string field is itself a **union of fixed values**: the import phases,
  `FileFormat`, the `ErrorKey`s `describeError` can return, the two edit
  actions, the three storage issues, and an allowlist of error names (anything
  else is logged as `'other'`, since a name is just a string property). 1.1.0's
  first cut typed them all `string`; the test file now carries
  `@ts-expect-error` cases, so a title stops compiling, not just reviewing. The copied report adds only the extension version, the language and
  theme *preferences*, and Chrome's major version from the user agent.
- Never written to `storage`, never sent (the CSP would refuse it anyway,
  `08 §3`), gone when the tab closes. The log is per page: the popup installs
  the crash hooks too, but has no Copy button, so nothing can read its log.
- `tests/unit/browser/diagnostics.test.ts`: the 200-entry cap and order, the
  report's exact keys, a failure logged by code with its URL-bearing detail
  absent, crash hooks by name with the message absent.
- `legal/PRIVACY.md` describes the same log to users; the two must agree.
