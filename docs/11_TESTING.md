# 11 — Testing

## 1. Strategy

| Layer | Tool | Target |
|---|---|---|
| `src/lib/core/**` (pure) | Vitest (**jsdom** env for `DOMParser` — see `02 §3`) | **≥ 90% line coverage — CI-enforced** |
| `src/lib/browser/**` | Vitest + hand-rolled `chrome.bookmarks` mock | Write queue, error mapping, abort |
| Components/UI | Manual QA checklist (§5) | No component-test framework in v1 (cost/benefit) |
| End-to-end | Out of scope v1 (Roadmap: Playwright + `--load-extension`) | — |

`vitest.config.ts`: `plugins: [WxtVitest()]` (WXT aliases/auto-imports resolve
in tests), `environment: 'jsdom'`, `coverage.provider: 'v8'`,
`coverage.thresholds: { lines: 90, functions: 90, branches: 85 }` scoped to
`src/lib/core/**`.

**Environment canary.** Add one test asserting that a Chrome fixture parses to
a `<DL>` nested *inside* its `<DT>` (`dl.querySelector('dt').querySelector(':scope > dl') !== null`).
The whole Netscape walk depends on that tree shape and on `:scope >` from an
element root; if someone swaps jsdom for happy-dom, this fails immediately
instead of every folder silently parsing as childless.

## 2. Fixtures — `tests/fixtures/`

Real-world exports (committed, small, anonymized):

```
chrome-131-export.html      edge-export.html        firefox-html-export.html
safari-export.html          vivaldi-export.html
bm-v1-sample.json          csv-comma.csv           csv-semicolon.csv
malformed/no-doctype.html   malformed/truncated.html
malformed/doctype-only.html          # valid doctype, zero <DL> → NO_BOOKMARKS warning
malformed/script-injection.html      # <script> + onerror payloads (T1)
malformed/js-url.html                # javascript: bookmark (T3)
weird/deep-nesting.html              # depth 150 (under the 200 cap — tolerance)
weird/over-depth.html                # depth 201 → TOO_DEEP (the cap itself)
weird/folder-with-dd.html            # <DT><H3>/<DD>/<DL> — subtree must survive (04 §1.2)
weird/explicit-close-dt.html         # literal </DT> → sibling-DL branch (05 §1)
weird/hr-separator.html              # Firefox <HR> between entries → skipped
weird/add-date-zero.html             # ADD_DATE="0" → omitted, NO warning
weird/emoji-rtl-titles.html          # 🌸, RTL, CJK titles; & < > " entities
weird/microsecond-dates.html         # Firefox-style timestamps
generate-huge.ts                     # script: emits 100k+1 node file on demand (not committed output)
```

**Rule:** every browser-specific parser quirk discovered later gets a fixture
+ regression test in the same PR.

## 3. Core test suites (one file per module, mirrored paths)

- **`parse/netscape-html.test.ts`** — parses every browser fixture to the
  expected tree shape; sibling-`DL` variant; `DD` dropped with warning; ICON
  aggregated warning; entity unescaping; injection fixture yields inert text
  titles (assert no `<` execution possible — title equals literal string);
  caps: node/depth/size errors with correct codes.
- **`serialize/netscape-html.test.ts`** — golden-file comparison; escaping;
  toolbar attribute placement; 4-space indentation.
- **Round-trip (the flagship suite):** the assertion is
  `parse(serialize(tree)).roots deepEquals project(tree, format)` — note
  `.roots`, since `parse` returns a `ParseResult` (`02 §4`) — plus
  `warnings.length === 0`, so a parser that silently degrades cannot "pass".
  Run across all three corpora: sample trees, every parsed browser fixture, and
  a property-style randomized generator (500 random trees, seeded) with titles
  from a nasty-string pool (quotes, commas, newlines, emoji, `</a>`, path
  slashes).

  `project(tree, format)` is a documented pure helper in the test utils that
  models each format's declared lossiness. **A strict identity round-trip is
  impossible for two of the three formats** — asserting it would gate Phase 1
  on a suite that can never go green:

  | Format | `project` drops |
  |---|---|
  | JSON | nothing — identity |
  | HTML | `lastModified` on bookmarks (`04 §1.1` emits `LAST_MODIFIED` on `<H3>` only, matching Chrome) |
  | CSV | empty folders; `toolbar` everywhere; `addDate` **and** `lastModified` on folders; `lastModified` on bookmarks. Survivors: folder path, title, url, bookmark `addDate` |

  CSV additionally loses cross-folder sibling **order** (folders materialise in
  row order), which no field-level projection can express — so the CSV case
  compares order-insensitively at folder level. Every drop above is deliberate
  and user-facing (`04 §3`, `06 §3.2`, `13 §3`); the fix is to bend the test to
  the documented format, never the format to the test.
- **`normalize-url.test.ts`** — case, default ports, root-slash, preserved
  query/hash, invalid-URL passthrough.
- **`timestamps.test.ts`** — s/ms/µs magnitude table, invalid → undefined.
- **`dedupe.test.ts` / `diff.test.ts`** — index building, in-file dupes,
  `skippedExisting` vs `skippedInFile` kept distinct, folder preservation,
  merge path-matching. **Replace-mode guard:** a Replace plan built from a file
  whose URLs all exist in the browser must yield `toCreate === <all file
  bookmarks>` and `skippedExisting === 0` — otherwise a user re-importing their
  own backup loses everything (`05 §3`).
- **`csv` state machine** — RFC 4180 torture cases: `""` escapes, CRLF inside
  quotes, delimiter sniffing, BOM tolerance, `\/` path escapes.
- **`detect-format.test.ts`** — sniffing matrix incl. wrong extensions.

## 4. Browser-layer tests

`tests/unit/browser/write-queue.test.ts` with a mock implementing
`create/removeTree` + failure injection:

- Order preservation (DFS, parent-before-child, sibling order).
- Progress cadence (every 50 + final).
- Abort mid-tree → `BmAborted` carries exact `done` count; no further calls.
- API error on node k → typed failure, k−1 successes reported.
- Replace pre-step calls `removeTree` only on root children.

## 5. Manual QA checklist (run before every store submission)

**Fresh profile, Load unpacked:**
- [ ] Legal Gate appears once; declines block #import/#export/#edit; accept
      persists across restart; **#settings and #about reachable pre-accept**
      (switch language before accepting and confirm the gate re-renders in it).
- [ ] Import each browser fixture via drag-drop *and* picker; preview stats
      sane; default mode creates `Imported <date>` folder correctly.
- [ ] Merge mode reuses existing same-path folders; Replace forces the backup
      and blocks deletion until it is confirmed (cancel the save dialog → the
      import must abort with nothing deleted); then result matches the file,
      with toolbar entries landing in the Bookmarks Bar.
- [ ] Dedupe toggle: re-import same file → all skipped. With **Replace**
      selected the checkbox is disabled and unchecked; re-importing your own
      backup restores everything.
- [ ] 10k-node generated file: UI stays responsive, progress moves, Cancel
      stops within ~1s, report counts correct.
- [ ] Export all 4 formats; re-import HTML/JSON → tree equivalent; re-import
      CSV → equivalent **modulo the documented CSV losses** (`04 §3`: empty
      folders gone, top-level "Bookmarks bar" arrives as an ordinary folder,
      no `lastModified`); Excel opens CSV (BOM ✔); filenames correct.
- [ ] Edit: rename (F2), delete w/ descendant count, new folder, drag-drop
      reorder + reparent, Move-to menu, search expands ancestors, duplicate
      panel bulk-keep-first.
- [ ] Keyboard-only pass of the tree (WAI-ARIA pattern) + dialogs.
- [ ] Language switch EN→VI→JA live-updates all tabs; dates/numbers
      localized; restart persists.
- [ ] Theme: system/light/dark; contrast spot-check.
- [ ] chrome://extensions → no errors logged during the whole pass.
- [ ] Edge (or Brave): smoke test install + import/export.

## 6. Performance budgets (checked manually in v1)

- Parse 25 MB / 100k HTML file: < 2 s.
- Preview render after parse: < 500 ms (lazy tree).
- Manager cold open: interactive < 1 s.
- Import 10k nodes: progress visible ≤ 500 ms after start; cancel ≤ 1 s.
