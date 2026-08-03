# Changelog

All notable changes to BookmarkMagic are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Per `docs/12 §4`: **patch** = fixes and translations · **minor** = features, and
any change to the permission list or the store privacy tab · **major** =
breaking format or schema changes (a BM JSON version bump).

## [Unreleased]

Nothing yet.

## [1.0.1] — 2026-08-03

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

[Unreleased]: https://github.com/poli0981/bookmarkmagic/compare/v1.0.1...HEAD
[1.0.1]: https://github.com/poli0981/bookmarkmagic/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/poli0981/bookmarkmagic/releases/tag/v1.0.0
