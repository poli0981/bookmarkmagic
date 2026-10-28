# 01 — Tech Stack

> Versions verified against npm/official sources on **2026-10-28** (first pass
> 2026-07-25).
> Rule: latest stable or LTS only, with any deliberate exception stated inline.
> Re-verify minor/patch at scaffold time (`npm outdated`), but do NOT jump
> majors without a doc update.

## 1. Runtime target

| Item | Choice | Rationale |
|---|---|---|
| Browser | Chrome / Chromium, **Manifest V3** | MV2 is fully retired. Edge/Brave/Vivaldi/Opera work from the same build. |
| Min Chrome | `minimum_chrome_version: "136"` (was `"120"` through v1.0.1) | The ES2025 floor: 136 is the first Chrome with every ES2025 built-in (`RegExp.escape` 136, `Float16Array` 135, `Promise.try` 128, iterator helpers and Set methods 122). The manifest floor, Vite's `build.target` (`chrome136`) and tsconfig's `lib: ["ES2025", …]` are one number stated three times — `wxt.config.ts` derives two of them from `CHROME_FLOOR`, and `tests/unit/manifest.test.ts` pins all three. Users on Chrome 120–135 keep the version they have and stop receiving updates; nothing is uninstalled. `scheduler.yield()` (129+) is now always present, though the write queue keeps its fallback because the test environment has no `scheduler`. |
| Runtime deps | **0 (zero)** | `DOMParser`, `Blob`, `URL`, `showSaveFilePicker` and `navigator.clipboard` cover all needs. "Zero" means no npm `dependencies`: the compiled Svelte runtime still ships inside the bundle — see `legal/THIRD_PARTY_NOTICES.md`. |

## 2. Toolchain (dev dependencies)

| Tool | Version (2026-07) | Role |
|---|---|---|
| Node.js | **26.x (Active LTS)** (was 24.x through v1.0.1) | Build runtime. Node 26 entered Active LTS on 2026-10-28 (maintenance from 2027-10-20, end of life 2029-04-30); Node 24 moved to maintenance on 2026-10-20. `.nvmrc`, `engines` and every CI job say 26 — CI reads `.nvmrc` where it can, and passes `'26'` to the ops reusable, which takes a string input. |
| npm | bundled with Node 26 (v11.20+) | Package manager. Commit `package-lock.json`. `.npmrc` sets `min-release-age=7` (§6). |
| **WXT** | **^0.21.3** (was ^0.20.27 through v1.0.0) | Extension framework: entrypoints, manifest generation, HMR, `wxt zip`, `wxt submit`. **0.x, so a minor is semver's breaking slot** — and 0.21 was: `wxt/testing` split into `wxt/testing/fake-browser` and `wxt/testing/vitest-plugin`, and `tabs.create` is now typed as returning `void`. Both are dev-only. Never take a WXT bump without diffing the **built** manifest before and after (`12 §2.3`); `tests/unit/manifest.test.ts` reads `wxt.config.ts` and is structurally incapable of noticing. |
| **TypeScript** | **7.0 for `tsc`, 6.0 for the API** (strict) | Two packages under two names, Microsoft's documented side-by-side setup for toolchains that embed the compiler: `"@typescript/native": "npm:typescript@~7.0.2"` provides the `tsc` binary (the Go-native 7.0 compiler that type-checks every `.ts` file in `npm run check`), and `"typescript": "npm:@typescript/typescript6@~6.0.2"` keeps the TS 6.0 programmatic API under the `typescript` module name (it re-exports the real `typescript@6.0.x` and adds a `tsc6` binary). svelte-check (peer `typescript ^5 || ^6`) and Volar need that API — TS 7 has none until 7.1 — so `.svelte` files are checked by 6.0 and `.ts` files by both. `tsc --version` must say 7.x and `tsc6 --version` 6.x. Drop the alias when svelte-check declares TS 7 support. Both pinned `~` (patch-only). |
| **Svelte** | **^5.56.4** | UI, runes mode only (`$state`, `$derived`, `$effect`, `$props`). |
| @wxt-dev/module-svelte | latest at scaffold | WXT ↔ Svelte integration. |
| **Biome** | **2.5.2 (pinned exact)** | Lint + format (replaces ESLint + Prettier). Install with `npm i -D -E @biomejs/biome` per Biome guidance. |
| svelte-check | ^4.7.4 | Type/template authority for `.svelte` files. |
| **@types/node** | **^26** (matches the Node major) | Types for `node:fs`, `node:path`, `node:child_process` and `process`, which the test suite and `scripts/*.mjs` genuinely use. **Declared explicitly since 2026-08-03** — it used to arrive transitively, and WXT 0.21 stopped providing it. Types only: erased at build, so hard rule 2 (zero *runtime* dependencies) is untouched. |
| jsdom | **^30** (was ^29 through v1.0.0) | Test DOM. Not interchangeable — `02 §3` picks jsdom over happy-dom because the Netscape walk depends on parse5's implied-end-tag behaviour. A major bump runs `tests/unit/dom-environment.test.ts` first; if that canary fails, pin rather than loosen the test. |
| **Knip** | **^6** (6.29.0 latest as of 2026-07) | Dead code: unused files, exports, dependencies. Requires Node ≥ 20.19. v6 swapped the TypeScript backend for oxc-parser — confirm `compilers.svelte` is still the supported `.svelte` hook before scaffold (`10 §4`). |
| **Vitest** | latest stable at scaffold | Unit tests for `src/lib/core`. |
| @vitest/coverage-v8 | match Vitest | Coverage reporting. |

## 3. Explicitly rejected

| Rejected | Why |
|---|---|
| Tailwind CSS | Scoped Svelte styles + CSS custom properties suffice for a 5-tab app; avoids a build-time dependency and keeps the reviewable bundle tiny. (JSONPrism uses Tailwind because it is a large web app; different trade-off.) |
| React/Vue | Svelte 5 is the established extension stack (SETWH precedent); smallest output. |
| ESLint + Prettier | Replaced by Biome (portfolio standard). |
| Any bookmark-parsing npm package | Netscape format is simple; owning the parser = owning round-trip fidelity + zero supply-chain surface. |
| `chrome.downloads` API | Anchor-download (`<a download>` + Blob URL) works in extension pages with **no extra permission**. `window.showSaveFilePicker()` — also permission-free — covers the one case the anchor cannot: a *confirmable* write, used for the forced safety backup (`03 §1` step 6b). Neither needs `downloads`. |
| Obfuscation tooling | Prohibited by Chrome Web Store policy. Minify-only (WXT/Vite default). |

## 4. Optional, gated additions (require explicit approval)

| Package | Trigger | Notes |
|---|---|---|
| `fflate` | v1.1 "export all formats as one .zip" | Already trusted in JSONPrism. Tree-shakeable. |
| `@types/chrome` | Only if WXT's bundled `browser` typings prove insufficient | Prefer WXT's `browser` global. |

## 5. package.json scripts (canonical)

```jsonc
{
  "license": "GPL-3.0-or-later",
  "engines": { "node": ">=26" },
  "scripts": {
    "postinstall": "wxt prepare",             // generates .wxt/tsconfig.json — 10 §2 extends it
    "dev": "wxt",
    "dev:firefox": "wxt -b firefox",          // build sanity only, no store release
    "build": "wxt build",
    "zip": "wxt zip",
    "check": "svelte-check --tsconfig ./tsconfig.json && tsc --noEmit",   // TS 6 API, then the TS 7 tsc (§2)
    "lint": "biome check .",
    "lint:fix": "biome check --write .",
    "knip": "knip",
    "guard": "node scripts/guard.mjs",        // canonical grep gate, 08 §3
    "test": "vitest run",
    "test:watch": "vitest",
    "coverage": "vitest run --coverage",
    "verify": "npm run lint && npm run check && npm run knip && npm run guard && npm run test",
    "verify:full": "npm run verify && npm run coverage && npm run build && npm run check:manifest"
  }
}
```

`postinstall` is not optional: `tsconfig.json` extends `./.wxt/tsconfig.json`
(`10 §2`), which does not exist until `wxt prepare` has run, so a clean
`npm ci` would otherwise fail type-checking.

`npm run verify` is the local gate — it must pass before every commit that
touches `src/`.

It is **not** the same gate CI and a release tag run, and the difference bites:
both additionally run `coverage` (the `11 §1` thresholds), `build` and
`check:manifest`. A change to `src/lib/core/**` that drops branch coverage below
85 therefore passes every local step and fails only *after* the tag is pushed —
by which point `release.yml` may already have created the GitHub Release, which
is not re-runnable. `verify:full` closes that gap and is what `CLAUDE.md` hard
rule 8 requires before anything release-bearing.

Also set `repository`, `homepage` and `bugs` to
`https://github.com/poli0981/bookmarkmagic` — `13`/`14` link to those URLs.
Commit `.nvmrc` containing `26`.

## 6. Version pinning policy

- `@typescript/native` (TS 7 `tsc`) and `typescript` (the TS 6 API alias) → `~` (patch only; TS minors can break svelte-check). Dependabot ignores majors of both — a 7→8 or 6→7 jump is a doc decision, not a weekly bump.
- `@biomejs/biome` → exact (`-E`), formatter output must be reproducible.
- Everything else → `^`, with `package-lock.json` committed as source of truth.
- Renovate/Dependabot: weekly, grouped, majors require manual review.
