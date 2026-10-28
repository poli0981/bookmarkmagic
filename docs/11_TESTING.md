# 11 — Testing

## 1. Strategy

| Layer | Tool | Target |
|---|---|---|
| `src/lib/core/**` (pure) | Vitest (**jsdom** env for `DOMParser` — see `02 §3`) | **≥ 90% line coverage — CI-enforced** |
| `src/lib/browser/**` | Vitest + hand-rolled `chrome.bookmarks` mock | Write queue, error mapping, abort |
| Components/UI | Manual QA checklist (§5) | No component-test framework in v1 (cost/benefit) |
| End-to-end | Out of scope v1 (Roadmap: Playwright + `--load-extension`) | — |

`vitest.config.ts`: `plugins: [svelte(), WxtVitest()]` (the svelte plugin
compiles runes in `.svelte.ts` stores; WXT's resolves aliases and auto-imports),
`environment: 'jsdom'`, `coverage.provider: 'v8'`. Coverage **measures** every
`src/**/*.ts` module and writes `text` + `lcov` (SonarCloud reads the lcov,
`12 §2.5`), but only core is **gated**: a glob threshold
`'src/lib/core/**': { lines: 90, functions: 90, branches: 85 }`, so widening
what is measured cannot change what is enforced.

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
chrome-156-export.html               # built to bookmark_html_writer.cc byte for byte (CRLF) (v1.1.0)
chrome-156-Bookmarks                 # the SAME profile as Chrome's JSON file — no extension (v1.1.0)
firefox-bookmarks-2026-07-25.json    # Firefox backup of firefox-html-export.html's profile,
                                     #   plus tags root, separator, iconUri, keyword, description, Mobile
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
weird/loose-first.html               # loose bookmark before the wrapper list, no </DT> (v1.1.0)
weird/unclosed-format-tag.html       # unescaped <b> in a title re-opened around every entry (v1.1.0)
weird/invalid-urls.html              # addresses Chrome rejects, place:, bookmarklet, blank (v1.1.0)
weird/bm-legacy-1.0.1-backup.json    # a 1.0.x Replace backup, read with root markers (v1.1.0)
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

The two browser JSON fixtures are **pairs**: each describes the same profile
as an HTML fixture written by that browser's own exporter, and the parity rule
of `04 §2a/§2b` is asserted on them — equal trees and warnings once the JSON's
extra knowledge (where Other and Mobile were) is projected away. Neither is a
capture from a real profile yet; capturing one is a `15` backlog item.

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
- **`serialize/netscape-html.test.ts`** — golden-file comparison (4-space
  indentation, attributes only when present); exactly one root marker per
  folder, the toolbar winning; markers round-trip through our parser; escaping
  of the four markup characters and CR. ⚠️ Written in v1.1.0: this bullet
  described it from Phase 1, but the file did not exist until then.
- **`serialize/bm-json.test.ts`** (v1.1.0) — stable field order with the root
  markers, `root` never beside `toolbar`, compact backup vs indented export,
  markers round-tripped through the parser.
- **Round-trip (the flagship suite):** the assertion is
  `parse(serialize(tree)).roots deepEquals project(tree, format)` — note
  `.roots`, since `parse` returns a `ParseResult` (`02 §4`) — plus
  `warnings.length === 0`, so a parser that silently degrades cannot "pass".
  Run across all three corpora: sample trees, every parsed browser fixture, and
  a property-style randomized generator (200 random trees per format, seeded)
  with titles from a nasty-string pool (quotes, commas, newlines, emoji, `</a>`,
  path slashes).

  ⚠️ **Until v1.1.0 the seeded corpus was empty.** `makeRng` seeded xorshift32
  straight with the integers 1–200, whose first draws are all near zero, so
  `generateTree` drew a child count of 0 every time and the suite compared 200
  empty trees. The seed is now scrambled first, and the suite asserts the
  corpus holds more than 1 000 nodes before it asserts anything else. Any new
  seeded suite carries the same guard (`merge.test.ts` checks that more than a
  quarter of its seeds actually reuse a folder).

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
  query/hash, invalid-URL passthrough; since v1.1.0 a bare `?` or `#` keys like
  the URL without it (`05 §2`).
- **`timestamps.test.ts`** — s/ms/µs magnitude table, invalid → undefined.
- **`dedupe.test.ts` / `diff.test.ts`** — index building, in-file dupes,
  `skippedExisting` vs `skippedInFile` kept distinct, folder preservation,
  preview badges.
- **`plan.test.ts` / `route.test.ts` / `merge.test.ts` / `caps.test.ts`**
  (v1.1.0) — root routing and unwrapping; Merge reusing live folders level by
  level, case-sensitively, never into managed folders; the 200-seed merge
  properties (`05 §5`); the backup caps. **Replace-mode guard:** a Replace plan
  never dedupes — not against the browser, not within the file — and plans
  against emptied roots, otherwise a user re-importing their own backup loses
  part of it (`03 §1`).
- **`import/run-import.test.ts`** (v1.1.0) — the whole pipeline against the
  in-memory `chrome.bookmarks` (`tests/helpers/fake-bookmarks.ts`, which now
  rejects unparseable URLs and turns `url: ''` into a folder, as Chrome does):
  Merge reuses `Bookmarks bar/Dev`; a second Merge with dedupe creates nothing;
  a Replace restore of its own backup, run twice, gives the original tree with
  Mobile back in Mobile; a 1.0.x backup restores into the roots; in-file
  duplicates survive a Replace; the invalid-URL fixture completes; the backup
  is written before the first removal.
- **`import/safety-backup.test.ts`** — the picker/anchor gates, and the three
  cap breaches (nodes, depth, bytes) where nothing is written, downloaded or
  confirmed.
- **`csv` state machine** — RFC 4180 torture cases: `""` escapes, CRLF inside
  quotes, delimiter sniffing, BOM tolerance, `\/` path escapes.
- **`detect-format.test.ts` / `parse-file.test.ts`** — sniffing matrix
  incl. wrong extensions, the anchored doctype, JSON dialect routing, and
  `JSON.parse` called exactly once per file.
- **`parse/chrome-json.test.ts` / `parse/firefox-json.test.ts`** (v1.1.0) —
  roots, vendor roots, localized-title fallback, date units, skipped
  addresses, caps.
- **`parse/netscape-tolerance.test.ts`, `parse/bm-json.v11.test.ts`,
  `parse/csv.v11.test.ts`, `parse/shared.test.ts`, `href.test.ts`** (v1.1.0) —
  the reader rules of `05 §1`: a list after a loose bookmark, every entry after
  an unescaped `<b>`, root markers read by value, a list wrapped in a `<div>`,
  the node cap counted before the DOM is built; addresses Chrome would reject
  skipped and counted, `place:` kept only in the restore formats; empty titles
  kept; a 1.0.x backup's roots recognised; a CSV quote left open reported with
  its line, formula cells neutralised on export and restored on import.

## 4. Browser-layer tests

`tests/unit/browser/write-queue.test.ts` with a mock implementing
`create/removeTree` + failure injection:

- Order preservation (DFS, parent-before-child, sibling order); a Merge
  segment writes into the existing folder it names, after what is there.
- Progress cadence (the first create, every 50, and the final one), one
  denominator across segments, the path prefixed with the segment's trail.
- Abort mid-tree → `BmAborted` carries exact `done` count; no further calls.
- API error on node k → typed failure, k−1 successes reported.
- Replace pre-step calls `removeTree` only on root children.

Also in `tests/unit/browser/` (v1.1.0):

- **`write-lock.test.ts`** (`03 §5`) — a free lock runs the operation and is
  requested `{ ifAvailable: true }`; a held lock refuses at once with
  `WRITE_LOCKED` and never runs it; with no Web Locks API it simply runs.
- **`diagnostics.test.ts`** (`09 §7`) — the newest 200 kept, oldest first, with
  page-relative times; the report's exact keys; a described failure logged by
  code with its URL-bearing detail absent; crash hooks record names only, and
  stop after teardown.

### #edit logic, stores, styles and scripts

The components have no test framework (§1), so everything that can move out of
them is tested where it lives:

- **`stores/edit-session.test.ts`** (v1.1.0) — the #edit commands (`03 §3`)
  against the in-memory fake, which now models Chrome's `move` (the same-parent
  index rule), `update` and `remove` (refusing a non-empty folder): a re-read
  keeps expansion and focus; Sort plans, then puts the folder in order,
  declines a sorted folder, and on a refusal part-way reports `done`/`total`
  and re-reads; a drag reorders by Chrome's index rule; a rename is trimmed and
  a blank or unchanged one makes no call; focus moves to the next row after a
  delete; a new folder clears a search that would hide it; duplicates are
  scanned only while shown.
- **`edit/sort.test.ts`** (v1.1.0) — folders first, natural order, case and
  accents ignored, ties stable, untitled bookmarks by address; only
  out-of-place children move; 300 seeded random folders end sorted when the
  moves are applied with Chrome's index rule (`05 §10`).
- **`edit/move-target.test.ts`** — since v1.1.0 also `planDrop`: both index
  spaces, across folders, into a bookmark, beside itself, beside a root.
- **`edit/live-sync.test.ts`** (v1.1.0) — with a hand-fired scheduler: one
  batch per frame, a burst past the limit becomes one re-read and no patch,
  `resync`, `dispose` (`05 §11`).
- **`stores/toast.test.ts`** — since v1.1.0 also: a danger toast never
  auto-dismisses, and the queue moves on once it is dismissed.
- **`styles/contrast.test.ts`** (widened in v1.1.0 to four surfaces and the
  3:1 boundary pairs) and **`styles/motion.test.ts`** (v1.1.0) — the token
  contrast pairs (`06 §1`) and the reduced-motion guard (`06 §5`), both parsed
  from the real stylesheets, so a new component cannot opt out by forgetting.
  `motion.test.ts` first checks that it found more than 20 styled files to
  police.
- **`tests/unit/scripts/`** — the repo's own gates, tested like code. New in
  v1.1.0: `guard.test.ts` (`08 §3`), `check-manifest.test.ts` (a correct build
  passes, one without the CSP fails) and `sanitize-formats.test.ts` (the
  browser JSON formats and the audit's HTML leaks, beside the older
  `sanitize-bookmarks.test.ts` — `09 §6`).

## 5. Manual QA checklist (run before every store submission)

**A visual sweep first, without loading the extension** (since v1.1.0).
`scripts/screenshots.mjs` serves the **built** extension — `npm run build`
first — on `http://localhost:4318` with a fake `chrome`: neutral sample
bookmarks, so no real profile ever appears, and in-memory storage. Every HTML
page is served with the production CSP as a `<meta>`, so a violation shows in
the console exactly as it would in the extension. Pages take
`?theme=light|dark&lang=en|vi|ja&legal=0|1` and the route as the hash —
`manager.html?theme=dark&lang=vi#edit`; `legal=0` shows the gate. `--shoot`
photographs every route × theme × language at 1280×800 with a local headless
Chrome (`CHROME_PATH`, or the usual install paths), plus the store set
(`13 §2`). Use it to sweep layout, translation overflow and both themes in
minutes. It is **not** the pass below: each page has its own fake tree and
storage, nothing written survives a reload, and the popup's tiles open nothing.

**Fresh profile, Load unpacked:**
- [ ] Legal Gate appears once; declines block #import/#export/#edit; accept
      persists across restart; **#settings and #about reachable pre-accept**
      (switch language before accepting and confirm the gate re-renders in it).
- [ ] Import each browser fixture via drag-drop *and* picker; preview stats
      sane; default mode creates `Imported <date>` folder correctly.
- [ ] **Chrome's `Bookmarks` file** — a copy of a real profile's, or
      `tests/fixtures/chrome-156-Bookmarks`. The picker lists it although it
      has no extension; the preview names the format "Chrome Bookmarks file"
      and marks the bar/Other/Mobile folders with their `→` pills; a Merge puts
      their contents back into the real roots, not into folders named after
      them.
- [ ] **A Firefox JSON backup** (`bookmarks-YYYY-MM-DD.json`, or
      `tests/fixtures/firefox-bookmarks-2026-07-25.json`): format pill "Firefox
      backup"; in new-folder mode its roots arrive under localized names (check
      VI and JA too); `place:` smart bookmarks are skipped and counted.
- [ ] **Merge reuses folders:** import a file holding `Bookmarks bar/Dev/…`
      into a profile that already has `Dev` — no second `Dev`; the new items
      land at the end of the existing one, and the report says how many
      folders were reused. Import it again with dedupe on → nothing created.
- [ ] **Replace:** the confirmation states how many bookmarks and folders will
      be deleted and written — check both against the profile and the preview
      (Cancel is focused; Enter must not confirm). Cancel the save dialog → the
      import aborts with nothing deleted. Then a real Replace: the result
      matches the file, toolbar entries in the Bookmarks Bar. Then restore the
      safety backup with Replace **twice in a row**: the original tree both
      times, Other and Mobile contents back in their own roots, never nested
      one level deeper.
- [ ] Dedupe toggle: re-import same file → all skipped. With **Replace**
      selected the checkbox is disabled and unchecked; re-importing your own
      backup restores everything, duplicate links included.
- [ ] 10k-node generated file: UI stays responsive, progress moves from the
      first create, Cancel stops within ~1s, report counts correct.
- [ ] Export all 4 formats; re-import HTML/JSON → tree equivalent; re-import
      CSV → equivalent **modulo the documented CSV losses** (`04 §3`: empty
      folders gone, top-level "Bookmarks bar" arrives as an ordinary folder,
      no `lastModified`); Excel opens CSV (BOM ✔); filenames correct.
- [ ] Edit: rename (F2; Esc cancels, leaving the field commits), delete w/
      descendant count (focus moves to the next row), new folder (also with a
      search active), search expands ancestors, duplicate panel shows each
      copy's folder, bulk-keep-first.
- [ ] **Sort A→Z** on a mixed folder: folders first, then "Item 2" before
      "Item 10", case ignored; the confirmation states how many items move; an
      already sorted folder says so instead of asking. From the toolbar with a
      bookmark focused it sorts that bookmark's folder.
- [ ] **Drag to reorder:** the upper edge of a row drops before it, the lower
      edge after it (a line shows where), the middle of a folder inside it (a
      dashed outline). Dropping beside itself or into its own subfolder does
      nothing; Esc mid-drag leaves no row highlighted.
- [ ] Keyboard-only pass: Tab reaches the tree in one stop (row buttons are not
      tab stops); arrows, Home/End, type-ahead, Enter, F2, Del. The menu key
      **and** Shift+F10 open **Move to…** with focus in its filter — type to
      narrow, Tab to a folder, Enter moves the item there; Esc closes it and
      focus returns to the tree. Ctrl+C copies the focused link. Every dialog
      opens with focus inside and returns it on close.
- [ ] Language switch EN→VI→JA live-updates all tabs; dates/numbers
      localized; restart persists. Header switcher and the `#settings` row
      agree at all times (one state, two views).
- [ ] Theme: system/light/dark. In **both** light and dark, read text on every
      surface — page, panels, inputs and the status bar, a selected row or
      card — and check the focus ring, control borders and disabled controls
      (readable, not faded). `contrast.test.ts` checks tokens only; an
      `opacity` on text or a hardcoded colour shows up only here.
- [ ] **Reduced motion** (DevTools → Rendering → `prefers-reduced-motion:
      reduce`, or the OS setting): nothing moves — no sliding tab indicator,
      toast slide, dialog rise, marching ants, travelling progress stripes,
      icon bob/spin/tilt/draw/pulse — yet an open folder's chevron still turns.
      Back to no preference: the motion returns.
- [ ] Settings auto-save: change a value, close the tab immediately, reopen —
      the value stuck. The "Saved" toast appears only *after* the write
      confirms, and a failure says so instead.
- [ ] Legal Gate "Close tab" either closes the tab or shows the
      manual-close message — never appears to do nothing.
- [ ] Two Manager tabs open: changing a setting in one **is** reflected in the
      other, and accepting the gate in one drops the gate in the other. Also:
      clearing storage in one must **not** re-raise the gate in the other —
      acceptance is adopted in one direction only, by design (`03 §4`).
- [ ] **Two Manager tabs, one writer** (`03 §5`): start a Replace or a large
      import in one; while it writes, try an import, Sort A→Z and "keep first"
      in the other — each is refused at once ("Another BookmarkMagic tab is
      writing…") and nothing changes. The second tab's #edit keeps up with the
      import without freezing (events land once per frame, `05 §11`); once the
      first finishes, both work normally.
- [ ] **Popup with a Manager tab already open** on another route: Import,
      Export and Open manager each switch that tab to their route; while it is
      writing, the tab stays put and shows the busy toast. The popup's counts
      leave out the three roots — an empty profile reads 0 and 0.
- [ ] About → **Copy diagnostics** after a failed import: the pasted log holds
      phases, error codes and counts — no title, address or file name
      (`09 §7`).
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
folders), timed **under jsdom 29**:

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
