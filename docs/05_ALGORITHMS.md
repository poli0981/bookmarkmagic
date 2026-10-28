# 05 — Algorithms

All in `src/lib/core/` (pure, unit-tested) except the write queue
(`src/lib/browser/write-queue.ts`, tested against a mocked API).

## 1. Netscape HTML parsing — `parse/netscape-html.ts`

**Never regex-parse.** Use `DOMParser` + a manual walk:

```
parseNetscapeHtml(text):
  if count of '<dt' in text > MAX_NODES → BmParseError('TOO_MANY_NODES')   // before any DOM
  doc = new DOMParser().parseFromString(text, 'text/html')
  hasDoctype = /NETSCAPE-Bookmark-file-1/i.test(text.slice(0, 512))
  hasEntries = doc has any <DL>, or body has a direct <DT> child
  if !hasEntries and !hasDoctype → BmParseError('NOT_NETSCAPE')
  if !hasEntries → return { roots: [], stats: emptyStats, warnings: [{ code: 'NO_BOOKMARKS' }] }
  roots = collectRoots(doc.body)
  if roots is empty → roots = walk every outermost <DL> anywhere   // wrapped in <div>/<table>

collectRoots(body):                        // NOT "the outermost DL" — see 04 §1.2
  consumed = { nextDlFor(dt) for each direct FOLDER <DT> child of body }
  roots = []
  for el of body.children in document order:
    if el is DT       → roots.push(...readEntry(el, depth 1))
    if el is DL and el not in consumed → roots.push(...walkDl(el, 1))
  return roots

own(dt, tag):                              // dt > b > a after an unclosed <b>
  return dt's direct <tag> child, else the first descendant <tag> whose closest DT is dt

walkDl(dl, depth):
  for entry of dl's <DT>/<DD>, looking THROUGH wrapper elements (dl > b > dt):
    DD → warning DESCRIPTIONS_DROPPED
    DT → if depth > MAX_DEPTH → BmParseError('TOO_DEEP'); out.push(...readEntry(dt, depth))

readEntry(dt, depth):                      // returns 0..n nodes
  h3 = own(dt, 'h3')
  if h3:                                   // folder
    node = { title: h3.textContent, toolbar/root markers by VALUE (04 §1.1), dates… }
    childDl = nextDlFor(dt); node.children = childDl ? walkDl(childDl, depth + 1) : []
    return [node]
  a = own(dt, 'a')
  if !a → warning UNREADABLE_ENTRIES; return []
  bookmark = classify(a.href): missing/invalid/place: → warning, none   // see below
             else { title: a.textContent (kept, even empty → EMPTY_TITLE), url, dates… }
  swallowed = own(dt, 'dl')                 // a loose bookmark swallowed the next list
  return [bookmark?, ...(swallowed ? walkDl(swallowed, depth) : [])]
  every node counts against MAX_NODES → BmParseError('TOO_MANY_NODES')
```

**Address classification (`core/href.ts`, every reader).** Blank →
`MISSING_URL`. `URL.canParse` false → `INVALID_URL`: `chrome.bookmarks.create`
rejects those with "Invalid URL." mid-write, and an extension page's
`URL.canParse` runs the same Chromium URL library. `place:` → skipped with
`PLACE_QUERIES_SKIPPED` in browser-written formats (Netscape HTML, Chrome, Firefox
JSON), **kept** in BM JSON and CSV, which are restore formats. Everything else —
`javascript:` and `data:` included — is stored verbatim (`09` T3).

**Titles are kept exactly as written** (since v1.1.0) — empty included, counted as
`EMPTY_TITLE`. The old `textContent || href` fallback replaced deliberately
cleared titles (a favicon-only bar) with full URLs. All readers share this rule
through `parse/shared.ts`.

**`walkDl(null)` must be unreachable** — a valid-doctype file with zero `<DL>`
is tolerated per `04 §1.2`, so the guard above returns an empty `ParseResult`
rather than letting a raw `TypeError` escape `core/` (`02 §7`).

**Key detail `nextDlFor(dt)` — check three places, in order:**

1. **Inside the `<DT>`** (the normal case). The HTML parser *always* nests the
   child `<DL>` here when the file omits `</DT>`, which every browser exporter
   does. Indentation and line breaks are irrelevant: only a `dt`/`dd` start tag
   or the parent's end closes a `dt`.
2. **Inside (or after) a `<DD>` next-sibling.** A `<DD>` closes the `<DT>` and
   then swallows the following `<DL>` — miss this and the whole subtree is lost
   (`04 §1.2`).
3. **The `<DT>`'s next-sibling `<DL>`.** Reachable only when the file emits an
   explicit `</DT>`, which some third-party exporters do. A fixture for this
   branch **must contain a literal `</DT>`** or it will parse as case 1 and the
   branch ships untested.

Use `textContent` (never innerHTML) → titles are inert.

**Complexity:** O(n) nodes, single pass. Timing: see `11 §6` (the only measured
figure is a jsdom one).

## 2. URL normalization — `normalize-url.ts`

Purpose: dedupe/diff keys only — **never rewrites stored URLs**.

The failure mode to guard against is a **false positive**: two different URLs
producing the same key means one of them is silently dropped on import. Keep
userinfo, port, host and path all in the key — in particular, do not rebuild a
bare-origin key from `protocol + host`, which discards `user:pass@`.

```
normalizeUrl(raw):
  u = new URL(raw)                    // throws → return raw.trim() as-is key
  u.protocol, u.hostname → lowercase
  strip default ports (http:80, https:443)
  if u.pathname == '/' and no search/hash → key without trailing slash
  keep search & hash verbatim         // conservative: ?q= and #section are meaningful
  return u.toString()
```

Explicitly **not** done: stripping `utm_*`, stripping `www.`, unifying
http/https — too opinionated for a dedupe default. (Roadmap: optional
"aggressive dedupe" toggle.)

## 3. Dedupe — `dedupe.ts`

```
buildUrlIndex(tree)  → Map<normKey, count>        // O(n), from current browser tree
dedupeAgainst(nodes, index):
  DFS copy of import tree
  drop bookmark if index.has(key)      → skippedExisting++
  drop bookmark if seenInFile.has(key) → skippedInFile++
  prune folders that became empty AND were not empty in source? → NO: keep
    (user intent: folder structure preserved; note in report)
  return { nodes, skippedExisting, skippedInFile }
```

**Two counters, not one.** "Already in your browser" and "repeated inside the
file" are different facts and the user sees both separately in the report
(`02 §4` `stats`). Keep them apart end to end — a single `skippedDuplicates`
made the report, the checkbox label and the StatsCard disagree.

**Replace mode: pass an empty index.** The browser tree is deleted before the
write (`§6`), so nothing can already exist. Building the plan against the live
index would skip every bookmark of a user re-importing their own backup and
leave them with nothing. In-file collapsing still applies. The UI enforces the
same thing by disabling the checkbox (`03 §1`, `06 §3.1`).

Duplicate finder (#edit) reuses the same normalized-URL keying, but over the
**live** tree — `Map<normKey, chrome.bookmarks.BookmarkTreeNode[]>`, so each
entry carries the `id` that per-item delete needs. Groups with length > 1,
ordered by group size desc.

## 4. Timestamp normalization — `timestamps.ts`

Epoch magnitude detection (target: **seconds**):

| Input value `v` | Interpreted as | Convert |
|---|---|---|
| `v === 0` | undated | omit, **no warning** |
| `0 < v < 1e11` | seconds | keep |
| `1e11 ≤ v < 1e14` | milliseconds | `/1e3` |
| `1e14 ≤ v < 1e17` | microseconds | `/1e6` |
| else / NaN / negative | invalid | omit + warning |

Boundaries in real instants: `1e11 s` = 5138-11-16, `1e14 ms` = 5138-11-16,
`1e17 µs` = 5138-11-16 — each bucket is exactly 1000× the previous, so they are
non-overlapping and cover the same window in all three units.

Two deliberate choices:

- **The seconds floor is `1`, not `1e8`.** Chrome's own HTML importer accepts
  any `0 < t < 2^32` (1970-01-01 … 2106-02-07); a `1e8` floor would silently
  drop 1970–1973 dates that Chrome itself imports fine.
- **`0` is silent.** Chrome writes `ADD_DATE="0"` for nodes with no recorded
  date, so warning on it would flood the warning list on perfectly normal
  exports (`04 §1.3`).

The µs bucket is **defensive**, not a known-live case: every browser that
writes Netscape HTML emits seconds, including Firefox. Microsecond values come
from non-browser exporters — and from the two browser JSON files, which have
their own converters precisely so that they never go through magnitude
guessing: Chrome's `Bookmarks` file counts microseconds since **1601**
(`chromeTimeToSeconds`, by string slicing — the values exceed 2^53), and
Firefox's backup counts PRTime microseconds since 1970 (`microsToSeconds`). A
1971 PRTime date is about 3e13 and would read as milliseconds here (`04 §2a/§2b`).

Round to integer seconds. HTML/JSON/CSV export always writes seconds — which is
what browsers put in *files*. Do not confuse this with `chrome.bookmarks`,
whose `dateAdded` is milliseconds; that conversion happens in
`browser/bookmarks.ts` when mapping the live tree into `BookmarkNode`
(`03 §2`).

## 5. Diff / preview stats — `diff.ts`

v1 semantics: a bookmark is "duplicate" if its normalized URL exists
**anywhere** in the current tree (path-insensitive — matches user
expectation "do I already have this link?").

```
diffAgainstBrowser(parsed.roots, browserIndex):
  walk parsed tree → per node: status = 'new' | 'exists'
  return { newCount, existsCount, perNodeStatus: WeakMap }   // WeakMap feeds preview badges
```

**Merge-mode folder matching** — `core/merge.ts` `planIntoFolder` (since
v1.1.0; 1.0.x documented this and never called it). Per destination root,
after routing (`03 §1`):

```
visit(fileNodes, liveParent, trail):
  byTitle = first writable child FOLDER of liveParent per exact title   // lazily, once
  for node of fileNodes:
    if node is a folder and byTitle has node.title:
      reused++; visit(node.children, thatLiveFolder, trail + title)     // never created
    else:
      segment(liveParent.id).nodes.push(node)                           // created, subtree inside
```

- Matching is **level by level**: a file folder is compared only with the
  children of the live folder its parent matched — so a "Dev" below a folder
  that does not exist yet is never matched against some other "Dev".
- Exact and case-sensitive; bookmarks never match folders; policy-managed
  (`unmodifiable`) folders never match and are never descended into; the first
  of two same-named live siblings wins.
- Two same-named folders in the *file* that both match one live folder both
  write into it; when neither matches, both are created. Replace plans through
  the same function against emptied roots, so it creates everything and keeps
  the file's structure exactly.
- Recursion follows the file tree, which the parsers cap at 200 levels; the
  live tree is only ever read one matched folder at a time.
- Properties asserted over 200 random file/live pairs (`merge.test.ts`): every
  `parentId` is a writable live folder; created + reused = every file node; no
  created folder has the title of a writable folder already in its parent.

## 6. Sequential write queue — `browser/write-queue.ts`

`chrome.bookmarks` has **no bulk insert**; order is preserved by awaiting
each create and letting Chrome append (no explicit `index` needed when
creating in order).

```
writeTree(plan, { signal, onProgress }):
  total = plan.stats.toCreate; done = 0        // one counter for the WHOLE import
  async dfs(nodes, parentId, trail):
    for node of nodes:
      if signal.aborted → throw BmAborted(done)
      created = await bookmarks.create({ parentId, title, url? })
      done++; if done % 50 == 0 or done == total → onProgress({done,total,currentPath})
      if node.children → await dfs(node.children, created.id, trail + node.title)
  for (const seg of plan.segments)             // 1 (new-folder), or one per live folder written to
    await dfs(seg.nodes, seg.parentId, seg.trail ?? [])
```

`done` and `total` are declared outside the loop, so progress, abort and the
final report stay whole-import scoped rather than resetting per segment.

`create()` accepts only `{ parentId, index?, title, url? }` — `dateAdded` is
output-only, so **imported nodes are stamped with the current time**. Parsed
`addDate`/`lastModified` survive file→file conversions but not a write into the
browser; `toolbar` survives as *routing* (which root a segment targets), not as
a stored flag. Neither is a defect — it is the platform — but say so in the
import report rather than letting users infer otherwise (`00 §8`).

- Throughput ≈ 300–800 creates/s in practice → 10k items ≈ 15–35 s ⇒ progress
  UI + cancel are mandatory, "keep this tab open" notice shown.
- Yield to the event loop every 200 ops so the tab stays responsive:
  ```ts
  await (globalThis.scheduler?.yield?.() ?? new Promise((r) => setTimeout(r)));
  ```
  ⚠️ The parentheses are load-bearing. Written as
  `await scheduler.yield?.() ?? new Promise(...)` it parses as
  `(await scheduler.yield?.()) ?? new Promise(...)` — which **never yields**:
  below Chrome 129 it awaits `undefined` and discards an un-awaited Promise,
  and on 129+ `yield()` resolves with `undefined` so it leaks a stray timer
  every call. Extract this as a small helper with a unit test that stubs
  `globalThis.scheduler` as `undefined`; CI on a current Chrome will otherwise
  never exercise the fallback branch.
- Replace mode must skip roots reporting `unmodifiable` (Chrome exposes a
  **Managed bookmarks** root under enterprise/supervised policy) — `removeTree`
  on one of those rejects.
- Abort leaves already-created nodes in place; report states exactly how many
  were written and where (new-folder mode makes cleanup trivial: delete the
  one folder).
- Replace mode pre-step: `for child of root.children → removeTree(child.id)`
  on Bookmarks Bar + Other Bookmarks (+ Mobile), after the forced backup has
  been **proven** (`03 §1` step 6b), skipping `unmodifiable` nodes.

## 7. CSV parse/serialize — `parse/csv.ts`, `serialize/csv.ts`

Hand-rolled RFC 4180 state machine (`inQuotes` flag, `""` unescape, CRLF/LF
tolerant, delimiter sniff between `,`/`;` on the header row). ~60 lines,
exhaustively unit-tested. Path split honors `\/` and `\\` escapes (§04 §3).

## 8. Search filter (#edit)

Case-insensitive substring over `title + ' ' + url` using
`String.prototype.includes` on a lowercased cache; debounce 150 ms. On match:
mark node + all ancestors visible, auto-expand ancestors. O(n) per keystroke
is fine ≤ 100k nodes. No fuzzy search in v1 (zero-dep rule).

## 9. Tree rendering scale strategy

Folders render collapsed by default (depth ≥ 2) and children mount lazily on
expand — the DOM never holds the full 100k tree. If a single folder with
>5 000 direct children is expanded, render in chunks of 500 with a
"Show more" sentinel. This avoids a virtual-list dependency in v1.
