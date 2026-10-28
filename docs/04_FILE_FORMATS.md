# 04 — File Formats

Four formats. HTML is the interoperability workhorse; JSON is our lossless
round-trip format; CSV is for spreadsheets; Markdown is share/export-only.

| Format | Import | Export | Lossless | Purpose |
|---|---|---|---|---|
| Netscape HTML | ✔ | ✔ | structure+dates | Universal browser exchange (Chrome, Edge, Brave, Firefox, Safari, Vivaldi, Opera all read/write it) |
| BM JSON v1 | ✔ | ✔ | ✔ | Backups, round-trip, safety backup before Replace |
| CSV (RFC 4180) | ✔ | ✔ | flattened | Spreadsheet review/editing |
| Markdown | ✖ | ✔ | — | Human-readable sharing (blog posts, Discord, README) |

`detect-format.ts` sniffs content (never trusts the file extension):
`<!DOCTYPE NETSCAPE-Bookmark-file-1` (case-insensitive, first 512 bytes) →
HTML; leading `{` + parses with `format:"bookmarkmagic"` → JSON; else try CSV header.

---

## 1. Netscape Bookmark HTML

De-facto standard since Netscape Navigator; intentionally *not* well-formed
HTML. `DOMParser('text/html')` normalizes it fine.

### 1.1 Emitted skeleton (export)

```html
<!DOCTYPE NETSCAPE-Bookmark-file-1>
<!-- This is an automatically generated file. It will be read and overwritten. DO NOT EDIT! -->
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
    <DT><H3 ADD_DATE="1751500000" LAST_MODIFIED="1751500000" PERSONAL_TOOLBAR_FOLDER="true">Bookmarks bar</H3>
    <DL><p>
        <DT><A HREF="https://example.com/" ADD_DATE="1751500000">Example</A>
        <DT><H3 ADD_DATE="1751500000">Dev tools</H3>
        <DL><p>
            <DT><A HREF="https://github.com/" ADD_DATE="1751500000">GitHub</A>
        </DL><p>
    </DL><p>
</DL><p>
```

Export rules: 4-space indent per depth (matches Chrome), attributes only when
values exist, one **root marker** on each folder that stands for a browser root
(below), HTML-escape `& < > "` in titles and hrefs — **and `\r` as `&#13;`**. The last
one is not a markup hazard but a round-trip one: the HTML tokenizer normalizes
CR and CRLF to LF during input-stream preprocessing, so an unescaped `\r` in a
title comes back as `\n`. A numeric reference survives, because character
references are decoded after that normalization. `\r` reaches us from BM JSON
and from quoted CSV fields, so this is reachable, not theoretical.

**Root markers** (since v1.1.0). Our own export and the Replace safety backup
write the browser roots as top-level folders; without a marker, re-importing
them nested a folder named "Other bookmarks" *inside* Other Bookmarks, one more
level on every restore (`03 §1`). Exactly one attribute per folder, the toolbar
winning:

| Root | Attribute | Who reads it |
|---|---|---|
| Bookmarks Bar | `PERSONAL_TOOLBAR_FOLDER="true"` | every browser |
| Other Bookmarks | `UNFILED_BOOKMARKS_FOLDER="true"` | Firefox (its own exporter writes it), and us |
| Mobile Bookmarks | `MOBILE_BOOKMARKS_FOLDER="true"` | us — importers ignore attributes they do not know |

### 1.2 Parse tolerance (import)

Must accept, with a warning where noted:

- Missing `</DT>` / stray `<p>` (normal for the format).
- `<DD>` description lines → **warning: descriptions dropped** (not in our
  model). ⚠️ A `<DD>` also *changes the tree shape*, so this is not merely a
  dropped string: a `<DD>` start tag closes the open `<DT>`, and a `<DL>`
  following it nests **inside the `<DD>`** — neither inside the `<DT>` nor as
  the `<DT>`'s next sibling. A naive `nextDlFor` finds nothing and silently
  drops the entire folder subtree. The walk must also look inside (and after) a
  `<DD>` next-sibling — see `05 §1`. Fixture: `weird/folder-with-dd.html`.
- `ICON="data:image/png;base64,…"` → base64 favicon; written by Firefox and
  Chrome, and read by Chrome's *native* File ▸ Import.
  `ICON_URI` → remote favicon URL; written by Firefox, ignored by Chrome.
  Both are parsed past and dropped, with a **single aggregated warning**:
  "N favicons ignored — the `chrome.bookmarks` API cannot set favicons."
  (Note the precise claim: Chrome's own importer *can* do this; the extension
  API exposes no favicon field, so we cannot.)
- Unknown attributes ignored silently — `SHORTCUTURL`, `TAGS`, `LAST_CHARSET`,
  `POST_DATA`, `FOLDED` (Safari), `LAST_VISIT`, and the IE-era
  `FEED`/`FEEDURL`/`WEBSLICE`/`ISLIVEPREVIEW`/`PREVIEWSIZE`.
- The three root markers (§1.1) are read **by value**: present and not
  `false`/`0`/`no`. Firefox writes `UNFILED_BOOKMARKS_FOLDER="false"` on folders
  that are not Other Bookmarks, and v1.0.x read `PERSONAL_TOOLBAR_FOLDER` by
  presence alone, so a `="false"` made a folder the bar.
- **Addresses** (since v1.1.0, `05 §1`): blank → skipped, `MISSING_URL`; not
  parseable (`URL.canParse` false — e.g. `www.example.com` with no scheme, a
  space in the host) → skipped, `INVALID_URL`, because `chrome.bookmarks.create`
  rejects it mid-write, after a Replace has already cleared the tree; Firefox
  `place:` smart bookmarks → skipped, `PLACE_QUERIES_SKIPPED` (Chrome's own
  importer drops them too; in Chrome they are dead links). `javascript:`,
  `data:` and `file:` addresses are kept verbatim (`09` T3). Fixture:
  `weird/invalid-urls.html`.
- **Empty titles are kept empty** (since v1.1.0), counted as `EMPTY_TITLE`.
  They used to become the address, which turned a favicon-only Bookmarks Bar
  into a row of URLs after one export/import cycle; Chrome shows the address
  itself wherever it needs a title.
- **A loose bookmark before a list.** With no `</DT>`, the HTML parser nests a
  following `<DL>` inside a bookmark's `<DT>`; that list is read at the same
  depth, after the bookmark. With an explicit `</DT>`, only a *folder* `<DT>`
  consumes the next body-level list. v1.0.x dropped the list in both shapes.
  Fixture: `weird/loose-first.html`.
- **An unescaped formatting tag in a title** (`C++ <b>tips</A>`): the parser
  re-opens that `<b>` around every later entry (`dt > b > a`, `dl > b > dt`).
  Entries are found through such wrappers — a `<DT>`'s own `<A>`/`<H3>`/`<DL>`
  is any descendant whose nearest `<DT>` is that one. v1.0.x imported one
  bookmark from such a file. Fixture: `weird/unclosed-format-tag.html`. A
  `<DT>` that still yields nothing is counted as `UNREADABLE_ENTRIES`.
- A root list wrapped in `<div>`/`<center>`/a table cell → found as an
  outermost `<DL>` when body-level collection finds nothing.
- `<HR>` separator elements (Firefox) → skipped, no warning. These are
  *elements*, so "unknown attributes ignored" does not cover them.
- Empty folders → preserved.
- **Root list selection.** Do **not** pick a single root `<DL>` —
  `document.querySelector('dl')` and "the outermost `<DL>`" are both lossy.
  Safari has been reported (Mozilla bug 801450) to emit top-level `<DT><H3>`
  folders with no outer wrapper, and real files can mix the two: one wrapped
  root list followed by loose `<DT>`s. Either single-root rule silently drops
  whichever half it did not pick, with no warning.

  Instead walk `<body>`'s children **in document order** and accept both kinds
  of entry point — a `<DT>` is read as a root entry, a `<DL>` is walked as a
  root list. One caveat: when a file emits an explicit `</DT>`, a folder's
  child `<DL>` also lands at body level, so compute each body-level `<DT>`'s
  child list first and skip any `<DL>` already consumed that way, or the whole
  subtree is emitted twice. Algorithm in `05 §1`.
  ⚠️ The exact Safari shape is still unverified against a real export (`00 §10`).

Hard failures only: no `NETSCAPE-Bookmark-file-1` doctype **and** no `<DL>`
found; or node/size/depth caps exceeded (`TOO_MANY_NODES`, `FILE_TOO_LARGE`,
`TOO_DEEP`). The node cap is checked on the raw text (a count of `<DT` tags)
**before** `DOMParser` runs, so a 25 MB file of 1.7 million entries is refused
without building its DOM (`09` T2). The depth cap applies to entries: an empty
list one level past it is harmless. A file with a valid doctype and zero `<DL>` is **not** a failure —
it yields an empty `ParseResult` with a `NO_BOOKMARKS` warning (`05 §1`).

### 1.3 Timestamps

`ADD_DATE` / `LAST_MODIFIED` are epoch **seconds** in every browser that writes
Netscape HTML — including Firefox, whose exporter divides PRTime by
`MICROSEC_PER_SEC` before writing. Normalize via `timestamps.ts` magnitude
detection (`05 §4`), which also tolerates ms/µs values from non-browser
exporters. Invalid → omit + warning.

Note the asymmetry the model has to absorb: `chrome.bookmarks` returns
`dateAdded` in **milliseconds**, while this file format and our `BookmarkNode`
both use **seconds**. `05 §4`'s magnitude table converts either correctly.

Chrome writes `ADD_DATE="0"` for nodes with no recorded date — that is normal,
not an anomaly, and must not raise a warning (`05 §4`).

---

## 2. BM JSON v1 (our schema — "BM" = BookmarkMagic)

```json
{
  "format": "bookmarkmagic",
  "version": 1,
  "generator": "BookmarkMagic 1.0.0",
  "exportedAt": "2026-07-03T07:05:00Z",
  "roots": [
    {
      "title": "Bookmarks bar",
      "toolbar": true,
      "addDate": 1751500000,
      "children": [
        { "title": "Example", "url": "https://example.com/", "addDate": 1751500000 }
      ]
    }
  ]
}
```

- `roots` = array of `BookmarkNode` (see `02_ARCHITECTURE.md §4`). Folders may
  omit `children` (⇒ empty). Unknown extra keys are ignored on import
  (forward compatibility); `version > 1` → warning "newer file, best-effort";
  an absent `version` is read as 1.
- `"root": "other" | "mobile"` (since v1.1.0, folders only, never beside
  `"toolbar"`) marks a folder that IS that browser root — the JSON form of
  §1.1's markers. Additive: v1 readers ignore unknown keys, so the version stays
  1, and a 1.0.x reader simply nests as before.
- **Legacy backups.** A 1.0.x safety backup has exactly the shape of a Chromium
  profile — `generator` `BookmarkMagic 1.0.x`, no `root` keys, three top-level
  folders, the first `toolbar` — so it is recognised and marked on read
  (`[1]` other, `[2]` mobile). Fixture: `weird/bm-legacy-1.0.1-backup.json`.
- Addresses: blank or unparseable → skipped with `MISSING_URL`/`INVALID_URL`
  (Chrome turns `url: ""` into a *folder*). `place:` is **kept**: this is the
  restore format, and a backup must bring back what the browser held.
- Dates go through `timestamps.ts` like every other format, so milliseconds
  and numeric strings are read and nonsense (`1e300`) is flagged, not stored.
- The safety backup is written **compact** (`indent: 0`, roughly half the
  bytes): it must stay under the 25 MB import cap to be restorable at all
  (`03 §1` step 6b). Exports stay indented.
- Validation is hand-rolled structural checking in `parse/bm-json.ts`
  (no schema library — zero-dep rule). Every node: `title` string required;
  `url` if present must be string; `children` only on folders.
- Chrome's profile `Bookmarks` file and Firefox `.json` backups are separate
  dialects with their own sections (§2a, §2b).

## 3. CSV

Header row required, column order fixed:

```csv
folder_path,title,url,add_date
"Bookmarks bar/Dev tools","GitHub","https://github.com/","1751500000"
"","Example","https://example.com/","1751500000"
```

- Separator `/` in `folder_path`; literal `/` inside a folder name escaped as
  `\/` (and `\` as `\\`). Empty path ⇒ top level. A single folder whose title
  is empty is written as a lone `\` — otherwise it is indistinguishable from
  "no path" and the folder dissolves on re-import. A lone `\` is unreachable
  from normal escaping (every literal `\` is doubled), so it is free to use.
- RFC 4180: quote fields containing `, " \n`; escape `"` as `""`. Accept both
  `,` and `;` delimiters on import (sniff header); export delimiter is a
  Settings option (default `,`). A quoted field that never closes is
  `CSV_UNCLOSED_QUOTE`, naming the line it opened on — it used to swallow the
  rest of the file into one cell.
- **Formula cells.** A title or folder path starting with `= + - @`, tab or CR
  (after any `'` guard quotes) is written with one extra leading `'`, and the
  reader removes exactly one again — so `=HYPERLINK(…)` is never a live formula
  in Excel, and the round trip stays exact.
- Import also skips blank, whitespace-only and padding (`,,,`) rows, and a
  leading Excel `sep=;` line. Address rules as BM JSON (`place:` kept).
- Rows are bookmarks only; folders are reconstructed from paths. CSV is a
  **flattened projection** — the full list of what it does not preserve, shown
  in the Export tab and asserted by the projected round-trip (`11 §3`):
  - empty folders (no row can represent them);
  - `lastModified` on anything, and `addDate` on folders (no columns);
  - `toolbar` / root identity — after a CSV parse `toolbar` is always
    `undefined`, so the first path segment is an ordinary folder title, never a
    root reference (consequence spelled out in `03 §1`);
  - sibling **order** across folders: folders materialise in row order, so two
    folders' relative position is whatever the row sequence implies;
  - **same-named sibling folders merge** — two "New folder"s (Chrome's default
    name) come back as one holding both sets of contents.
- Column order is fixed and part of the format contract — appending a column is
  a breaking change (major version, `12 §4`).
- Export writes UTF-8 **with BOM** (Excel compatibility).

## 4. Markdown (export-only)

Nested list, one line per item:

```markdown
# Bookmarks — 2026-07-03

- **Bookmarks bar**
  - **Dev tools**
    - [GitHub](https://github.com/)
  - [Example](https://example.com/)
```

Option "flat with headings": `##` per top-level folder, flat link lists under
each. In titles, backslash-escape every character CommonMark gives meaning to
(`` \ ` * _ { } [ ] ( ) < > # + - . ! | ~ & ``) and collapse line breaks to a
space — escaping only the link brackets let raw HTML such as
`<img onerror=…>` through (`09` T1) and let a newline turn the rest of the list
into a heading. Angle-bracket-wrap URLs containing `)` or spaces.

## 5. Filenames

`bookmarks-{all|partial}-YYYYMMDD-HHmm.{html|json|csv|md}` · safety backup:
`bookmarkmagic-backup-YYYYMMDD-HHmm.json`.
