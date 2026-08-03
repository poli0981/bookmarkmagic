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
weird/folder-with-dd.html            # <DT><H3>/<DD>/<DL> — subtree must survive (04 §1.2)
weird/explicit-close-dt.html         # literal </DT> → sibling-DL branch (05 §1)
weird/mixed-wrapper.html             # some roots wrapped, some not → root-list selection rule (04 §1.2)
weird/safari-no-wrapper.html         # no wrapper <DL> at all → same rule, other branch
weird/emoji-rtl-titles.html          # 🌸, RTL, CJK titles; & < > " entities
weird/microsecond-dates.html         # Firefox-style timestamps
```

Generated on demand, never committed: `scripts/gen-fixture.mjs` writes
arbitrarily large Netscape files into `tests/fixtures/generated/` (git-ignored)
for the 10k responsiveness item in §5 and the 100k parse measurement in §6.

Three behaviours have **no dedicated fixture** because a real browser export
already covers them, and a second file would only be a second thing to maintain:

| Behaviour | Covered by |
|---|---|
| `<HR>` separators skipped | `firefox-html-export.html` (`fixtures.test.ts` "firefox: DD does not eat the subtree, HR is skipped") |
| `ADD_DATE="0"` → omitted, **no** warning | `chrome-131-export.html` (same suite, asserted explicitly) |
| Depth past the cap → `TOO_DEEP` | built synthetically in `parse/netscape-html.test.ts` — cheaper and clearer than committing a 201-level file |

**Rule:** every browser-specific parser quirk discovered later gets a fixture
+ regression test in the same PR. `CONTRIBUTING.md` documents the full ritual
end to end; note `.gitattributes` sets `tests/fixtures/** -text` so EOL
normalization cannot rewrite the CRLF/BOM bytes a bug may depend on.

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
      localized; restart persists. Header switcher and the `#settings` row
      agree at all times (one state, two views).
- [ ] Theme: system/light/dark; contrast spot-check.
- [ ] Settings auto-save: change a value, close the tab immediately, reopen —
      the value stuck. The "Saved" toast appears only *after* the write
      confirms, and a failure says so instead.
- [ ] Legal Gate "Close tab" either closes the tab or shows the
      manual-close message — never appears to do nothing.
- [ ] Two Manager tabs open: changing a setting in one **is** reflected in the
      other, and accepting the gate in one drops the gate in the other. Also:
      clearing storage in one must **not** re-raise the gate in the other —
      acceptance is adopted in one direction only, by design (`03 §4`).
- [ ] Browser **Back** during a write: stays on `#import`, progress and Cancel
      remain reachable, and a "busy" toast explains the refusal.
- [ ] Browser **Back** while the backup attestation is on screen: same. This is
      the path that used to deadlock the Manager until the tab was closed.
- [ ] Right-click → Options **while a write is running**, with a Manager tab
      already open. The deep-link is refused by the same guard; confirm it
      behaves as `02 §5` describes rather than appearing to do nothing.
- [ ] The import report states that imported bookmarks carry today's date — in
      EN, VI **and** JA.
- [ ] chrome://extensions → no errors logged during the whole pass.
- [ ] Edge (or Brave): smoke test install + import/export.

**Upgrade + published-build pass (every submission after the first):**

These have no equivalent in a first submission, and the upgrade item is the only
failure mode that would hit every installed user at once.

- [ ] Install the **currently published** version from the store on a clean
      profile. Accept the gate, change two settings, import a fixture. This is
      the prior state the upgrade test needs.
- [ ] Update that profile to the new build (load unpacked over it, or wait for
      the store rollout). Then: the legal gate does **not** reappear
      (`legal.acceptedVersion` survived), both settings survived, bookmarks are
      untouched, and chrome://extensions logs nothing.
      ⚠️ If `LEGAL_VERSION` was bumped the gate *will* reappear for everyone —
      that is `14 §2` working as designed, and it must be a deliberate decision
      recorded in `15`, never a surprise found here.
- [ ] After the update goes live: install from the store on a clean profile and
      smoke it. This is the only check that the artifact users receive is the
      artifact that was tested (`13 §1b` step 10).

## 6. Performance budgets (checked manually in v1)

- Parse 25 MB / 100k HTML file: < 2 s.
- Preview render after parse: < 500 ms (lazy tree).
- Manager cold open: interactive < 1 s.
- Import 10k nodes: progress visible ≤ 500 ms after start; cancel ≤ 1 s.

### Measured 2026-07-26 — Phase 5

A generated 100 000-node Netscape file (11.2 MB, 99 000 bookmarks in 1 000
folders), timed **under jsdom**:

| Stage | Time |
|---|---|
| `detectFormat` | 0 ms |
| `parseNetscapeHtml` | **2 869 ms** |
| `buildUrlIndex` | 42 ms |
| `diffAgainstBrowser` | 53 ms |
| `serializeNetscapeHtml` | 72 ms |

⚠️ **This does not settle the 2 s budget either way.** Everything except the
parse is pure JS and comfortably fast; the parse is dominated by `DOMParser`,
and jsdom's parse5 implementation is roughly an order of magnitude slower than
Chrome's native parser. The budget is about the real browser, so the honest
reading is "≤ 2.9 s in the slowest environment we can measure from a test".

The number that decides it has to come from Chrome. ⚠️ Still unmeasured
(`00 §10.8`) — but no longer unmeasurable: the generator the original entry
assumed now exists.

**Procedure (reproducible, ~5 minutes):**

```bash
node scripts/gen-fixture.mjs --nodes 100000 --out tests/fixtures/generated/huge.html
npm run build            # load .output/chrome-mv3 unpacked, fresh profile
```

Then in the Manager: open DevTools → Performance, drop the file on `#import`,
and time **drop → preview rendered**. Record the number, the Chrome version and
the machine below; a figure without those three is not comparable to anything.

| Date | Chrome | Machine | Drop → preview |
|---|---|---|---|
| ⚠️ | | | |

Re-measure whenever the jsdom major changes, since the table above is jsdom's
parse5 and not Chrome's parser — a jsdom bump invalidates the 2 869 ms row
rather than updating it. Add a column; do not overwrite.
