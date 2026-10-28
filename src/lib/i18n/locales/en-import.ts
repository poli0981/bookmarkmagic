/**
 * English strings for the Import tab — split out of en.ts so both files stay
 * under the size limit (docs/10 §1), exactly like the notices. en.ts
 * re-assembles them; vi/ja mirror this file.
 *
 * Same rules as en.ts: NEVER `as const`, full sentences, `{token}` interpolation.
 */
export const importTab = {
  dropHint: 'Drop a bookmark file or click to browse · max {size}',
  dropFormats:
    'Browser HTML exports, CSV, BookmarkMagic and Firefox JSON backups, and Chrome’s own Bookmarks file (it has no extension).',
  reading: 'Reading {name}…',
  preview: 'Preview',
  folderName: 'Imported {date}',
  start: { one: 'Import {n} bookmark', other: 'Import {n} bookmarks' },
  backingUp:
    'Saving a safety backup before replacing anything. Confirm the save dialog to continue.',
  keepTabOpen: 'Keep this tab open until the import finishes.',
  progress: 'Importing… {done} / {total}',
  doneSummary: 'Done — {bookmarks} and {folders} created.',
  skipped: 'Skipped {existing} already in this browser and {inFile} repeated in the file.',
  stepSource: 'Source',
  stepOptions: 'Options',
  stepWriting: 'Writing',
  stepResult: 'Result',
  format: {
    'netscape-html': 'HTML',
    'bm-json': 'BookmarkMagic JSON',
    csv: 'CSV',
    'chrome-json': 'Chrome Bookmarks file',
    'firefox-json': 'Firefox backup',
  },
  countBookmarks: { one: '{n} bookmark', other: '{n} bookmarks' },
  countFolders: { one: '{n} folder', other: '{n} folders' },
  countPair: '{bookmarks} and {folders}',
  whereNewFolder:
    'Everything is in the folder “{folder}” under Other bookmarks — deleting that one folder undoes the import.',
  whereMerge: 'New items were added at the end of the folders they belong in.',
  whereReplace: 'Your bookmarks now hold exactly what the file holds.',
  replaceConfirmTitle: 'Replace everything?',
  replaceConfirmBody:
    '{current} in this browser will be deleted, after a safety backup is saved. Then {incoming} from {name} are written.',
  replaceConfirm: 'Back up and replace',
  target: { bar: 'bar', unfiled: 'Other', mobile: 'Mobile' },
  targetNote:
    'In Merge and Replace, this folder’s contents go straight into that browser folder instead of a copy of it.',
  reused: {
    one: 'Added to {n} folder you already had, instead of creating a copy.',
    other: 'Added to {n} folders you already had, instead of creating copies.',
  },
  // Firefox names its roots only by key ("toolbar", "unfiled", "mobile");
  // these become real folder names when importing into a new folder. Not
  // `other`: a branch with an `other` key reads as a plural (docs/07 §5).
  rootTitle: {
    toolbar: 'Bookmarks Toolbar',
    unfiled: 'Other Bookmarks',
    mobile: 'Mobile Bookmarks',
  },
  cancelledSummary: {
    one: 'Cancelled — {n} item was already created and was left in place.',
    other: 'Cancelled — {n} items were already created and were left in place.',
  },
  // docs/05 §6 and docs/00 §8 both require saying this, and nothing did.
  // chrome.bookmarks.create takes no dateAdded, so every imported bookmark is
  // stamped with the import time — indistinguishable from corruption to
  // someone migrating a decade-old archive.
  cancelledAfterClear:
    'You cancelled after your existing bookmarks had already been deleted, so what is left is only the part that was rebuilt.',
  dateNotice:
    'Imported bookmarks are dated today. Chrome does not let an extension set a bookmark’s original date — your exported files keep the real ones.',
  partialCreated: {
    one: '{n} item had already been created before this failed, and was left in place.',
    other: '{n} items had already been created before this failed, and were left in place.',
  },
  partialCleared: {
    one: '{n} top-level item had already been deleted before this failed. Restore it from your backup.',
    other:
      '{n} top-level items had already been deleted before this failed. Restore them from your backup.',
  },
  backupFileType: 'Bookmark backup',
  backupHint: 'Your safety backup was saved as {name}. Restore it by importing that JSON file.',
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
    newFolderNote:
      'Nothing existing is touched; one dated folder to delete if you change your mind.',
    mergeNote: 'Folders you already have are reused; new items go at the end of them.',
    replaceNote: 'Deletes everything first, after saving a backup. For restoring a backup.',
  },
  warnings: {
    // Plural keys are `{ one, other }` objects in EVERY locale (docs/07 §5).
    title: { one: '{n} warning', other: '{n} warnings' },
  },
};
