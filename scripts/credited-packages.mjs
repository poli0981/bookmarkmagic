// @ts-check
/**
 * The npm packages whose code the build compiles into the extension — docs/14 §5.
 *
 * One list behind three gates, so none of them can drift from the others:
 *  - `wxt.config.ts` fails the build when code from any other package ships;
 *  - `tests/unit/third-party.test.ts` requires both notices files to credit
 *    every package named here;
 *  - `scripts/check-licenses.mjs` holds each of them to the licences that may
 *    travel inside a GPL-3.0-or-later extension.
 *
 * Through v1.0.x the notices said "none" while three of these shipped. Adding
 * a name here is the first step of shipping a new package, never the last:
 * its licence text goes into `legal/THIRD_PARTY_NOTICES.md` and
 * `src/public/THIRD_PARTY_NOTICES.txt` in the same pull request.
 */
export const CREDITED_PACKAGES = Object.freeze(['svelte', 'clsx', '@wxt-dev/browser', 'wxt']);
