# 03 — Data Flow

## 1. IMPORT pipeline

```
[1] Select file          drag & drop or file picker — any file; no extension
        │                filter (Chrome's `Bookmarks` file has none)
[2] Pre-validate         size ≤ MAX_FILE_BYTES (25 MB)
        │                fail → localized error, stop
[3] Detect format        parse-file.ts → detect-format.ts: content sniffing,
        │                JSON parsed once and routed by shape (04 intro)
[4] Parse                per-format parser → ParseResult
        │                node count ≤ MAX_NODES (100 000) · collect warnings
        │                fail → error + line/detail, stop
[5] PREVIEW (user gate)  tree preview (lazy-rendered) + stats card:
        │                  n bookmarks · n folders · max depth
        │                  n duplicates vs current browser tree (diff.ts)
        │                  warnings list (e.g. "favicons will not be imported")
[6] Configure            MergeMode:
        │                  ● New folder  "Imported 2026-07-03 14:05"  (DEFAULT)
        │                  ○ Merge       (existing folders reused, level by level)
        │                  ○ Replace all (DANGER: forces step 6b)
        │                Dedupe toggle: skip URLs already in browser
        │
[7] Build ImportPlan     from ONE Start-time read of the live tree:
        │                dedupe.ts → route.ts → merge.ts → plan.ts. Built
        │                BEFORE the backup, so a failure here deletes nothing.
[6b] Safety backup       Replace only. Five sub-steps, see "Safety backup"
        │                below. Non-skippable, and deletion never starts until
        │                the backup is proven or the user explicitly overrides.
        │                (Numbering kept from 1.0.x for cross-references; since
        │                v1.1.0 the plan comes first.)
[8] Write                browser/write-queue.ts:
        │                  sequential DFS create (parent → children, in order)
        │                  progress events every 50 ops → progress bar + path label
        │                  Cancel button → AbortController → partial state reported
[9] Report               success card: created / skipped / warnings
                         actions: [Open Edit tab] [Import another file]
```

**Rules**

- Steps 1–7 touch nothing in the browser. The first write happens at step 8.
- Replace = delete children of Bookmarks Bar + Other Bookmarks (+ Mobile if
  present), then write. Roots themselves are never deleted (API forbids it).
- **Root routing** (`core/route.ts`), top-level nodes only — deeper, markers
  are data. A folder that *is* a browser root is **unwrapped**: its children go
  into that root and the folder itself is never written.
  - `toolbar: true` folder → its children into the Bookmarks Bar (a flagged
    bookmark, malformed but possible, goes there as itself);
  - `root: "other"` folder → its children into Other Bookmarks, in its place in
    the order;
  - `root: "mobile"` folder → its children into Mobile Bookmarks; a profile
    with no Mobile root keeps it as an ordinary folder under Other;
  - everything else → Other Bookmarks.

  The markers come from our own exports and backups (`04 §1.1`, §2), from
  Firefox's HTML export (`UNFILED_BOOKMARKS_FOLDER`), and from the two browser
  JSON files (`04 §2a/§2b`). Without them — 1.0.x — every restore nested a
  folder named "Other bookmarks" inside Other Bookmarks, one level deeper each
  time, and Mobile never came back. In **new-folder** mode nothing is routed:
  the whole tree, root folders included, goes under
  `Other Bookmarks/Imported <date>/…` (markers recorded in the preview as
  informational).
- **Merge reuses folders** (`core/merge.ts`, `05 §5`). Below each destination
  root, a file folder with the exact, case-sensitive title of a writable child
  folder of the live folder its parent matched is reused — never created,
  moved or renamed — and new items are **appended** to it. The first of two
  same-named live folders wins; policy-managed folders never match. Bookmarks
  are never "updated" — only created or skipped (dedupe). 1.0.x planned Merge
  exactly like Replace and re-created every folder, so "merge" produced a
  second "Dev" beside the first.
  **CSV can never target the Bookmarks Bar** — the format has no `toolbar`
  column, so a parsed CSV node always has `toolbar === undefined` and its first
  path segment is an ordinary folder title. Re-importing our own CSV export in
  merge/replace mode therefore produces `Other Bookmarks/Bookmarks bar/…`, not
  the real toolbar. Documented limitation, surfaced in the Export tab (`04 §3`).
- **Dedupe is off in Replace mode — both halves of it.** The browser tree is
  deleted before the write, so nothing can already exist, and a Replace
  restores a file *exactly*: two copies of a link in the backup are two
  bookmarks after the restore. `buildImportPlan` computes the effective value
  (`dedupe && mode !== 'replace'`) and stores it in `plan.dedupe`; the stored
  preference is untouched. In 1.0.x the box showed unchecked while in-file
  repeats were still collapsed. The UI disables and unchecks the dedupe
  checkbox when Replace is selected (`06 §3.1`).
- Merge dedupes against the **Start-time** read of the tree, not the preview's
  snapshot, so a link bookmarked between preview and Start is not added twice.
  The preview snapshot drives only the badges.
- Import runs **only in the Manager tab**, never in the popup (popup teardown
  on blur would kill the write queue).

**Safety backup (step 6b), in detail.** The anchor-download approach (`01 §3`,
deliberately no `downloads` permission) gives no success signal — if the user
has "Ask where to save each file" on and cancels, the file is never written and
we would then delete every bookmark they own. So:

1. **Open the save target first.** `showSaveFilePicker()` is the only
   activation-gated call, so it must run *before anything is awaited* in the
   click handler — reading the tree first burns the activation window on
   exactly the largest profiles. Only the handle is acquired here; writing is
   not activation-gated. Cancel ⇒ `BmBackupError { code: 'BACKUP_CANCELLED' }`.
2. **Read the live tree ONCE, and serialize from that read.** The same
   `LiveNode[]` the plan was built from is serialized and then handed to the
   delete step, so the backup is provably a superset of what is removed.
   Serializing the *preview-time* snapshot instead loses anything bookmarked
   between preview and Start — with no copy on disk. Any serialize throw aborts
   with `BACKUP_SERIALIZE_FAILED`.
   The snapshot carries the root markers — `toolbar: true` on the Bookmarks
   Bar, `root: "other"`/`"mobile"` on the other two — or restoring the backup
   nests them under Other Bookmarks.
3. **Refuse a backup the import could not read back** (since v1.1.0). The
   backup is compact BM JSON (no indentation, about half the bytes), and before
   a single byte is written it is checked against the import's own caps — node
   count, depth, then the serialized size (`core/caps.ts`). A breach raises
   `BACKUP_EXCEEDS_LIMITS` and nothing is written, downloaded, confirmed or
   deleted. 1.0.x wrote such a backup, deleted the tree, and the parser then
   refused the backup on restore.
4. **Attest.** Picker path: writer `close()` resolving proves the backup —
   proceed. Fallback `<a download>` path: **no signal exists**, so the import
   enters an `attesting` state and shows a blocking confirm ("Check your
   downloads folder for `bookmarkmagic-backup-….json`, then confirm") —
   anything other than an explicit confirmation is treated as
   `BACKUP_CANCELLED` and nothing is deleted.
5. **Delete.** Only now. The UI enters a `clearing` state that offers **no
   Cancel button**: the deletion loop is abortable, but presenting a cancel
   affordance mid-delete let a user cancel and then be told "0 items created"
   after their tree was already gone. Cancel becomes available again once the
   write phase starts.

## 2. EXPORT pipeline

```
[1] Load current tree     browser/bookmarks.getTree() → map to BookmarkNode[]
[2] Choose scope          ● Everything   ○ Selected folders (tree + checkboxes,
        │                  parent/child tri-state)
[3] Choose format         HTML (default) · JSON · CSV · Markdown
        │                 + per-format options (CSV delimiter , or ; · MD flat/nested)
[4] Serialize             core/serialize/<format>.ts → string (UTF-8)
[5] Download              browser/download.ts:
                            Blob → URL.createObjectURL → <a download> click → revoke
                            filename: bookmarks-<scope>-YYYYMMDD-HHmm.<ext>
```

No `downloads` permission needed. Export of 50k nodes serializes in memory —
fine at our size cap (strings of a few MB).

## 3. EDIT flows (Manager → #edit)

| Action | Path |
|---|---|
| Search | input (debounced 150 ms) → core filter on title+URL → tree shows matches with ancestors expanded |
| Rename | inline edit / F2 → `bookmarks.update(id, { title })` |
| Move | drag & drop or context-menu "Move to…" (folder picker) → `bookmarks.move(id, { parentId, index })` |
| Delete | context menu / Del key → confirm dialog (folder shows descendant count) → `removeTree` / `remove` |
| New folder | toolbar button / context menu → `bookmarks.create({ parentId, title })` → inline-edit title |
| Open bookmark | click URL → `tabs.create({ url })` (`javascript:` URLs are display-only, never opened) |
| Duplicate finder | scan tree → groups by normalized URL → panel lists groups → per-item delete, "keep first in each group" bulk action (confirm) |

**Live sync:** `#edit` subscribes to `bookmarks.onCreated/onRemoved/onChanged/
onMoved` and patches the in-memory tree, so external changes (or our own
import) appear without reload. Listeners attach on tab enter, detach on leave.

## 4. Settings & legal flows

- Settings writes go through `stores/settings.svelte.ts` →
  `chrome.storage.local` (debounced 200 ms). Shape:
  `{ locale, theme, defaultExportFormat, defaultMergeMode, csvDelimiter,
  markdownStyle }` — **six** fields, one `<SettingRow>` each (`06 §3.4`).
- `updateSettings(patch)` returns a `SaveOutcome` that resolves when the
  debounced write has **settled**, and never rejects. UI feedback follows the
  write; it never precedes it, or a failed save still says "Saved".
- The store object is **mutated in place**, never replaced, so a component that
  reads `getSettings()` into a local cannot silently go stale. Writes pass a
  plain snapshot — `chrome.storage.local.set` structured-clones its argument and
  a Svelte `$state` proxy is not cloneable.
- `flushSettings()` runs on `visibilitychange` → hidden (not `beforeunload`,
  which is cancellable). It shrinks the window in which an unwritten change is
  lost from 200 ms to roughly nothing — not to zero.
- Legal gate: on Manager mount read `legal.acceptedVersion`; if
  `< LEGAL_VERSION` render `<LegalGate>` overlay blocking **#import / #export /
  #edit** — **#settings and #about stay reachable**, so a VI/JA user can switch
  language (and theme) before reading the notice and the gate needs no language
  switcher of its own. Accept → write version + timestamp → unlock.
  This three-route set is normative; `14 §2` states the same list.
  Details: `14_LEGAL_GATE.md`.
- The gate's accept path writes **first**, awaits, and only then reflects
  acceptance in state. Dismissing optimistically would leave the user accepted
  in the UI and unaccepted on disk, so the gate would silently reappear next
  launch. A storage read failure fails **closed** (gate shown).

## 5. State machines (informal)

Import session: `idle → validating → parsed → (backing-up → attesting? →
clearing) → writing → done | error | cancelled`. Stored in
`import-session.svelte.ts`, together with the parsed file itself — the Manager
unmounts the tab on every route change, so component-local state would be lost
while the session still said `parsed`, leaving a preview with no badges and a
dead Import button.

`attesting` and `clearing` occur in Replace mode only. While any of
`backing-up`/`attesting`/`clearing`/`writing` is active the other tabs are
disabled, so an in-app route change cannot orphan the queue — `beforeunload`
only covers closing or reloading the tab, not internal navigation.
