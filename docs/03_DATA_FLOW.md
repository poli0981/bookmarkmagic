# 03 — Data Flow

## 1. IMPORT pipeline

```
[1] Select file          drag & drop or file picker (.html .htm .json .csv)
        │
[2] Pre-validate         extension allowlist · size ≤ MAX_FILE_BYTES (25 MB)
        │                fail → localized error, stop
[3] Detect format        detect-format.ts (content sniffing, not extension-trust)
        │
[4] Parse                per-format parser → ParseResult
        │                node count ≤ MAX_NODES (100 000) · collect warnings
        │                fail → error + line/detail, stop
[5] PREVIEW (user gate)  tree preview (lazy-rendered) + stats card:
        │                  n bookmarks · n folders · max depth
        │                  n duplicates vs current browser tree (diff.ts)
        │                  warnings list (e.g. "favicons will not be imported")
[6] Configure            MergeMode:
        │                  ● New folder  "Imported 2026-07-03 14:05"  (DEFAULT)
        │                  ○ Merge       (folders matched by path+title)
        │                  ○ Replace all (DANGER: forces step 6b)
        │                Dedupe toggle: skip URLs already in browser
        │
[6b] Safety backup       Replace only. Three sub-steps, see "Safety backup"
        │                below. Non-skippable, and deletion never starts until
        │                the backup is proven or the user explicitly overrides.
[7] Build ImportPlan     core/diff.ts + dedupe.ts → final node list + counts
        │
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
- Merge mode folder matching: same *path of titles* from the root ⇒ reuse
  folder; otherwise create. Bookmarks are never "updated" — only created or
  skipped (dedupe).
- Toolbar mapping: nodes with `toolbar: true` target Bookmarks Bar; everything
  else targets Other Bookmarks. This is why `ImportPlan` carries **segments**
  rather than one destination (`02 §4`). In **new-folder** mode the whole tree
  goes under `Other Bookmarks/Imported <date>/…` preserving structure (toolbar
  flag recorded in the preview as informational).
  **CSV can never target the Bookmarks Bar** — the format has no `toolbar`
  column, so a parsed CSV node always has `toolbar === undefined` and its first
  path segment is an ordinary folder title. Re-importing our own CSV export in
  merge/replace mode therefore produces `Other Bookmarks/Bookmarks bar/…`, not
  the real toolbar. Documented limitation, surfaced in the Export tab (`04 §3`).
- **Dedupe is inert in Replace mode.** The browser tree is deleted before the
  write, so nothing can already exist: build the plan against an *empty*
  browser index and force the browser-side skip off, or a user re-importing
  their own backup would have every bookmark skipped and lose everything. The
  UI disables and unchecks the dedupe checkbox when Replace is selected
  (`06 §3.1`). In-file duplicate collapsing still applies when the toggle is on.
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
   `LiveNode[]` that gets serialized is the one handed to the delete step, so
   the backup is provably a superset of what is removed. Serializing the
   *preview-time* snapshot instead loses anything bookmarked between preview
   and Start — with no copy on disk. Any serialize throw aborts with
   `BACKUP_SERIALIZE_FAILED` and never reaches step 7.
   The snapshot must carry `toolbar: true` on the Bookmarks Bar, or restoring
   the backup nests the whole toolbar under Other Bookmarks.
3. **Attest.** Picker path: writer `close()` resolving proves the backup —
   proceed. Fallback `<a download>` path: **no signal exists**, so the import
   enters an `attesting` state and shows a blocking confirm ("Check your
   downloads folder for `bookmarkmagic-backup-….json`, then confirm") —
   anything other than an explicit confirmation is treated as
   `BACKUP_CANCELLED` and nothing is deleted.
4. **Delete.** Only now. The UI enters a `clearing` state that offers **no
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
  `{ locale, theme, defaultExportFormat, defaultMergeMode, csvDelimiter }`.
- Legal gate: on Manager mount read `legal.acceptedVersion`; if
  `< LEGAL_VERSION` render `<LegalGate>` overlay blocking **#import / #export /
  #edit** — **#settings and #about stay reachable**, so a VI/JA user can switch
  language (and theme) before reading the notice and the gate needs no language
  switcher of its own. Accept → write version + timestamp → unlock.
  This three-route set is normative; `14 §2` states the same list.
  Details: `14_LEGAL_GATE.md`.

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
