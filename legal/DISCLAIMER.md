# Disclaimer — BookmarkMagic

Terms version 1 · Effective 2026-07-26 · Last updated 2026-10-29

- Provided "AS IS", without warranty of any kind (see LICENSE §15–16).
- Bookmark operations modify your browser's bookmark data. The "Replace
  everything" mode DELETES all existing bookmarks. Before it does, it saves a
  safety backup and asks you to confirm with the exact numbers it will delete
  and write; it does not start if your bookmarks are larger than a backup the
  Extension could read back. If the browser stops part-way, what was already
  deleted can be restored by importing that backup. You remain responsible for
  keeping backups of data you care about.
- Imported bookmarks are created with the current date and time. Chrome's
  extension API does not allow an extension to set a bookmark's original
  creation date, so original dates are preserved in your exported *files* but
  not when writing back into the browser.
- Import files come from outside this Extension; verify you trust their source.
  Bookmarked URLs are stored as-is and are not vetted by the Extension.
- This project is not affiliated with or endorsed by Google, Chrome, Mozilla,
  Firefox or any browser vendor. Browser names are trademarks of their
  respective owners.
- The BookmarkMagic name and icon identify this project, published by skullmute
  (poli0981). The GPL lets anyone fork the code; it does not let a fork present
  itself as this project. Report a copy that does to **takedown@poli0981.dev**,
  and formal copyright notices to **dmca@poli0981.dev**.

Questions about this disclaimer: **legal@poli0981.dev**.
