# 10 — Coding Standards

## 1. Size limits (review-enforced)

| Unit | Soft limit | Hard limit |
|---|---|---|
| File (.ts / .svelte) | **300 lines** | **500 lines** — split before merging |
| Function / method | 50 lines | 80 lines |
| Svelte component script block | 150 lines | move logic to a `.svelte.ts` store or `core/` |
| Nesting depth | 3 | 4 |

One file = one responsibility (one format × one direction per converter file).
No official industry standard exists for line counts — these are the project
convention, matching prior repos.

## 2. TypeScript — `tsconfig.json` essentials

```jsonc
{
  "extends": "./.wxt/tsconfig.json",          // WXT-generated base
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "verbatimModuleSyntax": true,
    "erasableSyntaxOnly": true
  }
}
```

⚠️ `exactOptionalPropertyTypes` is deliberate but has a cost worth knowing up
front: `BookmarkNode` is optional-heavy (`url?`, `addDate?`, `lastModified?`,
`toolbar?`, `children?`), so every construction site must **omit** absent keys
rather than assign `undefined`. Build nodes with conditional spreads
(`...(addDate !== undefined && { addDate })`), not `{ addDate: undefined }`.

- `any` is forbidden (`unknown` + narrowing instead). `as` casts require a
  `// SAFETY:` comment explaining why.
- Named exports only in `src/lib/**` (Knip-friendly, grep-friendly).
  Svelte components are inherently default-exported — that's the exception.
- Public functions in `core/` get JSDoc with `@throws` documented.
- Discriminated unions over boolean flags for state
  (`{ kind: 'parsed', … } | { kind: 'error', … }`).

## 3. Biome — `biome.json` (2.5.x)

```jsonc
{
  "$schema": "https://biomejs.dev/schemas/2.5.2/schema.json",
  "vcs": { "enabled": true, "clientKind": "git", "useIgnoreFile": true },
  // Svelte and CSS are excluded on purpose — see the note below.
  "files": { "includes": ["src/**", "tests/**", "*.ts", "!**/*.svelte", "!**/*.css"] },
  "formatter": { "enabled": true, "indentStyle": "space", "indentWidth": 2, "lineWidth": 100 },
  "javascript": { "formatter": { "quoteStyle": "single", "semicolons": "always", "trailingCommas": "all" } },
  "linter": {
    "enabled": true,
    "rules": {
      "preset": "recommended",                 // 2.5.x key; `"recommended": true` is the pre-2.5 shape
      "correctness": { "noUnusedImports": "error", "noUnusedVariables": "error" },
      "suspicious": { "noExplicitAny": "error", "noConsole": { "level": "error", "options": { "allow": ["warn", "error"] } } },
      "style": { "noDefaultExport": "error" }  // overridden off for **/*.svelte — see below
    }
  },
  "assist": { "enabled": true, "actions": { "source": { "organizeImports": "on" } } }
}
```

- **Biome does not lint `.svelte` here.** Biome 2.x Svelte/HTML support is
  behind `html.experimentalFullSupportEnabled`; the portfolio precedent
  (`switch-every-tab-hotkey`) excludes `.svelte` and `.css` instead, and we
  follow it rather than putting the build on an experimental flag.
  **`svelte-check` is the authority** for everything inside `.svelte`.
- There is **no Biome rule that catches `{@html}`.** `noDangerouslySetInnerHtml`
  is a React rule and does not apply to Svelte. The ban in `09 §3` is enforced
  by the canonical grep gate (`08 §3`, run as `npm run guard`) and by review —
  not by the linter.
- `overrides` block: `noDefaultExport` must be relaxed for **`**/*.svelte`**,
  not just `entrypoints/**` — every Svelte component is a default export,
  `src/lib/components/**` included. Also relax `noConsole` in
  `src/entrypoints/**` bootstrap files and `wxt.config.ts`.
- Version-pin the `$schema` URL in lockstep with the exact `@biomejs/biome`
  version chosen at scaffold (`01 §2`); a mismatched schema silently hides
  renamed keys.

## 4. Knip — `knip.json`

```jsonc
{
  "$schema": "https://unpkg.com/knip@6/schema.json",
  "entry": ["src/entrypoints/**/main.ts", "src/entrypoints/**/index.html", "tests/**/*.test.ts", "scripts/*.mjs"],
  "project": ["src/**/*.{ts,svelte}", "tests/**/*.ts"],
  "ignoreDependencies": []
}
```

Knip is on **v6** (`01 §2`). Two things v6 changed, both verified at scaffold:

- **Do not set `compilers: { svelte: true }`.** v6 dropped Svelte from its
  built-in compiler list (only `.mdx`, `.scss`, `.less`, `.styl`, `.tsrx`
  remain), so the boolean shorthand leaves a literal `true` where a function is
  expected and knip crashes with `TypeError: compiler is not a function`.
  v6's **Svelte plugin** registers the `.svelte` compiler automatically
  whenever `svelte` is a dependency — omit the key entirely.
- `wxt.config.ts` and `vitest.config.ts` do not belong in `entry`; the wxt and
  vitest plugins already declare them, and listing them again is reported as a
  redundant-pattern hint.

Tests are in both `entry` and `project` so that a constant used only by its own
test does not read as dead code.

CI fails on any unused file, export, or dependency. Intentional keep-arounds
require an explicit `"ignore"` entry **with a comment** in the config, never
a naked suppression.

## 5. Naming & structure

- Files: `kebab-case.ts`; Svelte components: `PascalCase.svelte`;
  runes stores: `name.svelte.ts`.
- Functions: verbs (`parseNetscapeHtml`, `buildImportPlan`); booleans:
  `is/has/can` prefixes; constants: `SCREAMING_SNAKE` in `limits.ts`.
- No abbreviations except `id`, `url`, `csv`, `html`, `json`, `i18n`.
- Import order (Biome-organized): node/browser std → wxt/svelte → `$lib`
  aliases → relative. No deep relative chains (`../../..`) — use the `@/`
  alias WXT provides.

## 6. Comments & docs

- Comments explain **why**, not what. Parser tolerance quirks (§04) must cite
  the browser that produces them (`// Safari 17 emits sibling DL — see 04 §1.2`).
- Every `core/` module starts with a 3–6 line header: purpose, inputs,
  guarantees.
- `TODO(scope):` only with a linked GitHub issue number.

## 7. Git & commits

- **Conventional Commits** (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`,
  `chore:`, `ci:`); scope = area (`feat(import): …`).
- Branches: `feat/…`, `fix/…` off `main`; `main` is always releasable.
- PR checklist (template): verify passes · docs updated if behavior changed ·
  i18n keys added in all 3 locales · no new permissions.
- Version bumps: semver; `package.json` is the single source (WXT propagates
  to the manifest).

## 8. Svelte 5 conventions

- Runes only: `$state`, `$derived`, `$effect`, `$props`. No legacy
  `$:`/stores-API in new code.
- Cross-component state lives in `.svelte.ts` modules, not context, unless
  scoped to a subtree (tree selection uses context).
- `$effect` bodies must be small and cleanup-returning when they subscribe
  (bookmark event listeners pattern, `03 §3`).
- Props are typed via `let { x }: Props = $props()` with an explicit
  `interface Props`.
