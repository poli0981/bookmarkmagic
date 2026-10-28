# Privacy Policy — BookmarkMagic

Terms version 1 · Effective 2026-07-26 · Last updated 2026-10-29

BookmarkMagic ("the Extension") is designed to work entirely on your device.

## What we collect

Nothing. The Extension has no servers, performs no network requests, and
contains no analytics, telemetry, or crash reporting.

## What the Extension accesses, and why

- **Bookmarks** (permission: `bookmarks`): read to display and export your
  bookmark tree; written when you import or edit. This data never leaves your
  device.
- **Local settings** (permission: `storage`): your language, theme,
  preferences, and the date you accepted these terms are stored locally via
  `chrome.storage.local`. They are not transmitted anywhere and are removed by
  Chrome when you uninstall the Extension. The Extension does not use
  `chrome.storage.sync`, so even your settings stay off any vendor cloud.

The Extension requests no other permissions. It has no host permissions, no
content scripts, and no background service worker. Its Content-Security-Policy
forbids it from opening network connections at all.

- **Diagnostics** (no permission needed): while a BookmarkMagic tab is open,
  it keeps a short log of what it did — import steps, error codes, counts —
  in memory, so that you can copy it into a bug report from the About tab. It
  never contains titles, addresses or file names, is never written to storage,
  disappears when the tab closes, and leaves your computer only if you paste
  it somewhere yourself.

## Files you import or export

Files are read and generated locally in your browser. They are never uploaded.
Exported files are saved through your browser's normal download mechanism to a
location you control.

## Third parties

No data is shared with anyone, because no data is collected. The Extension
installs no runtime dependencies; the few small MIT-licensed pieces its build
compiles in (the Svelte runtime with its clsx helper, and WXT's browser shim —
see THIRD_PARTY_NOTICES.md) contain no network code.

Two things happen outside the Extension and are worth knowing:

- **The Chrome Web Store** (Google) distributes the Extension and its updates.
  Installing and updating it are governed by Google's own privacy policy, not
  this one, and Google gives the developer only aggregate counts such as the
  number of users.
- **Opening a bookmark.** When you open a bookmark from the Edit tab, your
  browser loads that page exactly as when you click any link: the request is
  the browser's, made on your instruction, to the site you chose. The
  Extension itself still sends nothing.

## If you contact us

Everything above describes the Extension, which sends us nothing. This section
describes what happens if *you* choose to send us something — reporting a bug,
for example.

- **Please do not send us your real bookmarks file.** A bookmarks export is a
  browsing history. Run `scripts/sanitize-bookmarks.mjs` from the repository
  first: it replaces every address and title while keeping the file structure
  that a bug depends on, so the sanitized version still reproduces the problem.
- **Anything you attach to a GitHub issue is public** and stays in the issue
  history. Attach only a sanitized sample. If you agree, a sample may be
  committed to the repository as a permanent test fixture under GPL-3.0 — the
  bug report form asks you explicitly, and never assumes it.
- **Anything you email us is kept only as long as it takes to reproduce and fix
  the issue, and is then deleted.** It is not shared with anyone, and it is
  never added to the repository unless you agreed to that.

## Changes

Material changes will be published here and re-acceptance will be requested
inside the Extension.

*The section above was added on 2026-08-03. It is a clarification, not a change
of practice: it describes handling of material you choose to send us, which was
never part of what the Extension itself collects — which remains nothing. No
re-acceptance was requested.*

*Clarified on 2026-10-29: the diagnostics log, the Chrome Web Store, opening a
bookmark, and what the build compiles in are now described, and the contact
address changed. None of it changes what the Extension collects — still
nothing — so no re-acceptance is requested (`docs/14 §3.1`).*

## Contact

Privacy questions, and requests to remove a sample you sent:
**privacy@poli0981.dev** — or open an issue at
<https://github.com/poli0981/bookmarkmagic/issues>
