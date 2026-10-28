/**
 * Hard caps and versioned constants.
 *
 * Purpose: one place for every number that bounds untrusted input, so the
 * threat model (docs/09 §2 T2) and the parser cannot drift apart.
 * Inputs: none — pure constants.
 * Guarantees: values here are the ones docs/09 promises to reviewers.
 */

/** Pre-parse file size cap. Larger files fail with `FILE_TOO_LARGE`. */
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

/** Node count cap across a parsed tree. Exceeding it throws `TOO_MANY_NODES`. */
export const MAX_NODES = 100_000;

/** Nesting depth cap. Exceeding it throws `TOO_DEEP` (docs/05 §1). */
export const MAX_DEPTH = 200;

/**
 * How deep an import may nest folders INSIDE the browser, counted below a root.
 *
 * Lower than the parse cap on purpose: Chrome keeps its bookmarks in a JSON
 * file it reads back with a 200-level nesting limit, and every folder costs two
 * levels (the object and its `children` array). A tree past about 98 folders
 * deep is saved, then refused on the next start — which would lose far more
 * than the import. 90 leaves margin; real trees rarely pass 20.
 */
export const MAX_WRITE_DEPTH = 90;

/**
 * Legal document version. Bump ONLY for material changes to the documents in
 * `legal/`; the first-run gate reappears for every user when this increases
 * (docs/14 §2).
 */
export const LEGAL_VERSION = 1;
