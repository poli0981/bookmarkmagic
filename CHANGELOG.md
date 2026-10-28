# Changelog

All notable changes to BookmarkMagic are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Per `docs/12 §4`: **patch** = fixes and translations · **minor** = features, and
any change to the permission list or the store privacy tab · **major** =
breaking format or schema changes (a BM JSON version bump).

## [Unreleased]

Nothing yet.

## [1.1.0] — 2026-10-29

New import formats, a Merge that really merges, restores that put everything
back where it was, Sort A→Z, drag to reorder, and a new look. Permissions are
unchanged (`bookmarks` and `storage`), and nothing to do — Chrome updates
itself. **Needs Chrome 136 or later.**

### Added

- Import Chrome's own `Bookmarks` file — the JSON file in your profile folder,
  which has no extension — and Firefox's JSON backups
  (`bookmarks-YYYY-MM-DD.json`). Both still know which bookmarks were in
  "Mobile bookmarks", which the browsers' own HTML exports throw away.
- **Sort A→Z** for any folder: folders first, then bookmarks, in natural order
  ("Item 2" before "Item 10"). It tells you how many items will move before
  doing anything.
- **Drag to reorder**: drop above or below a row to place an item exactly
  there, or onto a folder to move it inside.
- A new look: clearer panels, a status bar, readable numbers, and icons that
  move a little — never if your system asks for reduced motion.
- **Copy diagnostics** in the About tab: a short log of what the tab did
  (error codes and counts — never titles or addresses) to paste into a bug
  report. It stays on your computer unless you paste it somewhere.
- The import preview marks which folders go straight into the Bookmarks bar,
  Other or Mobile bookmarks, and names the format it detected.

### Changed

- **Requires Chrome 136 or later** (was 120). Older Chrome keeps version 1.0.1.
- Chrome itself now enforces that the extension makes no network requests: a
  stricter content security policy refuses any connection, remote image, font
  or frame an extension page might try. Nothing it did before needed one.
- "Merge into existing folders" now really merges: a folder you already have is
  reused and the new bookmarks are added at the end of it. Before, every folder
  in the file was created again beside yours.
- "Replace everything" restores a file exactly, duplicate links included — the
  "skip duplicates" box never applied to it, and now it really does not.
- Firefox "smart bookmarks" (saved searches, `place:` links) in browser HTML
  exports are skipped and counted: in Chrome they are dead links. BookmarkMagic's
  own JSON and CSV files keep them.
- A bookmark with an empty title stays untitled after import, instead of taking
  its address as the title.
- The safety backup taken before "Replace everything" is compact JSON — about
  half the size.
- The file picker shows every file; BookmarkMagic recognises the format from
  the content.
- "Replace everything" now asks first, showing exactly how many bookmarks and
  folders will be deleted and how many will be written.
- The import button counts what will really be imported (duplicates you chose
  to skip are not counted), and the report lists bookmarks and folders
  separately, what was skipped, which existing folders were reused, and where
  everything went.
- Error messages stay on screen until you dismiss them.
- The popup opens an already-open manager on the page you clicked, and its
  folder count no longer includes the three built-in root folders.
- Very large folders show 500 items at a time, with "Show more", so expanding
  everything no longer freezes the tab.
- Two manager tabs can no longer write bookmarks at the same time — the second
  one is told to wait, and nothing is changed.

### Fixed

- Restoring a backup put "Other bookmarks" and "Mobile bookmarks" inside Other
  Bookmarks — one level deeper on every restore. They now go back where they
  were, and backups made by 1.0.x are recognised and restored correctly too.
- One address Chrome refuses no longer stops an import half-way — after
  "Replace everything" had already deleted your bookmarks. Such entries are now
  skipped before anything is written, and the preview says how many.
- "Replace everything" now refuses to start when your current bookmarks are too
  large for a backup BookmarkMagic could read back, instead of writing that
  backup and deleting everything anyway.
- Some bookmark files silently lost entries: a folder list after a loose
  bookmark, everything after a title containing an unescaped `<b>`, and lists
  wrapped in other markup. Anything that still cannot be read is now counted.
- A folder marked `PERSONAL_TOOLBAR_FOLDER="false"` is no longer taken for the
  Bookmarks Bar.
- A CSV file with an unclosed quote is reported with its line number, instead of
  one cell swallowing the rest of the file.
- CSV exports no longer contain cells a spreadsheet would run as a formula; the
  guard character is removed again when the file is imported.
- Titles in Markdown exports can no longer turn into links, HTML or broken
  lines.
- A link ending in a bare `?` or `#` is recognised as a duplicate of the same
  link without it.
- "Replace everything" re-checks your bookmarks after the safety backup is
  saved, and re-saves it if something changed meanwhile (sync, another window),
  so nothing can be deleted that the backup does not hold. It never empties the
  bookmarks stored in your Google Account, and restoring a backup puts Mobile
  bookmarks back in "Mobile bookmarks" even when that folder was empty.
- Imports that would nest folders deeper than Chrome can reliably store are
  refused up front instead of being written.
- Keyboard: "Move to…" is now a real dialog that keyboard focus enters and
  leaves properly, with a filter; the menu key or Shift+F10 opens it from the
  tree, and Ctrl+C copies the focused link. Cancelling a drag no longer leaves
  rows highlighted. Pressing Esc while renaming no longer saves the new name.
- The edit tree no longer collapses or loses your place after a failed edit,
  and focus moves to the next row after a delete.
- The About tab and the third-party notices now name the small MIT-licensed
  pieces the build has always compiled in (the Svelte runtime with its `clsx`
  helper, and WXT's browser shim), instead of saying there were none.

## [1.0.1] — 2026-08-03

Released and submitted 2026-08-03; live on the Chrome Web Store (confirmed on
the listing 2026-10-28).

Stabilization, from the first pass over the shipped extension. No new features,
no change to permissions, and nothing you have to do — Chrome updates itself.

### Fixed

- If the browser refuses part of an import, the report now says how many
  bookmarks were actually created, and — after a "replace everything" — names
  the safety backup so you can restore. It used to say only that something went
  wrong, while the items it had already written sat in your tree uncounted.
- Cancelling a "replace everything" after the deletion had begun said only how
  many items were created, on a browser that was nearly empty. It now says what
  happened and points at your backup.
- The import screen no longer offers a backup filename in the cases where no
  backup was written.
- Pressing the browser's Back button during an import used to leave the manager
  permanently stuck — every tab disabled, and no way out but closing it.
  Navigation is now refused while an import is running, with an explanation.
- Two manager tabs no longer overwrite each other's settings, and accepting the
  terms in one tab now unlocks the other.
- Errors in the Edit and Export tabs appear in your own language again, with the
  browser's own message kept separately for bug reports.
- Clearing the search box no longer leaves every folder it opened expanded, and
  collapsing a folder while searching now stays collapsed.
- "Keep the first of each" no longer offers to delete bookmarks managed by your
  organisation, which the browser always refused, and says how many copies it
  removed if it stops early.
- A profile with no writable bookmark folder now says so, instead of reporting a
  refused operation.

### Added

- The import screen states that imported bookmarks carry today's date — the
  browser does not let an extension set the original one. Your exported files
  still keep the real dates.
- A link to the Chrome Web Store listing in the About tab.
- Bug-report forms, a contributing guide, and `scripts/sanitize-bookmarks.mjs`,
  which strips every address and title from a bookmark file while keeping the
  structure a parsing bug depends on — so a sample can be attached to a public
  issue without publishing your browsing history.

## [1.0.0] — 2026-07-26

First public release. Approved by the Chrome Web Store and available to install
from 2026-08-03.

### Added

- Import bookmark files (Netscape HTML, BookmarkMagic JSON, CSV) with a full
  preview — counts, folder depth, duplicates and warnings — before anything is
  written.
- Three import modes: into a new dated folder (the default), merge into
  existing folders, or replace everything. Replace downloads a JSON safety
  backup first and deletes nothing until that backup is proven.
- Skip bookmarks whose URL already exists in this browser.
- Export everything, or just the folders you pick, to HTML, JSON, CSV or
  Markdown.
- Edit the bookmark tree: search, rename, create folders, delete, drag & drop,
  a keyboard "Move to…" with full parity, and a duplicate-finder panel.
- English, Vietnamese and Japanese, switchable in Settings independently of the
  browser's own language.
- Light, dark and system themes.
- A first-run legal gate covering the EULA, licence, disclaimer and privacy
  policy.

### Security

- Imported URLs are never rendered as links. Opening one goes through an
  `http(s)`-only allowlist, so a `javascript:` or `data:` bookmark in a crafted
  file cannot be activated from the extension.
- Parsing is bounded: 25 MB per file, 100 000 nodes, 200 levels of nesting.
- No network access of any kind at runtime, enforced by a grep gate in CI.

[Unreleased]: https://github.com/poli0981/bookmarkmagic/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/poli0981/bookmarkmagic/compare/v1.0.1...v1.1.0
[1.0.1]: https://github.com/poli0981/bookmarkmagic/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/poli0981/bookmarkmagic/releases/tag/v1.0.0
