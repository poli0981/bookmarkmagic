# Changelog

All notable changes to BookmarkMagic are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Per `docs/12 §4`: **patch** = fixes and translations · **minor** = features, and
any change to the permission list or the store privacy tab · **major** =
breaking format or schema changes (a BM JSON version bump).

## [Unreleased]

Nothing yet.

## [1.0.0] — 2026-07-26

First public release.

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

[Unreleased]: https://github.com/poli0981/bookmarkmagic/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/poli0981/bookmarkmagic/releases/tag/v1.0.0
