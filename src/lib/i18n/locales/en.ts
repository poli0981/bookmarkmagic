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
    // Distinct from `cancel`: this only hides a notification about something
    // that already finished — there is nothing left to call off.
    dismiss: 'Dismiss',
    sections: 'Sections',
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
    preview: 'Preview',
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
      // Plural keys are `{ one, other }` objects in EVERY locale (docs/07 §5).
      title: { one: '{n} warning', other: '{n} warnings' },
    },
  },
  export: {
    scope: 'What to export',
    everything: 'Everything',
    format: 'Format',
    start: 'Export {n} bookmarks',
    saved: 'Saved {name}',
    markdownNote: 'Markdown is share-only — BookmarkMagic cannot import it back.',
    csvNote:
      'CSV is a flattened view: empty folders and which folder is the toolbar are not preserved.',
    csvDelimiter: 'Delimiter',
    comma: 'Comma ( , )',
    semicolon: 'Semicolon ( ; )',
    markdownStyle: 'Layout',
    nested: 'Nested list',
    flat: 'Headings per folder',
    formats: {
      'netscape-html': {
        name: 'HTML',
        note: 'Works with Chrome, Edge, Brave, Firefox, Safari, Vivaldi and Opera.',
      },
      'bm-json': { name: 'JSON', note: 'Lossless backup — the best choice for restoring later.' },
      csv: { name: 'CSV', note: 'For spreadsheets. Flattened.' },
      markdown: { name: 'Markdown', note: 'For sharing in a README, blog post or chat.' },
    },
  },
  edit: {
    search: 'Search bookmarks',
    newFolder: 'New folder',
    newFolderTitle: 'New folder',
    findDuplicates: 'Find duplicates',
    expandAll: 'Expand all',
    collapseAll: 'Collapse all',
    rename: 'Rename',
    open: 'Open',
    copyUrl: 'Copy link',
    unsafeUrl: 'This address uses a scheme BookmarkMagic will not open.',
    copied: 'Link copied',
    copyFailed: 'Could not copy the link.',
    moveTo: 'Move to…',
    moveToBody: 'Move "{title}" into which folder?',
    noMoveTargets: 'No other folder is available.',
    delete: 'Delete',
    empty: 'No bookmarks yet — import some to get started.',
    noMatches: 'Nothing matches that search.',
    deleteTitle: 'Delete this item?',
    deleteBody: 'Delete "{title}"? This cannot be undone.',
    deleteFolderBody: 'Delete "{title}" and the {n} items inside it? This cannot be undone.',
    duplicates: 'Duplicates',
    duplicatesFound: '{groups} duplicated links · {extra} extra copies',
    noDuplicates: 'No duplicate links found.',
    keepFirst: 'Keep the first of each, delete {n}',
    keeps: 'kept',
    keepFirstTitle: 'Delete duplicate copies?',
    keepFirstBody:
      'Keep the first copy of each link and delete the other {n}? This cannot be undone.',
  },
  settings: {
    autosave: 'Changes are saved as you make them.',
    language: 'Language',
    languageNote: 'Applies to this extension only, not to the browser.',
    localeAuto: 'Automatic (follow the browser)',
    lang: {
      // Endonyms, deliberately identical in all three dictionaries: a Japanese
      // user hunting for Vietnamese looks for "Tiếng Việt", not "ベトナム語".
      en: 'English',
      vi: 'Tiếng Việt',
      ja: '日本語',
    },
    theme: 'Theme',
    themes: {
      system: 'System',
      light: 'Light',
      dark: 'Dark',
    },
    defaultExportFormat: 'Default export format',
    defaultExportFormatNote: 'Pre-selected when you open the Export tab.',
    defaultImportMode: 'Default import mode',
    defaultImportModeNote: 'Pre-selected when you open the Import tab.',
    csvDelimiter: 'CSV delimiter',
    csvDelimiterNote: 'Use semicolons if your spreadsheet expects them.',
    markdownStyle: 'Markdown layout',
    markdownStyleNote: 'How exported Markdown arranges your folders.',
    saved: 'Settings saved',
    saveFailed: 'Your settings could not be saved.',
    reset: 'Reset to defaults',
    resetTitle: 'Reset all settings?',
    resetBody:
      'Language, theme and every default choice go back to how they started. Your bookmarks are not touched.',
    resetConfirm: 'Reset',
    resetDone: 'Settings reset to defaults',
  },
  about: {
    tagline:
      'Import, export and edit bookmarks between browsers — offline, no account, no cloud. Your data never leaves your device.',
    version: 'Version {version}',
    links: 'Links',
    repo: 'GitHub repository',
    issues: 'Report an issue',
    changelog: 'Releases and changelog',
    thirdParty: 'Third-party dependencies: None',
    thirdPartyNote: 'BookmarkMagic ships no runtime libraries at all.',
    donate: 'Support development',
    donateNote: 'Entirely optional — BookmarkMagic is free software either way.',
    legal: 'Legal',
    accepted: 'Legal terms accepted on {date} · version {version}',
    acceptedUndated: 'Legal terms accepted · version {version}',
    notAccepted: 'You have not accepted the legal terms yet.',
  },
  legal: {
    title: 'Before you start',
    summary:
      'BookmarkMagic runs entirely on your device. It has no servers, makes no network requests, and collects nothing — your bookmarks and settings never leave this browser. It is free software under the GPL-3.0 licence and comes with no warranty of any kind. Bookmark operations change your browser data, and the "Replace everything" mode deletes your current bookmarks, so keep your own backups of anything you care about.',
    updatedTitle: 'The terms have been updated',
    updatedBody:
      'These documents changed since you accepted them. Please read them again to continue.',
    documents: 'Documents',
    eula: 'End User License Agreement',
    license: 'License (GPL-3.0)',
    disclaimer: 'Disclaimer',
    privacy: 'Privacy Policy',
    englishNote: 'The legally binding documents are in English.',
    accept: 'I have read and accept the terms above',
    continue: 'Accept & continue',
    close: 'Close tab',
    closeManually: 'You can close this tab now.',
    saveFailed:
      'Your acceptance could not be saved, so nothing was recorded. Check that this browser allows extension storage, then try again.',
    blocked: 'Accept the terms to use the Import, Export and Edit tabs.',
  },
  /**
   * Every code is a plural key, including the two that interpolate no count —
   * `ParseWarning` always carries one, so a uniform shape lets `WarningList`
   * call `tPlural` unconditionally instead of maintaining a list of which
   * codes count things.
   */
  warnings: {
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
      one: '{n} bookmark had no title; its address is shown instead.',
      other: '{n} bookmarks had no title; their address is shown instead.',
    },
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
