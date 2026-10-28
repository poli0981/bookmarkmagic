/**
 * English warnings and errors — split out of en.ts so both files stay under the
 * size limit (docs/10 §1). en.ts re-assembles them; vi/ja mirror this file.
 *
 * Same rules as en.ts: NEVER `as const`, full sentences, `{token}` interpolation.
 */

/**
 * Every code is a plural key, including the two that interpolate no count —
 * `ParseWarning` always carries one, so a uniform shape lets `WarningList`
 * call `tPlural` unconditionally instead of maintaining a list of which
 * codes count things.
 */
export const warnings = {
  NO_BOOKMARKS: {
    one: 'This file contains no bookmarks.',
    other: 'This file contains no bookmarks.',
  },
  DESCRIPTIONS_DROPPED: {
    one: '{n} description was dropped — it has no place in the bookmark model.',
    other: '{n} descriptions were dropped — they have no place in the bookmark model.',
  },
  FAVICONS_IGNORED: {
    one: '{n} favicon ignored — the bookmarks API cannot set favicons.',
    other: '{n} favicons ignored — the bookmarks API cannot set favicons.',
  },
  INVALID_DATE: {
    one: '{n} unreadable date was left blank.',
    other: '{n} unreadable dates were left blank.',
  },
  MISSING_URL: {
    one: '{n} entry had no address and was skipped.',
    other: '{n} entries had no address and were skipped.',
  },
  NEWER_VERSION: {
    one: 'This file was written by a newer version — reading it as best we can.',
    other: 'This file was written by a newer version — reading it as best we can.',
  },
  EMPTY_TITLE: {
    one: '{n} bookmark has no title — your browser will show its address instead.',
    other: '{n} bookmarks have no title — your browser will show their addresses instead.',
  },
  INVALID_URL: {
    one: '{n} entry has an address the browser cannot store, so it was skipped.',
    other: '{n} entries have addresses the browser cannot store, so they were skipped.',
  },
  PLACE_QUERIES_SKIPPED: {
    one: '{n} Firefox smart bookmark (a saved search, not a web page) was skipped — here it would be a dead link.',
    other:
      '{n} Firefox smart bookmarks (saved searches, not web pages) were skipped — here they would be dead links.',
  },
  EXTRA_ROOTS_SKIPPED: {
    one: '{n} bookmark in a browser-specific folder (such as Opera’s Speed Dial or Trash) was not imported.',
    other:
      '{n} bookmarks in browser-specific folders (such as Opera’s Speed Dial or Trash) were not imported.',
  },
  UNREADABLE_ENTRIES: {
    one: '{n} entry in this file could not be read and was skipped.',
    other: '{n} entries in this file could not be read and were skipped.',
  },
};

export const errors = {
  NOT_NETSCAPE: 'This does not look like a bookmark HTML file.',
  NOT_BM_JSON:
    'This JSON file is not a bookmark file BookmarkMagic can read. It reads its own backups, Firefox JSON backups and Chrome’s Bookmarks file.',
  MALFORMED_JSON: 'This file is not valid JSON.',
  INVALID_NODE: 'This file has an entry BookmarkMagic cannot read.',
  BAD_CSV_HEADER: 'The CSV header row is missing or its columns are in the wrong order.',
  CSV_ROW_MISMATCH: 'A CSV row has the wrong number of columns.',
  CSV_UNCLOSED_QUOTE:
    'A quoted CSV field is never closed, so the rest of the file cannot be read reliably.',
  UNKNOWN_FORMAT:
    'Unrecognised file — expected a bookmark HTML export, CSV, a BookmarkMagic or Firefox JSON backup, or Chrome’s Bookmarks file.',
  FILE_TOO_LARGE: 'This file is too large to import.',
  TOO_MANY_NODES: 'This file contains too many bookmarks to import safely.',
  TOO_DEEP: 'This file nests folders far too deeply.',
  BACKUP_SERIALIZE_FAILED: 'The safety backup could not be prepared, so nothing was changed.',
  BACKUP_EXCEEDS_LIMITS:
    'Your current bookmarks are more than BookmarkMagic could read back from a backup, so Replace stopped before deleting anything. Merge, or import into a new folder, instead.',
  BACKUP_STALE:
    'Your bookmarks kept changing while the safety backup was being saved — another window, tab or sync was editing them — so nothing was deleted. Try again in a moment.',
  BACKUP_CANCELLED: 'You cancelled the safety backup, so nothing was deleted.',
  BACKUP_WRITE_FAILED: 'The safety backup could not be saved, so nothing was deleted.',
  BROWSER: 'The browser refused a bookmark operation.',
  WRITE_LOCKED:
    'Another BookmarkMagic tab is writing bookmarks right now. Wait for it to finish, then try again — nothing was changed.',
  NO_WRITABLE_ROOTS:
    'This browser profile has no bookmark folder BookmarkMagic is allowed to write to. Bookmarks managed by an organisation cannot be changed.',
  PARTIAL_WRITE: 'The browser stopped accepting bookmarks part-way through the import.',
  PARTIAL_CLEAR: 'The browser stopped part-way through replacing your bookmarks.',
  UNKNOWN: 'Something went wrong.',
};
