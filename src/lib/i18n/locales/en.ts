/**
 * English dictionary — the schema source of truth (docs/07 §2).
 *
 * vi.ts and ja.ts mirror this exact shape via `satisfies Dict`, so a missing
 * key fails `tsc`. That is the whole completeness check; no i18n framework.
 *
 * NEVER write `as const` here. It would make `Dict` a tree of *string literal*
 * types, so `satisfies Dict` would demand `vi.common.import === 'Import'` and
 * every correct translation would become a compile error.
 *
 * Interpolation is `{token}` replacement only — full sentences per key, never
 * concatenated fragments, so VI/JA word order works.
 */
const dict = {
  common: {
    appName: 'BookmarkMagic',
    import: 'Import',
    export: 'Export',
    edit: 'Edit',
    settings: 'Settings',
    about: 'About',
    busy: 'An import is in progress',
    cancel: 'Cancel',
    comingSoon: '{tab} arrives in a later build.',
  },
  popup: {
    import: 'Import bookmarks…',
    export: 'Export bookmarks…',
    manage: 'Open manager',
    counts: '{bookmarks} bookmarks · {folders} folders',
  },
  import: {
    dropHint: 'Drop a bookmark file or click to browse — .html, .json, .csv · max {size}',
    reading: 'Reading {name}…',
    folderName: 'Imported {date}',
    start: 'Import {n} bookmarks',
    backingUp:
      'Saving a safety backup before replacing anything. Confirm the save dialog to continue.',
    keepTabOpen: 'Keep this tab open until the import finishes.',
    progress: 'Importing… {done} / {total}',
    doneSummary: 'Done — {created} items created.',
    skipped: 'Skipped {existing} already in this browser and {inFile} repeated in the file.',
    cancelledSummary: 'Cancelled — {created} items were already created and were left in place.',
    openEdit: 'Open Edit tab',
    another: 'Import another file',
    dedupe: 'Skip duplicates already in this browser ({n} found)',
    dedupeDisabled: 'Not applicable: Replace deletes your current bookmarks first.',
    replaceWarning:
      'This deletes ALL current bookmarks. A JSON safety backup is saved first, and nothing is deleted until that succeeds.',
    attest:
      'Your browser could not confirm the backup was saved. Check your downloads folder for {name}, then confirm — nothing has been deleted yet.',
    attestConfirm: 'I have the backup — delete and replace',
    clearing: 'Deleting your current bookmarks. Do not close this tab.',
    badgeNew: 'new',
    badgeDup: 'dup',
    expand: 'Expand folder',
    collapse: 'Collapse folder',
    stats: {
      bookmarks: 'Bookmarks',
      folders: 'Folders',
      depth: 'Max depth',
      duplicates: 'Duplicates',
    },
    mode: {
      legend: 'How should these be added?',
      newFolder: 'Into a new folder (recommended)',
      merge: 'Merge into existing folders',
      replace: 'Replace everything',
    },
    warnings: {
      title: '{n} warning(s)',
    },
  },
  warnings: {
    NO_BOOKMARKS: 'This file contains no bookmarks.',
    DESCRIPTIONS_DROPPED:
      '{n} description(s) were dropped — they have no place in the bookmark model.',
    FAVICONS_IGNORED: '{n} favicon(s) ignored — the bookmarks API cannot set favicons.',
    INVALID_DATE: '{n} unreadable date(s) were left blank.',
    MISSING_URL: '{n} entries had no address and were skipped.',
    NEWER_VERSION: 'This file was written by a newer version — reading it as best we can.',
    EMPTY_TITLE: '{n} bookmark(s) had no title; their address is shown instead.',
  },
  errors: {
    NOT_NETSCAPE: 'This does not look like a bookmark HTML file.',
    NOT_BM_JSON: 'This JSON file was not written by BookmarkMagic.',
    MALFORMED_JSON: 'This file is not valid JSON.',
    INVALID_NODE: 'This file has an entry BookmarkMagic cannot read.',
    BAD_CSV_HEADER: 'The CSV header row is missing or its columns are in the wrong order.',
    CSV_ROW_MISMATCH: 'A CSV row has the wrong number of columns.',
    UNKNOWN_FORMAT: 'Unrecognised file — expected bookmark HTML, JSON or CSV.',
    FILE_TOO_LARGE: 'This file is too large to import.',
    TOO_MANY_NODES: 'This file contains too many bookmarks to import safely.',
    TOO_DEEP: 'This file nests folders far too deeply.',
    BACKUP_SERIALIZE_FAILED: 'The safety backup could not be prepared, so nothing was changed.',
    BACKUP_CANCELLED: 'You cancelled the safety backup, so nothing was deleted.',
    BACKUP_WRITE_FAILED: 'The safety backup could not be saved, so nothing was deleted.',
    BROWSER: 'The browser refused a bookmark operation.',
    UNKNOWN: 'Something went wrong.',
  },
};

export default dict;

/** Widened shape (string, not the literal). vi/ja are typed against this. */
export type Dict = typeof dict;
