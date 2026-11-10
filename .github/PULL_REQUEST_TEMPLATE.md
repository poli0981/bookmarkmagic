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

- [ ] The key exists in **every** locale — `en`, `vi`, `ja`, `zh-CN`, `ro`
      (`LOCALES`). `en.ts` is the schema; the others use `satisfies Dict`, so a
      missing key fails the type check. Never add `as const` to a locale file.
- [ ] Interpolation tokens (`{n}`, `{name}`) match across every locale, and a
      plural key carries the forms its language needs (`few` in Romanian —
      `docs/07 §5`).

### If it changes the interface

`ACCESSIBILITY.md` is a public promise and `docs/06 §5` is its specification.

- [ ] Everything new works from the **keyboard alone**, and focus is visible
      on it — including on a control with a filled background.
- [ ] Focus goes somewhere sensible when the thing that had it disappears
      (a closed dialog, a removed row, a replaced step). It never falls to
      the top of the page.
- [ ] Every control has an accessible **name**; an icon-only button takes a
      `label`. Text a screen reader speaks is an i18n key like any other.
- [ ] No state is shown by **colour alone**, and a state shown by a fill or a
      shadow has a `@media (forced-colors: active)` equivalent
      (`tests/unit/styles/forced-colors.test.ts` holds the list).
- [ ] Anything that moves sits inside
      `@media (prefers-reduced-motion: no-preference)`; pointer targets are at
      least 24 × 24 CSS px.
- [ ] One pass with a **screen reader** over the changed screen (Narrator,
      NVDA or VoiceOver) — or the PR says that it was not done.
- [ ] `ACCESSIBILITY.md` is still true: its key table and its known
      limitations.

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
