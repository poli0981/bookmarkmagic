# 01 — Tech Stack

> Versions verified against npm/official sources on **2026-07-25**.
> Rule: latest stable or LTS only, with any deliberate exception stated inline.
> Re-verify minor/patch at scaffold time (`npm outdated`), but do NOT jump
> majors without a doc update.

## 1. Runtime target

| Item | Choice | Rationale |
|---|---|---|
| Browser | Chrome / Chromium, **Manifest V3** | MV2 is fully retired. Edge/Brave/Vivaldi/Opera work from the same build. |
| Min Chrome | `minimum_chrome_version: "120"` | Margin over our highest hard-floor API, `runtime.getContexts()` (116+). `scheduler.yield()` (129+) is used only behind a nullish fallback, so it does not raise the floor — see `08 §7`. |
| Runtime deps | **0 (zero)** | `DOMParser`, `Blob`, `URL`, `crypto.randomUUID` cover all needs. |

## 2. Toolchain (dev dependencies)

| Tool | Version (2026-07) | Role |
|---|---|---|
| Node.js | **24.x (Active LTS)** | Build runtime. Active LTS until Oct 2026, maintained to 2028-04-30. Node 26 is *Current*, not LTS — do not use for production tooling yet. |
| npm | bundled with Node 24 (v11) | Package manager. Commit `package-lock.json`. |
| **WXT** | **^0.20.27** | Extension framework: entrypoints, manifest generation, HMR, `wxt zip`, `wxt submit`. |
| **TypeScript** | **~6.0.3** (strict) | Deliberate exception to "latest stable": TS **7.0 went GA 2026-07-08** (7.0.2 is `dist-tags.latest`), but the Go-native compiler exposes no stable programmatic API yet and Microsoft's own GA post says Svelte/Volar toolchains "can only currently rely on TypeScript 6.0" — full support is deferred to 7.1. Since `svelte-check` is our template type authority, we hold on 6.x. Pin with `~` (patch-only). Revisit when TS 7.1 ships **and** svelte-check declares support. |
| **Svelte** | **^5.56.4** | UI, runes mode only (`$state`, `$derived`, `$effect`, `$props`). |
| @wxt-dev/module-svelte | latest at scaffold | WXT ↔ Svelte integration. |
| **Biome** | **2.5.2 (pinned exact)** | Lint + format (replaces ESLint + Prettier). Install with `npm i -D -E @biomejs/biome` per Biome guidance. |
| svelte-check | ^4.7.1 | Type/template authority for `.svelte` files. |
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
  "engines": { "node": ">=24" },
  "scripts": {
    "postinstall": "wxt prepare",             // generates .wxt/tsconfig.json — 10 §2 extends it
    "dev": "wxt",
    "dev:firefox": "wxt -b firefox",          // build sanity only, no store release
    "build": "wxt build",
    "zip": "wxt zip",
    "check": "svelte-check --tsconfig ./tsconfig.json && tsc --noEmit",
    "lint": "biome check .",
    "lint:fix": "biome check --write .",
    "knip": "knip",
    "guard": "node scripts/guard.mjs",        // canonical grep gate, 08 §3
    "test": "vitest run",
    "test:watch": "vitest",
    "coverage": "vitest run --coverage",
    "verify": "npm run lint && npm run check && npm run knip && npm run guard && npm run test"
  }
}
```

`postinstall` is not optional: `tsconfig.json` extends `./.wxt/tsconfig.json`
(`10 §2`), which does not exist until `wxt prepare` has run, so a clean
`npm ci` would otherwise fail type-checking.

`npm run verify` is the local gate — it must pass before every commit that
touches `src/` (mirrors CI, see `12_CI_CD.md`). CI additionally runs
`npm run coverage` for the threshold gate (`11 §1`).

Also set `repository`, `homepage` and `bugs` to
`https://github.com/poli0981/bookmarkmagic` — `13`/`14` link to those URLs.
Commit `.nvmrc` containing `24`.

## 6. Version pinning policy

- `typescript` → `~` (patch only; TS minors can break svelte-check).
- `@biomejs/biome` → exact (`-E`), formatter output must be reproducible.
- Everything else → `^`, with `package-lock.json` committed as source of truth.
- Renovate/Dependabot: weekly, grouped, majors require manual review.
