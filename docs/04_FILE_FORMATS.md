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
values exist, `PERSONAL_TOOLBAR_FOLDER="true"` on the toolbar root folder,
HTML-escape `& < > "` in titles and hrefs — **and `\r` as `&#13;`**. The last
one is not a markup hazard but a round-trip one: the HTML tokenizer normalizes
CR and CRLF to LF during input-stream preprocessing, so an unescaped `\r` in a
title comes back as `\n`. A numeric reference survives, because character
references are decoded after that normalization. `\r` reaches us from BM JSON
and from quoted CSV fields, so this is reachable, not theoretical.

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
  `POST_DATA`, `UNFILED_BOOKMARKS_FOLDER` (Firefox), `FOLDED` (Safari),
  `LAST_VISIT`, and the IE-era `FEED`/`FEEDURL`/`WEBSLICE`/`ISLIVEPREVIEW`/
  `PREVIEWSIZE`.
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
  ⚠️ The exact Safari shape is still unverified against a real export — gate
  the fixture on a captured one before shipping (`11 §2`).

Hard failures only: no `NETSCAPE-Bookmark-file-1` doctype **and** no `<DL>`
found; or node/size/depth caps exceeded (`TOO_MANY_NODES`, `FILE_TOO_LARGE`,
`TOO_DEEP`). A file with a valid doctype and zero `<DL>` is **not** a failure —
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
  (forward compatibility); `version > 1` → warning "newer file, best-effort".
- Validation is hand-rolled structural checking in `parse/bm-json.ts`
  (no schema library — zero-dep rule). Every node: `title` string required;
  `url` if present must be string; `children` only on folders.
- Chrome's internal `Bookmarks` file and Firefox `.json` backups are **not**
  v1 import targets (Roadmap v1.1).

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
  Settings option (default `,`).
- Rows are bookmarks only; folders are reconstructed from paths. CSV is a
  **flattened projection** — the full list of what it does not preserve, shown
  in the Export tab and asserted by the projected round-trip (`11 §3`):
  - empty folders (no row can represent them);
  - `lastModified` on anything, and `addDate` on folders (no columns);
  - `toolbar` / root identity — after a CSV parse `toolbar` is always
    `undefined`, so the first path segment is an ordinary folder title, never a
    root reference (consequence spelled out in `03 §1`);
  - sibling **order** across folders: folders materialise in row order, so two
    folders' relative position is whatever the row sequence implies.
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
each. Escape `[ ] ( )` in titles. Angle-bracket-wrap URLs containing `)` or
spaces.

## 5. Filenames

`bookmarks-{all|partial}-YYYYMMDD-HHmm.{html|json|csv|md}` · safety backup:
`bookmarkmagic-backup-YYYYMMDD-HHmm.json`.
