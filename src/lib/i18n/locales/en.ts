/**
 * English dictionary — the schema source of truth (docs/07 §2).
 *
 * vi.ts and ja.ts mirror this exact shape via `satisfies Dict`, so a missing
 * key fails `tsc`. That is the whole completeness check; no i18n framework.
 *
 * NEVER write `as const` here. It would make `Dict` a tree of string *literal*
 * types, so `satisfies Dict` would demand vi.common.import === 'Import' and
 * every correct translation would become a compile error.
 */
const dict = {
  common: {
    appName: 'BookmarkMagic',
    import: 'Import',
    export: 'Export',
    edit: 'Edit',
    settings: 'Settings',
    about: 'About',
    cancel: 'Cancel',
  },
};

export default dict;

/** Widened shape (string, not the literal). vi/ja are typed against this. */
export type Dict = typeof dict;
