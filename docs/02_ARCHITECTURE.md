# 02 — Architecture

## 1. High-level shape

Two UI surfaces, **no background service worker**, one pure-logic core:

```
┌───────────────┐     opens      ┌─────────────────────────────────┐
│  Popup (mini) │ ─────────────▶ │  Manager (full-tab SPA)         │
│  3 actions    │                │  #import #export #edit          │
└───────────────┘                │  #settings #about (+ LegalGate) │
                                 └───────────┬─────────────────────┘
                                             │ calls
                              ┌──────────────▼──────────────┐
                              │ src/lib/browser  (adapters) │  chrome.bookmarks
                              │ thin async wrappers          │  chrome.storage
                              └──────────────┬──────────────┘  chrome.i18n
                                             │ uses
                              ┌──────────────▼──────────────┐
                              │ src/lib/core (PURE TS)      │  ← 90%+ test coverage
                              │ parse · serialize · dedupe  │  ← zero browser APIs
                              │ diff · normalize · plan     │
                              └─────────────────────────────┘
```

**Why no background worker:** every feature runs while an extension page is
open. Long imports run in the Manager tab (popups die on blur — never run
work there). Fewer moving parts, fewer review questions.

## 2. Directory layout (WXT conventions)

`wxt.config.ts` sets **`srcDir: 'src'`**, so WXT resolves `entrypoints/`,
`components/` and `assets/` **under `src/`**, and its `@` alias points at
`src/` — i.e. `@/lib/core/model` → `src/lib/core/model.ts`.
(The WXT default, `srcDir: '.'`, would put `entrypoints/` at the repo root and
is incompatible with keeping library code under `src/lib/`.)

⚠️ **`publicDir` must also be set explicitly** — WXT resolves it against the
project *root*, not `srcDir` (`resolve-config.mjs`: `path.resolve(root,
publicDir ?? 'public')`). Without `publicDir: 'src/public'` the build silently
omits `_locales/` and `icon/`, and Chrome then refuses to load the extension
because `__MSG_appName__` and the declared icons resolve to nothing. The build
log gives no warning — verify the output tree, not just the exit code.

```
bookmarkmagic/
├── CLAUDE.md                    # AI build instructions (root)
├── wxt.config.ts                # srcDir + manifest + svelte module
├── biome.json / knip.json / tsconfig.json / vitest.config.ts
├── .nvmrc                       # 24
├── scripts/
│   ├── guard.mjs                # canonical grep gate (08 §3), run by npm run guard
│   └── gen-icons.mjs            # zero-dep placeholder PNG writer (16/32/48/128)
├── docs/                        # this suite (00–15)
├── legal/                       # EULA.md, DISCLAIMER.md, PRIVACY.md, THIRD_PARTY_NOTICES.md
├── src/
│   ├── public/
│   │   ├── icon/                # 16/32/48/128 png
│   │   └── _locales/{en,vi,ja}/messages.json   # manifest-level strings only
│   ├── entrypoints/
│   │   ├── popup/               # index.html + App.svelte + main.ts
│   │   └── manager/             # index.html + App.svelte + main.ts (unlisted page)
│   ├── lib/
│   │   ├── core/                # PURE — see below
│   │   │   ├── model.ts             # BookmarkNode, ImportPlan, Stats types
│   │   │   ├── parse/
│   │   │   │   ├── netscape-html.ts
│   │   │   │   ├── bm-json.ts
│   │   │   │   └── csv.ts
│   │   │   ├── serialize/
│   │   │   │   ├── netscape-html.ts
│   │   │   │   ├── bm-json.ts
│   │   │   │   ├── csv.ts
│   │   │   │   └── markdown.ts
│   │   │   ├── normalize-url.ts
│   │   │   ├── timestamps.ts
│   │   │   ├── dedupe.ts
│   │   │   ├── diff.ts
│   │   │   ├── detect-format.ts
│   │   │   ├── plan.ts              # buildImportPlan → segments (§4)
│   │   │   ├── search.ts            # #edit filter + ancestor expansion
│   │   │   ├── select.ts            # tri-state export selection → subtree
│   │   │   ├── csv-path.ts          # folder-path encoding shared by CSV both ways
│   │   │   └── limits.ts            # MAX_FILE_BYTES, MAX_NODES, MAX_DEPTH, LEGAL_VERSION
│   │   ├── browser/
│   │   │   ├── bookmarks.ts         # getTree/create/move/update/remove wrappers
│   │   │   ├── write-queue.ts       # sequential tree writer + progress + abort
│   │   │   ├── storage.ts           # typed settings/legal accessors
│   │   │   ├── download.ts          # Blob → <a download>
│   │   │   ├── app-info.ts          # manifest version — the ONE source (06 §3.5)
│   │   │   ├── errors.ts            # BmBrowserError / BmBackupError / BmAborted (§7)
│   │   │   └── open-manager.ts      # getContexts() focus-or-create
│   │   ├── import/run-import.ts     # the import pipeline (03 §1)
│   │   ├── export/run-export.ts     # the export pipeline (03 §2)
│   │   ├── edit/                    # patch-tree, move-target, tree-keyboard (03 §3)
│   │   ├── settings/options.ts      # the six Settings choice tables (06 §3.4)
│   │   ├── links.ts                 # repo / legal / donate URLs (14 §4, §5)
│   │   ├── stores/                  # Svelte 5 runes state (.svelte.ts)
│   │   │   ├── settings.svelte.ts   # locale, theme, defaults (persisted)
│   │   │   ├── legal.svelte.ts      # acceptedVersion
│   │   │   ├── toast.svelte.ts      # transient status queue + its timers (06 §4)
│   │   │   ├── route.svelte.ts      # location.hash + hashchange wrapper (§5)
│   │   │   └── import-session.svelte.ts
│   │   ├── i18n/                    # runtime UI i18n (see 07_I18N.md)
│   │   │   ├── index.svelte.ts
│   │   │   ├── format.ts            # pure Intl number/date helpers (07 §3)
│   │   │   ├── resolve-locale.ts
│   │   │   └── locales/{en,vi,ja}.ts
│   │   └── components/              # shared Svelte components (see 06_UI.md)
│   └── styles/
│       ├── tokens.css               # CSS custom properties, themes
│       └── base.css
└── tests/
    ├── fixtures/                    # real exports: chrome/edge/firefox/safari + malformed
    └── unit/                        # mirrors src/lib/core structure
```

## 3. Layer rules (enforced in review)

1. **`core/` imports nothing from `browser/`, `stores/`, Svelte, or `chrome.*`.**
   It may use `DOMParser` (available in extension pages). Tests provide it via
   **jsdom**, which is required rather than optional: the Netscape walk depends
   on HTML5 "generate implied end tags" (the `<DL>` nesting inside an unclosed
   `<DT>`) and on `:scope > h3` from an element root. jsdom uses parse5 and is
   spec-compliant on both; happy-dom implements neither reliably, so a suite run
   there would validate a DOM the browser never produces. `11 §3` carries a
   canary test so an environment swap fails loudly instead of silently.
2. `browser/` may import `core/`. Never the reverse.
3. Svelte components never call `chrome.*` directly — always through
   `browser/` wrappers (mockability + one place for error mapping).
4. Stores hold state; components render; `browser/` performs effects.
5. One file = one responsibility. Format converters are one file per format
   per direction.

## 4. Core data model

```ts
// src/lib/core/model.ts
export interface BookmarkNode {
  title: string;
  url?: string;            // undefined ⇒ folder
  addDate?: number;        // epoch SECONDS (normalized, see timestamps.ts)
  lastModified?: number;   // epoch SECONDS
  toolbar?: boolean;       // Netscape PERSONAL_TOOLBAR_FOLDER
  children?: BookmarkNode[];
}

export interface ParseResult {
  roots: BookmarkNode[];        // top-level nodes from the file
  stats: TreeStats;             // bookmarks, folders, maxDepth
  warnings: ParseWarning[];     // tolerated anomalies (dropped ICON, bad dates…)
}

export type MergeMode = 'new-folder' | 'merge' | 'replace';

export interface PlanSegment {
  rootId: string;               // chrome folder id to write this subtree under
  nodes: BookmarkNode[];
}

export interface ImportPlan {
  mode: MergeMode;
  dedupe: boolean;
  segments: PlanSegment[];      // final, post-dedupe trees + their destinations
  stats: {
    toCreate: number;           // total nodes across ALL segments (folders + bookmarks)
    bookmarkCount: number;      // bookmarks only — the "Import n bookmarks" button label
    skippedExisting: number;    // dropped because the URL is already in the browser
    skippedInFile: number;      // dropped because the URL repeats within the file
  };
}
```

**Why segments and not a single root.** `03 §1` maps `toolbar: true` nodes to
Bookmarks Bar and everything else to Other Bookmarks, and Replace deletes the
children of both roots before writing. A single destination cannot express
that, and would leave the toolbar permanently empty after a Replace.

Segment construction per mode — spelled out so it is not left to interpretation:

| Mode | Segments |
|---|---|
| `new-folder` | Exactly one. `rootId` = Other Bookmarks; `nodes` = the single `Imported <date>` wrapper folder containing the whole parsed tree. `toolbar` is informational only (`03 §1`). |
| `merge` / `replace` | At most two. Subtrees rooted at a `toolbar: true` node → `{ rootId: <Bookmarks Bar> }`; everything else → `{ rootId: <Other Bookmarks> }`. A segment with no nodes is omitted, not emitted empty. |

`stats.toCreate` is the total across all segments — progress and the final
report keep one denominator and one `done` counter for the whole import
(`05 §6`).

Chrome root mapping (Chromium ids are stable): Bookmarks Bar = `"1"`,
Other Bookmarks = `"2"`, Mobile = `"3"`. `browser/bookmarks.ts` resolves them
via `getTree()` rather than hardcoding — segment `rootId`s always come from
that resolution, never a literal — but tests may rely on these ids.

Note the live tree is **not** `BookmarkNode`. `BookmarkNode` is the *file*
model (no ids — `core/` may not know about `chrome.*`, layer rule 1). Anything
touching the browser tree (`#edit`, the duplicate panel, live sync) works with
`chrome.bookmarks.BookmarkTreeNode`, which already carries `id`, `parentId`,
`index`. Export maps the latter down to the former (`03 §2`).

## 5. Manager routing

Hash-based, zero-dependency: `#import` (default) · `#export` · `#edit` ·
`#settings` · `#about`. A tiny `route.svelte.ts` store wraps
`location.hash` + `hashchange`. `options_ui` in the manifest points to
`manager.html#settings` (`open_in_tab: true`).

⚠️ Right-click → Options lands on `#settings` **only when no Manager tab is
already open**. With `open_in_tab: true`, Chrome opens the options page via
singleton-tab matching, which ignores the fragment — so if a Manager tab is
already sitting on `#edit`, Chrome just activates that tab and no navigation
occurs. Whether the view then switches depends entirely on `route.svelte.ts`
reacting to `hashchange`. A URL fragment in `options_ui.page` is also
undocumented (the Chrome reference defines the value as a path); it works in
current Chromium, so keep it, but treat it as behaviour to re-verify at each
submission (`08 §8`).

## 6. Popup → Manager handoff

`browser/open-manager.ts`:
1. `browser.runtime.getContexts({ contextTypes: ['TAB'] })` → find an existing
   manager context (requires Chrome 116+; we target 120+).
2. Found → `browser.tabs.update(tabId, { active: true })` +
   `browser.windows.update(windowId, { focused: true })` (no `tabs`
   permission needed for these calls).
3. Not found → `browser.tabs.create({ url: browser.runtime.getURL('/manager.html') + hash })`.

Popup may pass an intent (`#import` / `#export` / `#edit`) via the hash.

## 7. Error handling strategy

- `core/` throws typed errors (`BmParseError { code, line?, detail }`). The
  code set is closed — add to this table before adding to the code:

  | Code | Raised when |
  |---|---|
  | `NOT_NETSCAPE` | No `NETSCAPE-Bookmark-file-1` doctype **and** no `<DL>` found |
  | `NOT_BM_JSON` | Leading `{` parses, but `format !== "bookmarkmagic"` |
  | `MALFORMED_JSON` | `JSON.parse` throws |
  | `INVALID_NODE` | Structural check fails (missing/non-string `title`, non-string `url`, `children` on a bookmark) |
  | `BAD_CSV_HEADER` | Header row missing or columns not in the fixed order |
  | `CSV_ROW_MISMATCH` | Row field count ≠ header field count |
  | `UNKNOWN_FORMAT` | `detect-format.ts` matched nothing |
  | `FILE_TOO_LARGE` | Size > `MAX_FILE_BYTES` |
  | `TOO_MANY_NODES` | Node count > `MAX_NODES` |
  | `TOO_DEEP` | Nesting depth > `MAX_DEPTH` |

  Non-fatal anomalies are `ParseWarning`s, never errors — including
  `NO_BOOKMARKS` (valid doctype, zero `<DL>`), dropped `<DD>` descriptions,
  ignored `ICON` attributes, and invalid timestamps.
- `browser/` adds `BmBackupError { code }` for the forced safety backup
  (`03 §1` step 6b) and `BmAborted { done }` for a cancelled write.
- `browser/` maps `chrome.runtime.lastError` / promise rejections into typed
  results; never lets raw errors reach components.
- UI shows human-readable, localized messages + a copyable technical detail
  block (for GitHub issue reports).
- The write queue is **abortable** (AbortController) and reports
  `{ done, total, currentPath }` progress events.
