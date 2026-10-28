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

import { importTab } from './en-import';
import { errors, warnings } from './en-notices';

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
    detail: 'Technical detail',
  },
  popup: {
    import: 'Import bookmarks…',
    importHint: 'HTML, CSV, JSON backups, Chrome’s Bookmarks file',
    export: 'Export bookmarks…',
    exportHint: 'HTML, JSON, CSV or Markdown',
    manage: 'Open manager',
    manageHint: 'Edit, sort, find duplicates',
    bookmarks: { one: 'bookmark', other: 'bookmarks' },
    folders: { one: 'folder', other: 'folders' },
  },
  status: {
    local: 'local only',
    localNote: 'No network: the extension cannot send anything anywhere.',
    permissionsNote: 'The only two permissions this extension has.',
    more: 'More',
  },
  import: importTab,
  export: {
    scope: 'What to export',
    everything: 'Everything',
    format: 'Format',
    start: { one: 'Export {n} bookmark', other: 'Export {n} bookmarks' },
    started: 'Download started: {name}',
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
    tree: 'Bookmark tree',
    loading: 'Reading your bookmarks…',
    search: 'Search bookmarks',
    filterFolders: 'Filter folders',
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
    untitled: '(untitled)',
    empty: 'No bookmarks yet — import some to get started.',
    noMatches: 'Nothing matches that search.',
    showMore: {
      one: 'Show {n} more row · {total} not shown',
      other: 'Show {n} more rows · {total} not shown',
    },
    showEarlier: { one: 'Show {n} earlier row', other: 'Show {n} earlier rows' },
    deleteTitle: 'Delete this item?',
    deleteBody: 'Delete "{title}"? This cannot be undone.',
    deleteFolderBody: {
      one: 'Delete "{title}" and the {n} item inside it? This cannot be undone.',
      other: 'Delete "{title}" and the {n} items inside it? This cannot be undone.',
    },
    duplicates: 'Duplicates',
    duplicateSummary: '{links} · {copies}',
    duplicateLinks: { one: '{n} duplicated link', other: '{n} duplicated links' },
    extraCopies: { one: '{n} extra copy', other: '{n} extra copies' },
    noDuplicates: 'No duplicate links found.',
    keepFirst: {
      one: 'Keep the first of each, delete {n} copy',
      other: 'Keep the first of each, delete {n} copies',
    },
    keeps: 'kept',
    deleteCopy: 'Delete the copy "{title}" in {path}',
    keepFirstTitle: 'Delete duplicate copies?',
    keepFirstBody: {
      one: 'Keep the first copy of each link and delete the other {n}? This cannot be undone.',
      other: 'Keep the first copy of each link and delete the other {n}? This cannot be undone.',
    },
    // The dialog promises an exact number, so a partial delete has to reconcile
    // against it — the action cannot be undone.
    keepFirstPartial:
      'Deleted {done} of {total} copies before this failed. Nothing else was removed.',
    sort: 'Sort A→Z',
    sortTitle: 'Sort "{title}"?',
    sortBody: {
      one: 'Folders first, then bookmarks, by name. {n} item moves; nothing is renamed or deleted, and the browser has no undo for it.',
      other:
        'Folders first, then bookmarks, by name. {n} items move; nothing is renamed or deleted, and the browser has no undo for it.',
    },
    sortPartial:
      'Moved {done} of {total} items before the browser refused. The folder shows its real order now.',
    alreadySorted: 'This folder is already in order.',
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
    diagnostics: 'Diagnostics',
    copyDiagnostics: 'Copy diagnostics',
    diagnosticsNote:
      'A short local log of what this tab did — error codes and counts, never titles or addresses. It leaves your computer only if you paste it somewhere.',
    diagnosticsCopied: 'Diagnostics copied',
    diagnosticsCopyFailed: 'Could not copy the diagnostics.',
    tagline:
      'Import, export and edit bookmarks between browsers — offline, no account, no cloud. Your data never leaves your device.',
    version: 'Version {version}',
    links: 'Links',
    repo: 'GitHub repository',
    issues: 'Report an issue',
    changelog: 'Releases and changelog',
    store: 'Chrome Web Store listing',
    thirdParty: 'Third-party code',
    thirdPartyNote:
      'No runtime dependencies are installed. A few small MIT-licensed pieces are compiled into the extension: the Svelte runtime with its clsx helper, and WXT’s one-line browser shim — see THIRD_PARTY_NOTICES.txt in the package.',
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
  warnings,
  errors,
};

export default dict;

/** Widened shape (string, not the literal). vi/ja are typed against this. */
export type Dict = typeof dict;
