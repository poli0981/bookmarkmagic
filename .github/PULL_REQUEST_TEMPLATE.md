<!--
Thank you for sending a patch. Delete anything below that does not apply —
a translation fix does not need the parser section, and vice versa.
-->

## What and why

<!-- What changes, and what problem it solves. Link the issue if there is one. -->

## Checklist

- [ ] `npm run verify` is green. (Release-bearing? `npm run verify:full` —
      `verify` does not run coverage, build or the built-manifest gate.)
- [ ] Conventional Commits title (`fix(import): …`, `feat(edit): …`, `docs: …`).
- [ ] `CHANGELOG.md` `[Unreleased]` updated, if a user would notice this.

### If it changes behaviour

- [ ] The relevant `docs/` chapter is updated. **The docs are the specification
      here** — when code and docs disagree, the docs win, so a behaviour change
      that skips the doc leaves the spec lying.

### If it touches user-visible text

- [ ] The key exists in **all three** locales — `en`, `vi`, `ja`. `en.ts` is the
      schema; `vi`/`ja` use `satisfies Dict`, so a missing key fails the type
      check. Never add `as const` to a locale file.
- [ ] Interpolation tokens (`{n}`, `{name}`) match across all three.

### If it is a parser fix

- [ ] A fixture is committed under `tests/fixtures/`, sanitized, with the
      reporter's consent recorded in the issue.
- [ ] A regression test lands **in this same PR** — a fixture with no test is
      just a file.
- [ ] The quirk is noted in the parser source **and** in `docs/04 §1.2`.
- [ ] `docs/11 §2`'s inventory lists the new fixture.

### Things that are never OK

- [ ] No new runtime dependency. (Zero is the number, and it is a public claim
      in the store listing and the README. A new dep needs approval first —
      `docs/01 §4`.)
- [ ] No new permission. The manifest is exactly `["bookmarks", "storage"]`, and
      changing that is a minor-version event that also requires re-certifying
      the Chrome Web Store privacy answers.
- [ ] No `fetch`, `eval`, `{@html}` or `innerHTML`. `npm run guard` enforces it.
